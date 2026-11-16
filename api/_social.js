// Instagram (API com login do Instagram) e TikTok (Content Posting API):
// conexão por OAuth, tokens guardados no Redis e renovados sozinhos, postagem de carrossel e números da conta.
const crypto = require("crypto");
const { redis } = require("./_lib");

const env = (k) => String(process.env[k] || "").trim();
const IG_VERSION = env("IG_API_VERSION") || "v23.0";
const IG = "https://graph.instagram.com";
const FB = "https://graph.facebook.com";
// Dois jeitos de conectar o Instagram:
//  - "unificado" (apps novos da Meta): login pelo Facebook com um ID de configuração; token de usuário do sistema que não expira;
//    as chamadas vão para graph.facebook.com/{id-da-conta-do-instagram}.
//  - "instagram" (apps antigos): login do Instagram; token de 60 dias renovado sozinho; chamadas para graph.instagram.com/me.
const igApi = (t) => `${t.host === "fb" ? FB : IG}/${IG_VERSION}`;
const igMe = (t) => (t.host === "fb" ? t.user_id : "me");
const noRefresh = (t) => t.host === "fb" || t.host === "igu";
const TT = "https://open.tiktokapis.com";

// Endereço oficial do Armetec Posts. É ele que vai no link de retorno do Instagram/TikTok (precisa ser idêntico ao
// cadastrado no app da Meta/TikTok) e nos links das fotos, não importa por qual endereço a chamada chegou.
const DOMINIO = "https://posts.armetec.com.br";
function siteUrl() { const s = env("SITE_URL"); return (s && !/titanbarber/i.test(s) ? s : DOMINIO).replace(/\/+$/, ""); } // nunca usa o endereço do Titan
const mediaUrl = (site, ymd, slot, n) => `${site}/media/${ymd}/${slot + 1}/${n}.jpg`;

async function getJSON(key) { const v = await redis("GET", key); return v ? JSON.parse(v) : null; }
async function setJSON(key, val, ttl) { return ttl ? redis("SET", key, JSON.stringify(val), "EX", String(ttl)) : redis("SET", key, JSON.stringify(val)); }

// Liga/desliga por rede. Nada é postado até você ligar.
const DEFAULT_CFG = { instagram: false, tiktok: false, tiktokMode: "rascunho" };
async function getConfig() { return { ...DEFAULT_CFG, ...((await getJSON("cfg:social")) || {}) }; }
async function setConfig(patch) {
  const cur = await getConfig(), next = { ...cur };
  if (typeof patch.instagram === "boolean") next.instagram = patch.instagram;
  if (typeof patch.tiktok === "boolean") next.tiktok = patch.tiktok;
  if (patch.tiktokMode === "rascunho" || patch.tiktokMode === "direto") next.tiktokMode = patch.tiktokMode;
  await setJSON("cfg:social", next);
  return next;
}

// Agenda: para cada post do dia (1 a 4), se está ligado, horário, dias da semana (0 = domingo) e redes.
// Horários de meia em meia hora (o agendador roda a cada 30 min).
function defaultSchedule() {
  const { banco } = require("./_lib");
  return banco.horarios.map((t) => ({ on: true, time: t, days: [0, 1, 2, 3, 4, 5, 6], nets: { instagram: true, tiktok: false } }));
}
async function getSchedule() {
  const saved = await getJSON("cfg:agenda"), def = defaultSchedule();
  if (!Array.isArray(saved)) return def;
  return def.map((d, i) => ({ ...d, ...(saved[i] || {}), nets: { ...d.nets, ...((saved[i] && saved[i].nets) || {}) } }));
}
async function setSchedule(list) {
  if (!Array.isArray(list)) throw new Error("agenda inválida");
  const cur = await getSchedule();
  const next = cur.map((c, i) => {
    const n = list[i] || {};
    return {
      on: typeof n.on === "boolean" ? n.on : c.on,
      time: /^([01]\d|2[0-3]):(00|30)$/.test(n.time || "") ? n.time : c.time,
      days: Array.isArray(n.days) ? [...new Set(n.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : c.days,
      nets: { instagram: n.nets && typeof n.nets.instagram === "boolean" ? n.nets.instagram : c.nets.instagram, tiktok: n.nets && typeof n.nets.tiktok === "boolean" ? n.nets.tiktok : c.nets.tiktok },
    };
  });
  await setJSON("cfg:agenda", next);
  return next;
}

async function http(url, opts = {}) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch (e) { j = { raw: text.slice(0, 300) }; }
  if (!r.ok || (j.error && (j.error.message || (j.error.code && j.error.code !== "ok")))) {
    const e = j.error || {};
    throw new Error(e.message || e.error_user_msg || e.code || j.error_message || j.raw || "HTTP " + r.status);
  }
  return j;
}
const form = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- OAuth ----------
// O "state" do OAuth prova que o pedido saiu daqui e guarda para onde voltar (Armetec Posts ou Jarvis).
async function newState(net, back) { const s = crypto.randomBytes(18).toString("base64url"); await redis("SET", "oauth:" + s, JSON.stringify({ net, back: back || "" }), "EX", "900"); return s; }
async function takeState(s, net) {
  if (!/^[\w-]{10,64}$/.test(String(s || ""))) return null;
  const v = await redis("GET", "oauth:" + s); await redis("DEL", "oauth:" + s);
  if (!v) return null;
  try { const j = JSON.parse(v); return j.net === net ? j : null; } catch (e) { return v === net ? { net, back: "" } : null; }
}
// Link de uso único para abrir a conexão sem estar logado no Armetec Posts (gerado a pedido do Jarvis).
async function newConnectLink(site, net, back) { const t = crypto.randomBytes(18).toString("base64url"); await redis("SET", "olink:" + t, JSON.stringify({ net, back }), "EX", "900"); return `${site}/api/conectar?net=${net}&t=${t}`; }
async function takeConnectLink(t) { if (!/^[\w-]{10,64}$/.test(String(t || ""))) return null; const v = await redis("GET", "olink:" + t); await redis("DEL", "olink:" + t); return v ? JSON.parse(v) : null; }

// Dados do app de desenvolvedor: da Vercel (se existirem) ou colados no Jarvis/Armetec Posts (guardados no Redis).
let credCache = {};
async function creds(net) {
  // As variáveis da Vercel valem primeiro; o que foi colado no Jarvis fica de reserva.
  if (net === "instagram" && env("IG_APP_ID") && env("IG_APP_SECRET")) return { id: env("IG_APP_ID"), secret: env("IG_APP_SECRET"), ...(env("IG_CONFIG_ID") ? { config: env("IG_CONFIG_ID") } : {}) };
  if (credCache[net]) return credCache[net];
  const c = await getJSON("cfg:app:" + net);
  if (c && c.id && c.secret) return (credCache[net] = c);
  if (net === "tiktok" && env("TIKTOK_CLIENT_KEY") && env("TIKTOK_CLIENT_SECRET")) return { id: env("TIKTOK_CLIENT_KEY"), secret: env("TIKTOK_CLIENT_SECRET") };
  return null;
}
async function setCreds(net, id, secret, config) {
  id = String(id || "").trim(); secret = String(secret || "").trim(); config = String(config || "").trim();
  if (!["instagram", "tiktok"].includes(net) || !/^[\w-]{5,80}$/.test(id) || !/^[\w-]{10,120}$/.test(secret)) throw new Error("ID ou chave secreta inválidos (confira se copiou inteiro)");
  if (config && !/^\d{5,30}$/.test(config)) throw new Error("ID da configuração inválido (são só números)");
  const c = { id, secret, ...(config ? { config } : {}) };
  await setJSON("cfg:app:" + net, c); credCache[net] = c;
}
const igReady = async () => Boolean(await creds("instagram"));
const ttReady = async () => Boolean(await creds("tiktok"));
const igMode = async () => { const c = await creds("instagram"); return c ? (c.config ? "unificado" : "instagram") : null; };

async function igAuthUrl(site, state) {
  const c = await creds("instagram");
  if (c.config) return `https://www.facebook.com/${IG_VERSION}/dialog/oauth?` + form({ client_id: c.id, config_id: c.config, redirect_uri: site + "/api/ig-callback",
    response_type: "code", override_default_response_type: "true", state });
  return "https://www.instagram.com/oauth/authorize?" + form({ enable_fb_login: 0, force_authentication: 1, client_id: c.id, redirect_uri: site + "/api/ig-callback",
    response_type: "code", scope: "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights", state });
}
// Login unificado: troca o código pelo token e descobre qual conta do Instagram foi liberada.
async function igExchangeUnified(site, code, c) {
  const V = `${FB}/${IG_VERSION}`, trail = [];
  let r;
  try { r = await http(`${V}/oauth/access_token?` + form({ client_id: c.id, client_secret: c.secret, redirect_uri: site + "/api/ig-callback", code })); }
  catch (e) { throw new Error("A Meta recusou a autorização: " + e.message + " (confira a Chave Secreta do Aplicativo no Jarvis)"); }
  const token = r.access_token;
  const found = new Map(); // id -> username
  const add = (id, username) => { if (id && !found.has(String(id))) found.set(String(id), username || null); };
  let ready = null;
  const tryStep = async (name, fn) => { if (ready) return; try { const n0 = found.size; await fn(); trail.push(`${name}:${found.size - n0}`); } catch (e) { if (e.tok) { ready = e.tok; return; } trail.push(`${name}:erro(${String(e.message).slice(0, 60)})`); } };

  // 1) As permissões do token dizem quais contas (do Instagram e do portfólio) foram liberadas no login.
  let businesses = [], scopes = "";
  await tryStep("permissoes", async () => {
    const dbg = await http(`${V}/debug_token?` + form({ input_token: token, access_token: `${c.id}|${c.secret}` }));
    const gs = (dbg.data && dbg.data.granular_scopes) || [];
    scopes = gs.map((g) => g.scope + (g.target_ids ? "[" + g.target_ids.length + "]" : "")).join(" ") || (dbg.data && (dbg.data.scopes || []).join(" ")) || "nenhuma";
    for (const g of gs) {
      if (/^instagram/.test(g.scope)) (g.target_ids || []).forEach((id) => add(id));
      if (g.scope === "business_management") businesses = businesses.concat(g.target_ids || []);
    }
  });
  // 1b) Tokens do login unificado às vezes já respondem como a própria conta do Instagram.
  if (!found.size) await tryStep("conta_direta", async () => {
    const me = await http(`${IG}/${IG_VERSION}/me?` + form({ fields: "user_id,username", access_token: token }));
    if (me.user_id || me.id) { // este token fala com graph.instagram.com: guarda assim e pronto
      const tok = { host: "igu", access_token: token, user_id: String(me.user_id || me.id), username: me.username, expires_at: Date.now() + 3650 * 864e5, refreshed_at: Date.now(), via: "conta_direta" };
      await setJSON("tok:instagram", tok);
      throw Object.assign(new Error("ok"), { tok });
    }
  });
  if (!found.size) await tryStep("me_instagram", async () => {
    const me = await http(`${V}/me?` + form({ fields: "id,instagram_business_account{id,username}", access_token: token }));
    if (me.instagram_business_account) add(me.instagram_business_account.id, me.instagram_business_account.username);
  });
  // 2) Contas do Instagram do portfólio (próprias e de clientes).
  if (!found.size) await tryStep("portfolio", async () => {
    if (!businesses.length) { const b = await http(`${V}/me/businesses?` + form({ fields: "id", access_token: token })); businesses = (b.data || []).map((x) => x.id); }
    let lastErr = null;
    for (const biz of businesses) for (const edge of ["owned_instagram_accounts", "instagram_business_accounts", "instagram_accounts", "client_instagram_accounts"]) {
      try { const r2 = await http(`${V}/${biz}/${edge}?` + form({ fields: "id,username", access_token: token })); (r2.data || []).forEach((x) => add(x.id, x.username)); } catch (e) { lastErr = e; }
    }
    if (!found.size && lastErr) throw lastErr;
  });
  // 3) Contas ligadas a Páginas do Facebook.
  if (!found.size) await tryStep("paginas", async () => {
    const pages = await http(`${V}/me/accounts?` + form({ fields: "instagram_business_account{id,username},connected_instagram_account{id,username}", access_token: token }));
    for (const p of pages.data || []) { const ig = p.instagram_business_account || p.connected_instagram_account; if (ig) add(ig.id, ig.username); }
  });
  // 4) Contas atribuídas diretamente ao usuário do sistema.
  if (!found.size) await tryStep("usuario", async () => {
    const r3 = await http(`${V}/me/instagram_accounts?` + form({ fields: "id,username", access_token: token }));
    (r3.data || []).forEach((x) => add(x.id, x.username));
  });
  if (ready) return ready;
  if (!found.size) {
    await setJSON("tok:instagram_pendente", { access_token: token, at: Date.now() }, 7 * 86400);
    const semPortfolio = !/business_management/.test(scopes);
    throw new Error((semPortfolio
      ? "Login aceito ✓ Falta só informar o ID da conta do Instagram no campo abaixo para concluir."
      : "Login aceito, mas a Meta não informou nenhuma conta do Instagram. Na janela do Facebook, marque a conta do Instagram e confirme.")
      + " [diagnóstico: " + trail.join(", ") + " | permissões do token: " + scopes + "]");
  }

  // Confirma com a conta que responde (e pega o @).
  let igId = null, username = null, lastErr = "";
  for (const [id, u] of found) {
    try { const me = await http(`${V}/${id}?` + form({ fields: "username", access_token: token })); igId = id; username = me.username || u; break; }
    catch (e) { lastErr = e.message; }
  }
  if (!igId) throw new Error("A conta do Instagram foi encontrada, mas a Meta não deixou ler: " + lastErr);
  const tok = { host: "fb", access_token: token, user_id: igId, username, expires_at: Date.now() + 3650 * 864e5, refreshed_at: Date.now(), via: trail.join(",") };
  await setJSON("tok:instagram", tok);
  return tok;
}
async function igExchange(site, code) {
  const c = await creds("instagram");
  if (c.config) return igExchangeUnified(site, String(code), c);
  const short = await http("https://api.instagram.com/oauth/access_token", { method: "POST", body: form({ client_id: c.id, client_secret: c.secret,
    grant_type: "authorization_code", redirect_uri: site + "/api/ig-callback", code: String(code).replace(/#_$/, "") }) });
  const s = (short.data && short.data[0]) || short;
  const long = await http(`${IG}/access_token?` + form({ grant_type: "ig_exchange_token", client_secret: c.secret, access_token: s.access_token }));
  const me = await http(`${IG}/${IG_VERSION}/me?` + form({ fields: "user_id,username", access_token: long.access_token }));
  const tok = { access_token: long.access_token, user_id: String(me.user_id || s.user_id), username: me.username, expires_at: Date.now() + (long.expires_in || 5184000) * 1000, refreshed_at: Date.now() };
  await setJSON("tok:instagram", tok);
  return tok;
}
// Token longo dura 60 dias; renova quando passar de 7 dias de uso.
async function igToken() {
  const t = await getJSON("tok:instagram");
  if (!t) return null;
  if (!noRefresh(t) && Date.now() - (t.refreshed_at || 0) > 7 * 864e5 && t.expires_at > Date.now()) {
    try {
      const r = await http(`${IG}/refresh_access_token?` + form({ grant_type: "ig_refresh_token", access_token: t.access_token }));
      Object.assign(t, { access_token: r.access_token, expires_at: Date.now() + (r.expires_in || 5184000) * 1000, refreshed_at: Date.now() });
      await setJSON("tok:instagram", t);
    } catch (e) { /* segue com o atual enquanto ele valer */ }
  }
  return t.expires_at > Date.now() ? t : null;
}

async function ttAuthUrl(site, state) {
  const c = await creds("tiktok");
  return "https://www.tiktok.com/v2/auth/authorize/?" + form({ client_key: c.id, scope: "user.info.basic,user.info.stats,video.publish,video.upload",
    response_type: "code", redirect_uri: site + "/api/tt-callback", state });
}
function ttSave(r) {
  return { access_token: r.access_token, refresh_token: r.refresh_token, open_id: r.open_id, scope: r.scope,
    expires_at: Date.now() + (r.expires_in || 86400) * 1000, refresh_expires_at: Date.now() + (r.refresh_expires_in || 31536000) * 1000 };
}
async function ttExchange(site, code) {
  const c = await creds("tiktok");
  const r = await http(`${TT}/v2/oauth/token/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ client_key: c.id, client_secret: c.secret, code, grant_type: "authorization_code", redirect_uri: site + "/api/tt-callback" }) });
  const tok = ttSave(r);
  await setJSON("tok:tiktok", tok);
  return tok;
}
// Token de acesso do TikTok dura 24 h; o de renovação, 1 ano.
async function ttToken() {
  const t = await getJSON("tok:tiktok");
  if (!t) return null;
  if (t.expires_at - Date.now() < 3600e3) {
    if (t.refresh_expires_at < Date.now()) return null;
    const c = await creds("tiktok");
    const r = await http(`${TT}/v2/oauth/token/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_key: c.id, client_secret: c.secret, grant_type: "refresh_token", refresh_token: t.refresh_token }) });
    const n = ttSave(r);
    await setJSON("tok:tiktok", n);
    return n;
  }
  return t;
}
const ttHeaders = (t) => ({ Authorization: "Bearer " + t.access_token, "Content-Type": "application/json; charset=UTF-8" });

// ---------- Postagem ----------
async function igPublish(urls, caption) {
  const t = await igToken();
  if (!t) throw new Error("Instagram não conectado (ou token vencido). Conecte de novo no Armetec Posts.");
  const base = `${igApi(t)}/${t.user_id}`;
  let box;
  if (urls.length === 1) box = await http(`${base}/media`, { method: "POST", body: form({ image_url: urls[0], caption, access_token: t.access_token }) }); // foto única
  else {
    const children = await Promise.all(urls.map((u) => http(`${base}/media`, { method: "POST", body: form({ image_url: u, is_carousel_item: true, access_token: t.access_token }) }).then((r) => r.id)));
    box = await http(`${base}/media`, { method: "POST", body: form({ media_type: "CAROUSEL", children: children.join(","), caption, access_token: t.access_token }) });
  }
  for (let i = 0; i < 20; i++) { // espera o Instagram baixar as fotos
    const s = await http(`${igApi(t)}/${box.id}?` + form({ fields: "status_code", access_token: t.access_token }));
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error("Instagram recusou as fotos (" + s.status_code + ")");
    await sleep(1500);
  }
  const pub = await http(`${base}/media_publish`, { method: "POST", body: form({ creation_id: box.id, access_token: t.access_token }) });
  let permalink = null;
  try { permalink = (await http(`${igApi(t)}/${pub.id}?` + form({ fields: "permalink", access_token: t.access_token }))).permalink; } catch (e) {}
  return { id: pub.id, permalink };
}

async function ttPublish(urls, caption, title, mode) {
  const t = await ttToken();
  if (!t) throw new Error("TikTok não conectado (ou acesso vencido). Conecte de novo no Armetec Posts.");
  const direct = mode === "direto";
  const post_info = { title: String(title).slice(0, 90), description: String(caption).slice(0, 4000) };
  if (direct) {
    const info = await http(`${TT}/v2/post/publish/creator_info/query/`, { method: "POST", headers: ttHeaders(t), body: "{}" });
    const opts = (info.data && info.data.privacy_level_options) || [];
    Object.assign(post_info, { privacy_level: opts.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : opts[0] || "SELF_ONLY", disable_comment: false, auto_add_music: true });
  }
  const r = await http(`${TT}/v2/post/publish/content/init/`, { method: "POST", headers: ttHeaders(t), body: JSON.stringify({
    post_info, source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: urls }, post_mode: direct ? "DIRECT_POST" : "MEDIA_UPLOAD", media_type: "PHOTO" }) });
  return { id: r.data && r.data.publish_id, mode: direct ? (post_info.privacy_level === "PUBLIC_TO_EVERYONE" ? "público" : "privado (" + post_info.privacy_level + ")") : "rascunho na caixa do TikTok" };
}

// ---------- Números ----------
// Números do Instagram (guardados 10 min para não gastar a cota da API).
// Conta: seguidores, posts. Período (7 e 28 dias): visualizações, alcance, visitas ao perfil, contas engajadas, interações.
// Posts recentes: curtidas, comentários, visualizações e alcance de cada um. Mensagens: conversas com movimento em 7 dias.
async function igStats() {
  const t = await igToken();
  if (!t) return { connected: false };
  const cached = await getJSON("cache:igstats");
  if (cached && cached.user === t.user_id && Date.now() - cached.at < 10 * 60e3) return cached.data;
  const A = igApi(t), tk = t.access_token;
  const me = await http(`${A}/${igMe(t)}?` + form({ fields: t.host === "fb" ? "username,followers_count,follows_count,media_count" : "user_id,username,followers_count,follows_count,media_count", access_token: tk }));
  const out = { connected: true, username: me.username, followers: me.followers_count, following: me.follows_count, posts: me.media_count, tokenExpires: t.expires_at };
  const until = Math.floor(Date.now() / 1000);
  const metric = async (name, days) => {
    try { const r = await http(`${A}/${t.user_id}/insights?` + form({ metric: name, period: "day", metric_type: "total_value", since: until - days * 86400, until, access_token: tk }));
      const x = (r.data || [])[0]; return x && x.total_value ? x.total_value.value : null; } catch (e) { return null; }
  };
  const names = ["views", "reach", "profile_views", "accounts_engaged", "total_interactions"];
  const [w, m] = await Promise.all([7, 28].map((d) => Promise.all(names.map((n) => metric(n, d)))));
  out.week = Object.fromEntries(names.map((n, i) => [n, w[i]]));
  out.month = Object.fromEntries(names.map((n, i) => [n, m[i]]));
  // Todos os posts (até 50): números de cada um. As métricas de cada post ficam guardadas 3 h para não gastar a cota da API.
  try {
    const md = await http(`${A}/${igMe(t)}/media?` + form({ fields: "id,caption,like_count,comments_count,timestamp,permalink,media_type,media_url,thumbnail_url", limit: 50, access_token: tk }));
    const all = await Promise.all((md.data || []).map(async (x) => {
      const item = { id: x.id, caption: String(x.caption || "").split("\n")[0].slice(0, 90), likes: x.like_count || 0, comments: x.comments_count || 0, at: x.timestamp, url: x.permalink,
        type: x.media_type, img: x.media_type === "VIDEO" ? x.thumbnail_url : x.media_url };
      const ck = "cache:igmedia:" + x.id, c = await getJSON(ck);
      if (c) Object.assign(item, c);
      else {
        const m = {};
        try { const ins = await http(`${A}/${x.id}/insights?` + form({ metric: "views,reach,saved,shares", access_token: tk })); for (const k of ins.data || []) m[k.name] = (k.values && k.values[0] && k.values[0].value) ?? (k.total_value && k.total_value.value) ?? null; }
        catch (e) { try { const ins = await http(`${A}/${x.id}/insights?` + form({ metric: "reach", access_token: tk })); for (const k of ins.data || []) m[k.name] = k.values && k.values[0] && k.values[0].value; } catch (e2) {} }
        await setJSON(ck, m, 3 * 3600); Object.assign(item, m);
      }
      return item;
    }));
    out.recent = all.slice(0, 8);
    const sum = (k) => all.reduce((a, x) => a + (Number(x[k]) || 0), 0);
    out.recentTotals = { views: sum("views"), likes: sum("likes"), comments: sum("comments") };
    const score = (x) => (x.views != null ? x.views : (x.reach || 0)) + (x.likes || 0) * 5 + (x.comments || 0) * 10;
    out.postsInsights = {
      total: all.length, views: sum("views"), reach: sum("reach"), likes: sum("likes"), comments: sum("comments"), saved: sum("saved"), shares: sum("shares"),
      avgViews: all.length ? Math.round(sum("views") / all.length) : 0,
      top: all.slice().sort((a, b) => score(b) - score(a)).slice(0, 3),
      series: all.slice(0, 20).reverse().map((x) => ({ at: x.at, views: x.views ?? x.reach ?? 0, likes: x.likes, caption: x.caption })),
    };
  } catch (e) { out.recent = []; }
  // Evolução de seguidores: guarda um retrato por dia (90 dias).
  try {
    const day = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), hk = "hist:ig:seguidores";
    if (me.followers_count != null) await redis("HSET", hk, day, String(me.followers_count));
    const h = (await redis("HGETALL", hk)) || [];
    const pairs = Array.isArray(h) ? h.reduce((acc, v, i) => (i % 2 ? acc : acc.concat([[v, Number(h[i + 1])]])), []) : Object.entries(h).map(([k, v]) => [k, Number(v)]);
    pairs.sort((a, b) => a[0].localeCompare(b[0]));
    for (const [k] of pairs.slice(0, Math.max(0, pairs.length - 90))) await redis("HDEL", hk, k);
    out.followersHistory = pairs.slice(-90).map(([d, n]) => ({ day: d, n }));
  } catch (e) { out.followersHistory = []; }
  try {
    const c = await http(`${A}/${igMe(t)}/conversations?` + form({ platform: "instagram", fields: "updated_time", limit: 50, access_token: tk }));
    const since = Date.now() - 7 * 864e5;
    out.messages = { conversations7d: (c.data || []).filter((x) => Date.parse(x.updated_time) >= since).length };
  } catch (e) { out.messages = null; }
  await setJSON("cache:igstats", { user: t.user_id, at: Date.now(), data: out }, 900);
  return out;
}
async function ttStats() {
  const t = await ttToken();
  if (!t) return { connected: false };
  const r = await http(`${TT}/v2/user/info/?fields=open_id,display_name,username,follower_count,following_count,likes_count,video_count`, { headers: ttHeaders(t) });
  const u = (r.data && r.data.user) || {};
  return { connected: true, name: u.display_name, username: u.username, followers: u.follower_count, following: u.following_count, likes: u.likes_count, videos: u.video_count };
}

// Conclui a conexão do Instagram com o ID da conta informado à mão (e um token opcional, ex.: o de "Gerar tokens de acesso").
async function igManual(igId, tokenIn) {
  igId = String(igId || "").trim(); tokenIn = String(tokenIn || "").trim();
  if (!/^\d{5,30}$/.test(igId)) throw new Error("O ID da conta do Instagram tem só números (ex.: 17841400000000000).");
  const pend = await getJSON("tok:instagram_pendente");
  const tokens = [tokenIn, pend && pend.access_token].filter(Boolean);
  if (!tokens.length) throw new Error("Primeiro toque em Conectar e faça o login na Meta; depois informe o ID.");
  const errs = [];
  for (const token of tokens) {
    // a) token do login do Instagram (graph.instagram.com)
    try {
      const me = await http(`${IG}/${IG_VERSION}/me?` + form({ fields: "user_id,username", access_token: token }));
      const tok = { host: token === tokenIn && !/^EAA/.test(token) ? undefined : "igu", access_token: token, user_id: String(me.user_id || igId), username: me.username,
        expires_at: Date.now() + (token === tokenIn && !/^EAA/.test(token) ? 60 : 3650) * 864e5, refreshed_at: Date.now(), via: "manual-ig" };
      await setJSON("tok:instagram", tok); await redis("DEL", "tok:instagram_pendente"); await redis("DEL", "err:instagram");
      return tok;
    } catch (e) { errs.push("instagram: " + e.message); }
    // b) token do Facebook (graph.facebook.com/{id})
    try {
      const me = await http(`${FB}/${IG_VERSION}/${igId}?` + form({ fields: "username", access_token: token }));
      const tok = { host: "fb", access_token: token, user_id: igId, username: me.username, expires_at: Date.now() + 3650 * 864e5, refreshed_at: Date.now(), via: "manual-fb" };
      await setJSON("tok:instagram", tok); await redis("DEL", "tok:instagram_pendente"); await redis("DEL", "err:instagram");
      return tok;
    } catch (e) { errs.push("facebook: " + e.message); }
  }
  throw new Error("A Meta não liberou essa conta com esse acesso: " + errs.join(" | ").slice(0, 300));
}

// Progresso de cada post (para a barra no Jarvis): fila → gerando → enviando → publicando → publicado/falhou.
async function setProgress(ymd, slot, stage, pct, msg) {
  const cur = (await getJSON(`prog:${ymd}:${slot}`)) || {};
  if (cur.pct > pct && !["publicado", "falhou", "fila"].includes(stage)) return; // não volta para trás
  await setJSON(`prog:${ymd}:${slot}`, { stage, pct, msg: msg || "", at: Date.now() }, 3 * 86400);
}

// Despertador externo (cron-job.org): chama /api/publish?k=CHAVE a cada 30 min, porque o agendamento do
// GitHub em repositório privado atrasa horas ou pula. Quando há post na hora, dispara o GitHub Actions na hora.
async function despertadorKey(create) {
  let k = await redis("GET", "cfg:despertador");
  if (!k && create) { k = crypto.randomBytes(18).toString("base64url"); await redis("SET", "cfg:despertador", k); }
  return k || null;
}
async function setGhToken(tk) {
  tk = String(tk || "").trim();
  if (!tk) { await redis("DEL", "cfg:ghToken"); return false; }
  if (!/^(github_pat_|ghp_)[\w]{20,}$/.test(tk)) throw new Error("Esse não parece um token do GitHub (começa com github_pat_).");
  const r = await fetch(`https://api.github.com/repos/${ghRepo()}/actions/workflows`, { headers: ghHeaders(tk), signal: AbortSignal.timeout(8000) });
  if (r.status === 401) throw new Error("O GitHub recusou esse token. Confira se copiou inteiro.");
  if (r.status === 404 || r.status === 403) throw new Error("O token não tem acesso ao repositório armetec-posts (Actions: leitura e escrita).");
  await redis("SET", "cfg:ghToken", tk);
  return true;
}
const ghRepo = () => env("GITHUB_REPO") || "Constantegabriel/armetec-posts";
const ghHeaders = (tk) => ({ Authorization: "Bearer " + tk, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "armetec-posts" });
async function dispatchWorkflow(slot) {
  const tk = env("GH_TOKEN") || (await redis("GET", "cfg:ghToken"));
  if (!tk) return { ok: false, motivo: "sem token do GitHub" };
  const r = await fetch(`https://api.github.com/repos/${ghRepo()}/actions/workflows/postar.yml/dispatches`, { method: "POST", headers: { ...ghHeaders(tk), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: slot != null ? { slot: String(slot + 1) } : {} }), signal: AbortSignal.timeout(8000) });
  if (r.status === 204) { await setJSON("cfg:ultimoDisparo", { at: Date.now(), slot }); return { ok: true }; }
  const j = await r.json().catch(() => ({}));
  return { ok: false, motivo: `GitHub respondeu ${r.status}: ${j.message || ""}`.slice(0, 160) };
}

module.exports = { despertadorKey, setGhToken, dispatchWorkflow, setProgress, igManual, getJSON, setJSON, getConfig, setConfig, getSchedule, setSchedule, siteUrl, mediaUrl, newState, takeState, newConnectLink, takeConnectLink, igReady, ttReady, igMode, setCreds, igAuthUrl, igExchange, ttAuthUrl, ttExchange,
  igToken, ttToken, igPublish, ttPublish, igStats, ttStats };

const { banco, isLogged, requireLogin, hasRedis, nowSP, postOf, safeEq, redis, isPostDay, dayOf, every } = require("./_lib");
const S = require("./_social");
// GET: redes (conexão e números), agenda, posts de hoje e o que foi publicado.
//      Aceita o login do app (o Jarvis entra com ele) ou a chave JARVIS_KEY.
// POST (com login): {instagram|tiktok|tiktokMode} liga/desliga; {agenda: [...]} salva a agenda;
//      {postarAgora: slot} põe o post na fila do próximo ciclo; {linkConexao: {net, back}} gera link de conexão;
//      {appApp: {net, id, secret}} guarda os dados do app de desenvolvedor (a chave secreta nunca é devolvida);
//      {jarvisUrl} registra o endereço do Jarvis para ele ser acordado a cada 30 min.
const jarvisOk = (req) => { const k = String(process.env.JARVIS_KEY || "").trim(); return k.length >= 16 && safeEq(String(req.headers.authorization || "").trim(), "Bearer " + k); };
const safe = (p) => p.catch((e) => ({ connected: true, error: String(e.message || e).slice(0, 200) }));
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST") {
    if (!requireLogin(req, res)) return;
    if (!hasRedis()) return res.status(503).json({ error: "redis" });
    const b = req.body || {}, out = {};
    try {
      if (Array.isArray(b.agenda)) out.agenda = await S.setSchedule(b.agenda);
      if (["instagram", "tiktok", "tiktokMode"].some((k) => k in b)) out.config = await S.setConfig(b);
      if (b.postarAgora !== undefined) {
        const s = Number(b.postarAgora); if (!(s >= 0 && s < banco.horarios.length)) return res.status(400).json({ error: "post" });
        await redis("SET", `force:${nowSP().ymd}:${s}`, "1", "EX", "7200"); out.fila = s;
        out.disparo = await S.dispatchWorkflow(null); // com o token do GitHub, sai em ~2 min em vez de esperar a próxima rodada
        await redis("DEL", `prog:${nowSP().ymd}:${s}`); await S.setProgress(nowSP().ymd, s, "fila", 5, "Na fila do agendador");
      }
      if (b.linkConexao) {
        const { net, back } = b.linkConexao;
        if (!["instagram", "tiktok"].includes(net)) return res.status(400).json({ error: "rede" });
        if (!(await (net === "instagram" ? S.igReady() : S.ttReady()))) return res.status(409).json({ error: "app_faltando", net });
        out.link = await S.newConnectLink(S.siteUrl(req), net, String(back || ""));
      }
      if (b.appApp && b.appApp.net) { await S.setCreds(b.appApp.net, b.appApp.id, b.appApp.secret, b.appApp.config); out.app = b.appApp.net; }
      if (b.igManual) { const t = await S.igManual(b.igManual.id, b.igManual.token); out.instagram = { username: t.username }; }
      if (b.desconectar && ["instagram", "tiktok"].includes(b.desconectar)) { await redis("DEL", "tok:" + b.desconectar); await S.setConfig({ [b.desconectar]: false }); out.desconectado = b.desconectar; }
      if (typeof b.ghToken === "string") { await S.setGhToken(b.ghToken); out.ghToken = true; }
      if (b.despertador) { await S.despertadorKey(true); out.despertador = true; }
      if (typeof b.jarvisUrl === "string" && /^https:\/\/[\w.-]+$/.test(b.jarvisUrl)) { await S.setJSON("cfg:jarvis", { url: b.jarvisUrl, at: Date.now() }); out.jarvis = true; }
      return res.status(200).json({ ok: true, ...out });
    } catch (e) { return res.status(400).json({ error: String(e.message || e) }); }
  }
  if (!isLogged(req) && !jarvisOk(req)) return res.status(401).json({ error: "login" });
  if (!hasRedis()) return res.status(200).json({ error: "Falta o banco Redis", today: [] });

  const { ymd, mins } = nowSP(), wd = new Date(ymd + "T12:00:00Z").getUTCDay();
  const [config, agenda, instagram, tiktok] = await Promise.all([S.getConfig(), S.getSchedule(), safe(S.igStats()), safe(S.ttStats())]);
  const today = [];
  for (let s = 0; s < agenda.length; s++) {
    const a = agenda[s];
    today.push({ slot: s + 1, time: a.time, on: a.on && isPostDay(ymd) && a.days.includes(wd), postDay: isPostDay(ymd), nets: a.nets, hook: postOf(ymd).hook, passed: toMin(a.time) <= mins,
      queued: Boolean(await redis("EXISTS", `force:${ymd}:${s}`)), progress: await S.getJSON(`prog:${ymd}:${s}`), published: (await S.getJSON(`pub:${ymd}:${s}`)) || {},
      thumb: (await redis("EXISTS", `img:${ymd}:${s}:1`)) ? S.mediaUrl(S.siteUrl(req), ymd, s, 1) : null });
  }
  // Histórico dos últimos 7 dias: quantos posts saíram em cada rede.
  // Próximo post da sequência (hoje, se ainda não saiu): para o Jarvis mostrar nos dias sem post.
  let next = null;
  for (let d = 0; d <= 60 && !next; d++) {
    const day = new Date(Date.parse(ymd + "T12:00:00Z") + d * 864e5).toISOString().slice(0, 10);
    if (!isPostDay(day)) continue;
    const rec = (await S.getJSON(`pub:${day}:0`)) || {};
    if (rec.instagram && rec.instagram.ok) continue;
    next = { ymd: day, time: agenda[0] && agenda[0].time, hook: postOf(day).hook, hoje: d === 0 };
  }
  const history = [];
  for (let d = 6; d >= 0; d--) {
    const day = new Date(Date.parse(ymd + "T12:00:00Z") - d * 864e5).toISOString().slice(0, 10), item = { ymd: day, instagram: 0, tiktok: 0, falhas: 0 };
    for (let s2 = 0; s2 < agenda.length; s2++) { const rec = await S.getJSON(`pub:${day}:${s2}`); if (!rec) continue; for (const k of ["instagram", "tiktok"]) if (rec[k]) rec[k].ok ? item[k]++ : item.falhas++; }
    history.push(item);
  }
  const used = Math.ceil(dayOf(ymd) / every()); // posts da sequência já usados até hoje
  res.status(200).json({
    ymd, config, agenda, instagram, tiktok, today, history, next,
    ultimaRodada: await S.getJSON("cfg:ultimaRodada"), lastError: { instagram: await S.getJSON("err:instagram"), tiktok: await S.getJSON("err:tiktok") }, igPending: Boolean(await S.getJSON("tok:instagram_pendente")),
    despertador: await (async () => { const k = await S.despertadorKey(true); return { url: `${S.siteUrl(req)}/api/publish?k=${k}`, ghToken: Boolean(process.env.GH_TOKEN || (await redis("GET", "cfg:ghToken"))), ultimoToque: await S.getJSON("cfg:ultimoToque"), ultimoDisparo: await S.getJSON("cfg:ultimoDisparo") }; })(),
    setup: { instagramApp: await S.igReady(), instagramMode: await S.igMode(), tiktokApp: await S.ttReady(), site: S.siteUrl(req) },
    bank: { total: banco.posts.length, postsLeft: Math.max(0, banco.posts.length - used), daysLeft: Math.max(0, (banco.posts.length - used) * every()), cadaDias: every() },
  });
};

const { redis, safeEq, nowSP, postOf, sendToAll, pushReady, isPostDay } = require("./_lib");
const S = require("./_social");
// Agendador (o GitHub Actions chama a cada 30 min, das 7h às 23h30):
//  GET  → diz quais posts estão na hora (pela agenda), avisa no celular os que são manuais e acorda o Jarvis.
//  POST ?etapa=foto → recebe um slide ou a legenda (veja _feed.js).
//  POST {ymd, slot} → posta o carrossel nas redes ligadas para aquele post. Nunca posta duas vezes o mesmo.
const NETS = ["instagram", "tiktok"];
const weekday = (ymd) => new Date(ymd + "T12:00:00Z").getUTCDay();
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

async function netsFor(slotCfg, cfg) {
  const out = [];
  for (const k of NETS) if (cfg[k] && slotCfg.nets[k] && (await S.getJSON("tok:" + k))) out.push(k);
  return out;
}
async function pingJarvis() {
  const j = await S.getJSON("cfg:jarvis");
  if (!j || !j.url) return null;
  try { const r = await fetch(j.url + "/api/cron?tipo=tick", { signal: AbortSignal.timeout(5000) }); return r.status; } catch (e) { return "sem resposta"; }
}

module.exports = async (req, res) => {
  const secret = String(process.env.CRON_SECRET || "").trim();
  const byCron = Boolean(secret) && safeEq(String(req.headers.authorization || "").trim(), "Bearer " + secret);
  let byWake = false;
  if (!byCron && req.method === "GET" && req.query && req.query.k) { const k = await S.despertadorKey(false); byWake = Boolean(k) && safeEq(String(req.query.k), k); }
  if (!byCron && !byWake) return res.status(401).end();
  if (req.method === "POST" && req.query && req.query.etapa === "foto") return require("./_feed")(req, res);
  const [cfg, agenda] = await Promise.all([S.getConfig(), S.getSchedule()]);

  if (req.method !== "POST") {
    const { ymd, mins } = nowSP(), wd = weekday(ymd), due = [], done = {}, notified = [];
    for (let s = 0; s < agenda.length; s++) {
      const a = agenda[s], rec = (await S.getJSON(`pub:${ymd}:${s}`)) || {};
      done[`${ymd}:${s}`] = rec;
      const forced = await redis("EXISTS", `force:${ymd}:${s}`);
      const diff = mins - toMin(a.time);
      const onTime = a.on && isPostDay(ymd) && a.days.includes(wd) && diff >= 0 && diff <= 75;
      if (!forced && !onTime) continue;
      // Post adiantado com "Postar agora" num dia sem post: não repete no dia dele.
      if (!forced && (await redis("EXISTS", `seqpub:${postOf(ymd).seq}`))) continue;
      const nets = (await netsFor(a, cfg)).filter((k) => !(rec[k] && rec[k].ok));
      if (nets.length) { due.push({ ymd, slot: s, nets, forced: Boolean(forced) }); await S.setProgress(ymd, s, "gerando", 15, "Preparando as imagens do carrossel"); continue; }
      // Post manual (nenhuma rede automática): avisa no celular uma vez.
      if (onTime && !(await netsFor(a, cfg)).length && (await pushReady()) && (await redis("SET", `aviso:${ymd}:${s}`, "1", "NX", "EX", "86400")) === "OK") {
        try { await sendToAll({ title: `Hora do post da Armetec · ${a.time}`, body: postOf(ymd).hook, url: "/", tag: `post-${ymd}-${s}` }); notified.push(s); } catch (e) {}
      }
    }
    await S.setJSON("cfg:ultimaRodada", { at: Date.now(), due: due.length });
    // Despertador: se há post na hora, manda o GitHub gerar e postar agora (uma vez por post a cada 20 min).
    let disparo = null;
    if (byWake) {
      await S.setJSON("cfg:ultimoToque", { at: Date.now() });
      if (due.length && (await redis("SET", `disp:${ymd}:${due.map((d) => d.slot).join("-")}`, "1", "NX", "EX", "1200")) === "OK") disparo = await S.dispatchWorkflow(null);
    }
    const jarvis = await pingJarvis();
    return res.status(200).json({ ymd, due: byWake ? due.map((d) => d.slot + 1) : due, notified, disparo, jarvis, ...(byWake ? {} : { instagram: cfg.instagram, tiktok: cfg.tiktok, done }) });
  }

  const { ymd, slot } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || "") || !(slot >= 0 && slot < agenda.length)) return res.status(400).json({ error: "dados" });
  const meta = await S.getJSON(`meta:${ymd}:${slot}`);
  if (!meta) return res.status(409).json({ error: "As fotos desse post ainda não foram enviadas." });
  const site = S.siteUrl(req), urls = [];
  for (let n = 1; n <= meta.total; n++) {
    if (!(await redis("EXISTS", `img:${ymd}:${slot}:${n}`))) return res.status(409).json({ error: `Falta o slide ${n}.` });
    urls.push(S.mediaUrl(site, ymd, slot, n));
  }
  const lock = await redis("SET", `lock:${ymd}:${slot}`, "1", "NX", "EX", "240");
  if (lock === "OK") await S.setProgress(ymd, slot, "publicando", 82, "Publicando nas redes");
  if (lock !== "OK") return res.status(409).json({ error: "Já está postando esse post." });
  const key = `pub:${ymd}:${slot}`, rec = (await S.getJSON(key)) || {}, results = {};
  const nets = await netsFor(agenda[slot], cfg);
  try {
    for (const net of nets) {
      if (rec[net] && rec[net].ok) { results[net] = { ...rec[net], skipped: true }; continue; }
      try {
        const r = net === "instagram" ? await S.igPublish(urls, meta.caption) : await S.ttPublish(urls, meta.caption, meta.hook, cfg.tiktokMode);
        rec[net] = results[net] = { ok: true, at: Date.now(), ...r };
      } catch (e) { rec[net] = results[net] = { ok: false, at: Date.now(), error: String(e.message || e).slice(0, 300) }; }
    }
    rec.hook = meta.hook;
    if (Object.values(results).some((r) => r.ok)) await redis("SET", `seqpub:${postOf(ymd).seq}`, ymd, "EX", String(120 * 86400));
    const okNets = Object.keys(results).filter((k) => results[k].ok), badNets = Object.keys(results).filter((k) => !results[k].ok);
    await S.setProgress(ymd, slot, badNets.length && !okNets.length ? "falhou" : "publicado", 100,
      badNets.length ? `Falhou: ${badNets.map((k) => k + " (" + results[k].error + ")").join("; ")}` : "Publicado ✓");
    await S.setJSON(key, rec, 30 * 86400);
    await redis("DEL", `force:${ymd}:${slot}`);
  } finally { await redis("DEL", `lock:${ymd}:${slot}`); }
  // Aviso no celular com o resultado.
  const ok = Object.entries(results).filter(([, v]) => v.ok && !v.skipped).map(([k]) => (k === "instagram" ? "Instagram" : "TikTok"));
  const bad = Object.entries(results).filter(([, v]) => !v.ok).map(([k]) => (k === "instagram" ? "Instagram" : "TikTok"));
  if ((ok.length || bad.length) && (await pushReady())) {
    try { await sendToAll({ title: bad.length ? `⚠️ Post falhou no ${bad.join(" e ")}` : `Post da Armetec publicado ✓`, body: (ok.length ? "No ar: " + ok.join(" e ") + ". " : "") + meta.hook, url: "/", tag: `pub-${ymd}-${slot}` }); } catch (e) {}
  }
  res.status(200).json({ ymd, slot, results });
};

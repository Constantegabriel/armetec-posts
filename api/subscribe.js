const { requireLogin, redis } = require("./_lib");
// Guarda (ou remove) a inscrição de notificação deste aparelho.
module.exports = async (req, res) => {
  if (!requireLogin(req, res)) return;
  if (req.method !== "POST" && req.method !== "DELETE") return res.status(405).end();
  const sub = req.body && req.body.subscription;
  if (!sub || typeof sub.endpoint !== "string" || !/^https:\/\//.test(sub.endpoint)) return res.status(400).json({ error: "inscrição inválida" });
  const clean = JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.keys && sub.keys.p256dh, auth: sub.keys && sub.keys.auth } });
  try {
    if (req.method === "POST") await redis("SADD", "subs", clean);
    else await redis("SREM", "subs", clean);
    res.status(200).json({ ok: true });
  } catch (e) { res.status(503).json({ error: "As notificações ainda não foram configuradas na Vercel." }); }
};

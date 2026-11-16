const { redis } = require("./_lib");
// Recebe do GitHub Actions os slides já desenhados (um por chamada) e a legenda do post.
// Ficam guardados 4 dias, só para o Instagram e o TikTok baixarem.
const OK_YMD = /^\d{4}-\d{2}-\d{2}$/;
// Chamado por publish.js (POST /api/publish?etapa=foto), depois de conferir o CRON_SECRET.
module.exports = async (req, res) => {
  const b = req.body || {}, slot = Number(b.slot), n = Number(b.n), total = Number(b.total);
  if (!OK_YMD.test(b.ymd || "") || !(slot >= 0 && slot < 8) || !(total > 0 && total <= 10)) return res.status(400).json({ error: "dados" });
  const TTL = String(4 * 86400);
  if (b.data) {
    if (!(n >= 1 && n <= total) || typeof b.data !== "string" || b.data.length > 3e6) return res.status(400).json({ error: "imagem" });
    const buf = Buffer.from(b.data, "base64");
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return res.status(400).json({ error: "não é JPEG" });
    await redis("SET", `img:${b.ymd}:${slot}:${n}`, b.data, "EX", TTL);
    await require("./_social").setProgress(b.ymd, slot, "enviando", Math.round(25 + (45 * n) / total), `Enviando slide ${n} de ${total}`);
    return res.status(200).json({ ok: true, n, bytes: buf.length });
  }
  await redis("SET", `meta:${b.ymd}:${slot}`, JSON.stringify({ caption: String(b.caption || "").slice(0, 2200), hook: String(b.hook || "").slice(0, 200), total }), "EX", TTL);
  res.status(200).json({ ok: true });
};

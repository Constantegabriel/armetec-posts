const { redis } = require("./_lib");
// Serve um slide guardado (/media/AAAA-MM-DD/post/n.jpg). Público, porque o Instagram e o TikTok
// precisam baixar a foto por link. São as mesmas fotos que vão para o perfil público.
// Também serve o arquivo de verificação de domínio do TikTok (/tiktokXXXX.txt), definido na Vercel em
// TIKTOK_VERIFICACAO = nome-do-arquivo.txt|conteúdo do arquivo
function verification(req, res) {
  const [name, ...rest] = String(process.env.TIKTOK_VERIFICACAO || "").trim().split("|");
  if (!name || String(req.query.f || "") !== name.trim()) return res.status(404).end();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).send(rest.join("|").trim());
}
module.exports = async (req, res) => {
  if (req.query && req.query.f) return verification(req, res);
  const { d, s, n } = req.query || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "") || !/^[1-8]$/.test(s || "") || !/^(10|[1-9])$/.test(n || "")) return res.status(404).end();
  const b64 = await redis("GET", `img:${d}:${Number(s) - 1}:${n}`).catch(() => null);
  if (!b64) return res.status(404).end();
  const buf = Buffer.from(b64, "base64");
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Length", String(buf.length));
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).end(buf);
};

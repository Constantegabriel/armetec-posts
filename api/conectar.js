const { isLogged, hasRedis } = require("./_lib");
const S = require("./_social");
// Abre a tela de autorização do Instagram ou do TikTok e recebe a volta dela
// (/api/ig-callback e /api/tt-callback chegam aqui com volta=1).
// Entrada: com login no Armetec Posts, ou com um link de uso único gerado para o Jarvis (?t=...).
const NAMES = { instagram: "Instagram", tiktok: "TikTok" };
const safeBack = (b) => (/^https:\/\/[\w.-]+(:\d+)?(\/[\w\-./?=&%]*)?$/.test(String(b || "")) ? String(b) : "");

function finish(res, back, net, extra) {
  const base = back || "/";
  res.redirect(302, base + (base.includes("?") ? "&" : "?") + "rede=" + net + "&" + extra);
}
async function callback(req, res, net) {
  const q = req.query || {};
  const st = await S.takeState(q.state, net); // o state prova que o pedido saiu daqui (vale 15 min, uso único)
  if (!st) return finish(res, "", net, "erro=" + encodeURIComponent("Link expirado, tente de novo"));
  const back = safeBack(st.back);
  const fail = async (msg) => { await S.setJSON("err:" + net, { msg: String(msg).slice(0, 500), at: Date.now() }, 7 * 86400); finish(res, back, net, "erro=" + encodeURIComponent(String(msg).slice(0, 300))); };
  if (q.error) return fail("Cancelado na Meta: " + (q.error_description || q.error_reason || q.error));
  if (!q.code) return fail("A Meta voltou sem o código de autorização.");
  try { await (net === "instagram" ? S.igExchange : S.ttExchange)(S.siteUrl(req), String(q.code)); await require("./_lib").redis("DEL", "err:" + net); finish(res, back, net, "ok=1"); }
  catch (e) { await fail(e.message); }
}
module.exports = async (req, res) => {
  if (!hasRedis()) return res.status(503).send("Falta conectar o banco Redis na Vercel.");
  const q = req.query || {};
  if (q.volta && NAMES[q.net]) return callback(req, res, q.net);
  let back = "";
  if (q.t) { const l = await S.takeConnectLink(q.t); if (!l || l.net !== q.net) return res.status(410).send("Link expirado. Volte ao Jarvis e toque em Conectar de novo."); back = safeBack(l.back); }
  else if (!isLogged(req)) return res.status(401).send("Entre no Armetec Posts primeiro.");
  const net = String(q.net || ""), site = S.siteUrl(req);
  if (net === "instagram") {
    if (!(await S.igReady())) return res.status(503).send("Falta colar o ID e a chave secreta do app do Instagram (Jarvis → Posts).");
    return res.redirect(302, await S.igAuthUrl(site, await S.newState(net, back)));
  }
  if (net === "tiktok") {
    if (!(await S.ttReady())) return res.status(503).send("Falta colar o Client key e o Client secret do app do TikTok (Jarvis → Posts).");
    return res.redirect(302, await S.ttAuthUrl(site, await S.newState(net, back)));
  }
  res.status(400).send("Rede inválida");
};

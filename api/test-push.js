const { requireLogin, sendToAll } = require("./_lib");
// Botão "Testar" do app: manda uma notificação agora.
module.exports = async (req, res) => {
  if (!requireLogin(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  try { res.status(200).json(await sendToAll({ title: "Armetec Posts", body: "Notificações ativadas. Você vai ser avisado na hora de cada post.", url: "/", tag: "test" })); }
  catch (e) { res.status(503).json({ error: "As notificações ainda não foram configuradas na Vercel." }); }
};

const { requireLogin, setupStatus } = require("./_lib");
// Mostra (só para quem entrou) o que falta configurar. Nunca devolve valores das variáveis.
module.exports = async (req, res) => {
  if (!requireLogin(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(await setupStatus());
};

const { banco, requireLogin, VAPID_PUBLIC_KEY, pushReady, hasRedis } = require("./_lib");
// Conteúdo só sai para quem fez login. Os horários seguem a agenda configurada (no Jarvis ou aqui).
module.exports = async (req, res) => {
  if (!requireLogin(req, res)) return;
  res.setHeader("Cache-Control", "private, no-cache");
  let horarios = banco.horarios;
  if (hasRedis()) { try { horarios = (await require("./_social").getSchedule()).map((a) => a.time); } catch (e) {} }
  res.status(200).json({ ...banco, horarios, vapid: VAPID_PUBLIC_KEY, push: pushReady() });
};

const { checkPassword, sessionCookie, redis, hasRedis } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  // Limite de tentativas por IP (quando o Redis está conectado): 10 a cada 15 minutos.
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (hasRedis()) {
    try {
      const n = await redis("INCR", "login:" + ip);
      if (n === 1) await redis("EXPIRE", "login:" + ip, 900);
      if (n > 10) return res.status(429).json({ error: "Muitas tentativas. Espere 15 minutos." });
    } catch (e) {}
  }
  const { email, password } = req.body || {};
  if (!checkPassword(email, password)) return res.status(401).json({ error: "Email ou senha incorretos." });
  if (hasRedis()) { try { await redis("DEL", "login:" + ip); } catch (e) {} }
  res.setHeader("Set-Cookie", sessionCookie());
  res.status(200).json({ ok: true });
};

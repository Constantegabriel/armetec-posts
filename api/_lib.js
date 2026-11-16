// Funções compartilhadas pelas rotas da API: sessão, banco de posts, Redis e push.
const crypto = require("crypto");
const banco = require("../data/banco.json");

// Login: só o hash da senha fica no código (PBKDF2-SHA256, 210 mil iterações).
const USER = {
  email: "armetecoficial@gmail.com",
  salt: "CeItOSj-Thf1s36XOMoVfw",
  hash: "tc5GcXKH7rFe_0Wv_vcbRsZtU7B3jXyF_uUzTvkgGbY",
};
const COOKIE = "ap_session";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 dias

const secret = () => String(process.env.AUTH_SECRET || "").trim() || crypto.createHash("sha256").update("armetec-posts:" + USER.hash).digest("base64url");
const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function checkPassword(email, password) {
  const h = crypto.pbkdf2Sync(String(password || ""), Buffer.from(USER.salt, "base64url"), 210000, 32, "sha256").toString("base64url");
  const okPass = safeEq(h, USER.hash);
  return okPass && String(email || "").trim().toLowerCase() === USER.email;
}
function sessionCookie() {
  const payload = Buffer.from(JSON.stringify({ e: USER.email, x: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}
const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
function isLogged(req) {
  const raw = (req.cookies && req.cookies[COOKIE]) || "";
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEq(sign(payload), sig)) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()).x > Date.now(); } catch (e) { return false; }
}
function requireLogin(req, res) {
  if (isLogged(req)) return true;
  res.status(401).json({ error: "login" });
  return false;
}

// Redis: aceita os nomes que a Vercel cria (Upstash/KV pela API REST, com ou sem prefixo,
// ou a "Redis" da aba Storage, que só dá um REDIS_URL redis://).
const env = (k) => String(process.env[k] || "").trim();
const findEnv = (re) => { const k = Object.keys(process.env).find((n) => re.test(n) && env(n)); return k ? env(k) : ""; };
const REST_URL = findEnv(/(^|_)(KV_REST_API_URL|UPSTASH_REDIS_REST_URL)$/);
const REST_TOKEN = findEnv(/(^|_)(KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN)$/);
// Qualquer variável cujo valor seja redis:// ou rediss:// serve (o nome depende do prefixo escolhido na Vercel).
const TCP_URL = (() => { const k = Object.keys(process.env).sort((a, b) => (/REDIS/.test(b) ? 1 : 0) - (/REDIS/.test(a) ? 1 : 0)).find((n) => /^rediss?:\/\//.test(env(n))); return k ? env(k) : ""; })();
const REDIS_MODE = REST_URL && REST_TOKEN ? "rest" : TCP_URL ? "tcp" : "";
let tcp = null;
// Prefixo em todas as chaves: o Armetec Posts nunca lê nem grava dados do Titan Posts, mesmo que os dois usem o mesmo banco.
const PREFIX = "armetec:";
async function redis(...cmd) {
  if (cmd.length > 1 && String(cmd[0]).toUpperCase() !== "PING") cmd = [cmd[0], PREFIX + cmd[1], ...cmd.slice(2)];
  if (REDIS_MODE === "rest") {
    const r = await fetch(REST_URL, { method: "POST", headers: { Authorization: "Bearer " + REST_TOKEN }, body: JSON.stringify(cmd) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  }
  if (REDIS_MODE === "tcp") {
    if (!tcp) {
      const Redis = require("ioredis");
      tcp = new Redis(TCP_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000, retryStrategy: (n) => (n > 2 ? null : 300) });
      tcp.on("error", () => {});
      tcp.on("end", () => { tcp = null; });
    }
    return tcp.call(...cmd);
  }
  throw new Error("redis_missing");
}
const hasRedis = () => Boolean(REDIS_MODE);

// Chaves das notificações (aceita espaços ou quebras de linha coladas sem querer).
const VAPID_PUBLIC_KEY = env("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY");
function vapidPairOk() {
  try {
    const e = crypto.createECDH("prime256v1");
    e.setPrivateKey(Buffer.from(VAPID_PRIVATE_KEY, "base64url"));
    return e.getPublicKey().toString("base64url") === VAPID_PUBLIC_KEY.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  } catch (x) { return false; }
}
const pushReady = () => hasRedis() && Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) && vapidPairOk();

// Diagnóstico sem expor valores: diz só o que está faltando.
async function setupStatus() {
  const s = { redis: REDIS_MODE || false, redisOk: false, vapidPublic: Boolean(VAPID_PUBLIC_KEY), vapidPrivate: Boolean(VAPID_PRIVATE_KEY),
    vapidPair: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) && vapidPairOk(), cronSecret: Boolean(env("CRON_SECRET")), authSecret: Boolean(env("AUTH_SECRET")) };
  if (REDIS_MODE) { try { s.redisOk = (await redis("PING")) === "PONG"; } catch (x) { s.redisError = String(x.message).slice(0, 80); } }
  const missing = [];
  if (!s.redis) missing.push("banco Redis (aba Storage → conectar ao projeto)");
  else if (!s.redisOk) missing.push("o banco Redis não respondeu");
  if (!s.vapidPublic) missing.push("variável VAPID_PUBLIC_KEY");
  if (!s.vapidPrivate) missing.push("variável VAPID_PRIVATE_KEY");
  if (s.vapidPublic && s.vapidPrivate && !s.vapidPair) missing.push("as chaves VAPID não formam um par (trocadas ou incompletas?)");
  if (!s.cronSecret) missing.push("variável CRON_SECRET");
  s.missing = missing;
  return s;
}

// Data e posts do dia no horário de Brasília.
function nowSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, mins: Number(p.hour) * 60 + Number(p.minute) };
}
// Um post a cada "cadaDias" dias a partir de "inicio" (mesma conta do slides.js).
const every = () => Math.max(1, Number(banco.cadaDias) || 1);
const dayOf = (ymd) => Math.round((Date.parse(ymd) - Date.parse(banco.inicio)) / 864e5);
// Dia de post: no ritmo de "cadaDias" e só enquanto houver post no banco (não repete conteúdo).
const isPostDay = (ymd) => { const d = dayOf(ymd); return d >= 0 && d % every() === 0 && d / every() < banco.posts.length; };
function postOf(ymd) {
  const n = banco.posts.length, seq = Math.ceil(dayOf(ymd) / every());
  const p = banco.posts[((seq % n) + n) % n];
  return { hook: ((p.pre ? p.pre + " " : "") + p.h).replace(/<[^>]+>/g, ""), k: p.k || p.f, seq };
}

async function sendToAll(payload) {
  const webpush = require("web-push");
  if (!pushReady()) throw new Error("push_not_configured");
  webpush.setVapidDetails("mailto:" + USER.email, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const subs = (await redis("SMEMBERS", "subs")) || [];
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification(JSON.parse(s), JSON.stringify(payload), { TTL: 3600, urgency: "high" }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await redis("SREM", "subs", s); }
  }));
  return { sent, total: subs.length };
}

module.exports = { isPostDay, dayOf, every, banco, checkPassword, sessionCookie, clearCookie, isLogged, requireLogin, redis, hasRedis, nowSP, postOf, sendToAll, safeEq, VAPID_PUBLIC_KEY, pushReady, setupStatus };

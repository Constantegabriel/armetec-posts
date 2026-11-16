// Gera os slides do post da vez no Chromium (mesmo desenho do app), manda para o site
// e pede para o site postar no Instagram. Roda no GitHub Actions.
//
// Variáveis: SITE_URL, CRON_SECRET. Opcionais: SLOT (1, posta o post do dia agora), YMD (AAAA-MM-DD), SO_GERAR=1 (salva em ./saida, não posta),
// SO_VERIFICAR=1 (só diz se há algo a postar, em $GITHUB_OUTPUT, para não instalar o navegador à toa).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const banco = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "banco.json"), "utf8"));
const SITE = String(process.env.SITE_URL || "").trim().replace(/\/+$/, "");
const SECRET = String(process.env.CRON_SECRET || "").trim();
const ONLY_RENDER = process.env.SO_GERAR === "1";
const ONLY_CHECK = process.env.SO_VERIFICAR === "1";
function output(k, v) { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); }

function nowSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, mins: Number(p.hour) * 60 + Number(p.minute) };
}
// O GitHub pode atrasar o agendamento; vale o horário que passou há até 90 min (ou que chega em até 20).
async function api(route, body) {
  const r = await fetch(SITE + route, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer " + SECRET, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch (e) { j = { raw: text.slice(0, 300) }; }
  if (!r.ok) throw new Error(`${route} respondeu ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  return j;
}

// Servidor local só com os arquivos do app e uma página vazia para desenhar.
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".otf": "font/otf", ".ttf": "font/ttf", ".webp": "image/webp" };
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"></head><body>
<script src="/slides.js"></script><script src="/estilos.js"></script><script src="/cenas.js"></script></body></html>`;
function serve() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (u === "/__render") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(PAGE); }
    const f = path.join(PUB, path.normalize(u));
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

async function render(ymd, slot) {
  const srv = await serve();
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/__render`);
    return await page.evaluate(async ({ bank, ymd, slot }) => {
      BANK = bank; // eslint-disable-line no-undef
      await Promise.all([loadLogo(), ...FONTS.map((f) => document.fonts.load(f))]); // eslint-disable-line no-undef
      const [y, m, d] = ymd.split("-").map(Number), date = new Date(y, m - 1, d);
      const gi = postIndex(date); // eslint-disable-line no-undef
      const post = buildPost(bank.posts[gi], gi); // eslint-disable-line no-undef
      const total = post.slides.length;
      const images = post.slides.map((s, k) => drawSlide(s, k + 1, total).toDataURL("image/jpeg", 0.92).split(",")[1]); // eslint-disable-line no-undef
      return { caption: post.caption, hook: post.hook, images };
    }, { bank: banco, ymd, slot });
  } finally { await browser.close(); srv.close(); }
}

async function postOne(ymd, slot) {
  // Se as imagens desse post já estão no site (de uma tentativa anterior), publica direto, sem desenhar de novo.
  if (!ONLY_RENDER) {
    try {
      const r = await api("/api/publish", { ymd, slot });
      console.log(`Post ${slot + 1} de ${ymd}: imagens já prontas, publicado direto.`);
      console.log(JSON.stringify(r.results, null, 2));
      return Object.entries(r.results || {}).filter(([, v]) => v && v.ok === false).map(([k, v]) => `post ${slot + 1} no ${k} (${v.error})`);
    } catch (e) { if (!/409/.test(e.message)) throw e; }
  }
  const post = await render(ymd, slot);
  console.log(`Post ${slot + 1} de ${ymd}: ${post.images.length} slides — ${post.hook}`);
  if (ONLY_RENDER) {
    const out = path.join(ROOT, "saida"); fs.mkdirSync(out, { recursive: true });
    post.images.forEach((b, k) => fs.writeFileSync(path.join(out, `${ymd}_post${slot + 1}_${String(k + 1).padStart(2, "0")}.jpg`), Buffer.from(b, "base64")));
    fs.writeFileSync(path.join(out, `${ymd}_post${slot + 1}_legenda.txt`), post.caption);
    console.log("Salvo em ./saida");
    return [];
  }
  for (let k = 0; k < post.images.length; k++) await api("/api/publish?etapa=foto", { ymd, slot, n: k + 1, total: post.images.length, data: post.images[k] });
  await api("/api/publish?etapa=foto", { ymd, slot, total: post.images.length, caption: post.caption, hook: post.hook });
  const r = await api("/api/publish", { ymd, slot });
  console.log(JSON.stringify(r.results, null, 2));
  return Object.entries(r.results || {}).filter(([, v]) => v && v.ok === false).map(([k, v]) => `post ${slot + 1} no ${k} (${v.error})`);
}

async function main() {
  // Post escolhido à mão (Run workflow → número do post) ou só gerar as fotos localmente.
  if (process.env.SLOT || ONLY_RENDER) {
    const ymd = String(process.env.YMD || "").trim() || nowSP().ymd, slot = Number(process.env.SLOT || 1) - 1;
    if (ONLY_CHECK) { output("postar", "1"); return; }
    const f = await postOne(ymd, slot);
    if (f.length) throw new Error("Falhou: " + f.join("; "));
    return;
  }
  if (!SITE || !SECRET) throw new Error("Faltam SITE_URL e/ou CRON_SECRET.");
  // O site decide pela agenda o que está na hora (e já avisa no celular os posts manuais e acorda o Jarvis).
  const check = await api("/api/publish");
  if (check.jarvis) console.log("Jarvis acordado:", check.jarvis);
  if (!check.due || !check.due.length) { console.log("Nada para postar agora."); return; }
  if (ONLY_CHECK) { output("postar", "1"); console.log("Na fila:", check.due.map((d) => `post ${d.slot + 1} (${d.nets.join("+")})`).join(", ")); return; }
  const fails = [];
  for (const d of check.due) fails.push(...(await postOne(d.ymd, d.slot)));
  if (fails.length) throw new Error("Falhou: " + fails.join("; "));
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });

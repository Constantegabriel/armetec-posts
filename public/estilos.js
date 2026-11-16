/* Visual novo dos posts da Armetec: três fundos, um para cada tipo de post.
   - Carrosséis (institucional e problema → solução): fundo escuro com grade (o fundo oficial dos carrosséis),
     Montserrat e uma onda branca que atravessa todos os slides, para o carrossel parecer uma peça só.
   - Serviço (foto única com aparelho): blueprint azul, com planta técnica da tela e carimbo.
   - Dica / frase (foto única): fundo branco com a mesma grade, em azul claro, e a onda azul.
   Usa os utilitários de slides.js (W, H, txt, hgt, rr, icon, tint, logo3d, wordmark, lineIcon, iconFor, TELAS, strip). */
const MX = 108, MWX = W - 2 * MX, ON_BLUE = "#1668FF", SOFT = "#F4F6FF";
let bgDark = null;
function loadBg() { return new Promise((r) => { const i = new Image(); i.onload = () => { bgDark = i; r(); }; i.onerror = r; i.src = "/bg/grade-escura.webp"; }); }
const _loadLogoBase = loadLogo;
loadLogo = () => Promise.all([_loadLogoBase(), loadBg()]); // eslint-disable-line no-global-assign
FONTS.push("800 40px MS", "600 40px MS", "400 40px MS", "900 40px AR", "400 40px JB", "700 40px JB");

/* ---------- peças comuns ---------- */
// Onda (fita branca) contínua: a posição vem do x "global" do carrossel, então ela passa de um slide para o outro.
function counter(ctx, i, total, { dark = true } = {}) {
  ctx.font = "38px AN"; const a = String(i).padStart(2, "0"); ctx.fillStyle = ON_BLUE; ctx.fillText(a, MX, H - 72);
  ctx.fillStyle = dark ? "#fff" : INK; ctx.fillText("/" + String(total).padStart(2, "0"), MX + ctx.measureText(a).width, H - 72);
  if (i < total) { const bw = 128, bh = 50, bx = W - MX - bw, by = H - 72 - 38;
    ctx.strokeStyle = dark ? "#fff" : INK; ctx.lineWidth = 3; rr(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + 62, by + bh / 2); ctx.lineTo(bx + bw - 26, by + bh / 2); ctx.moveTo(bx + bw - 40, by + bh / 2 - 12); ctx.lineTo(bx + bw - 26, by + bh / 2); ctx.lineTo(bx + bw - 40, by + bh / 2 + 12); ctx.stroke(); }
}
function headDark(ctx, i, total, fg = "#fff") {
  ctx.font = "36px AN"; ctx.fillStyle = fg; ctx.fillText(BANK.insta || "@armetec.br", MX, 140);
  if (i === 1) wordmark(ctx, W - MX, 146, { size: 36, color: fg, align: "right", tec: fg === "#fff" ? BLUE_2 : BLUE });
  else if (total > 1) wordmark(ctx, W / 2, H - 70, { size: 32, color: fg, align: "center", tec: fg === "#fff" ? BLUE_2 : BLUE });
}
// Título grande (Montserrat) + subtítulo colado, como nos carrosséis oficiais. Devolve o y onde o texto termina.
function titleBlock(ctx, h, sub, { y = 270, size = 118, color = "#fff", em = ON_BLUE, subColor = "#fff", w = MWX } = {}) {
  let yy = y + txt(ctx, h, { x: MX, y, w, font: `700 ${size}px MS`, lh: size * 0.86, color, em });
  if (sub) yy += txt(ctx, sub, { x: MX, y: yy - size * 0.86 + 70, w: Math.min(w, 800), font: "400 31px MS", lh: 33, color: subColor });
  return yy - size * 0.86 + 70;
}
// Slides ímpares: fundo normal; pares: espelhado. Assim a borda de um slide encontra a borda igual do próximo.
function darkBg(ctx, i = 1) {
  if (bgDark && i % 2 === 0) { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(bgDark, 0, 0, W, H); ctx.restore(); }
  else if (bgDark) ctx.drawImage(bgDark, 0, 0, W, H);
  else { ctx.fillStyle = "#050B1F"; ctx.fillRect(0, 0, W, H); }
}

/* ---------- telas escuras (iguais às dos posts oficiais) ---------- */
const D = { bg: "#0A0F1E", card: "#111A2F", line: "#1C2742", tx: "#fff", mut: "#8C98B5" };
function areaChart(ctx, x, y, w, h, seed, color = ON_BLUE) {
  const r = seeded(seed + 3), pts = Array.from({ length: 9 }, (_, k) => [x + (w * k) / 8, y + h - h * Math.min(0.95, 0.18 + k * 0.08 + (r() - 0.45) * 0.22)]);
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], mx = (x0 + x1) / 2; ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1); } };
  path(); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "rgba(22,104,255,.75)"); g.addColorStop(1, "rgba(22,104,255,.05)"); ctx.fillStyle = g; ctx.fill();
  path(); ctx.strokeStyle = "#3D86FF"; ctx.lineWidth = 3; ctx.stroke();
  const [lx, ly] = pts.at(-1); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(lx, ly, 6, 0, 7); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
}
function brandSmall(ctx, x, y, size, color = "#fff") { // ícone + Armetec pequeno dentro das telas
  icon(ctx, x, y - size * 0.85, size * 1.1, color); ctx.font = `${size}px AN`; ctx.fillStyle = color; ctx.fillText("Arme", x + size * 1.35, y); const a = ctx.measureText("Arme").width; ctx.fillStyle = BLUE_2; ctx.fillText("tec", x + size * 1.35 + a, y);
}
// Painel (tablet / notebook) em 1000x680.
function dashDark(ctx, t, seed) {
  ctx.fillStyle = D.bg; ctx.fillRect(0, 0, 1000, 680);
  ctx.fillStyle = "#0D1426"; ctx.fillRect(0, 0, 200, 680);
  brandSmall(ctx, 24, 56, 24);
  t.menu.slice(0, 7).forEach((m, k) => { const y = 100 + k * 50; if (!k) { ctx.fillStyle = ON_BLUE; rr(ctx, 14, y, 172, 38, 9); ctx.fill(); }
    ctx.strokeStyle = k ? "#8C98B5" : "#fff"; ctx.lineWidth = 2; rr(ctx, 28, y + 11, 16, 16, 4); ctx.stroke(); ctx.font = "500 16px AI"; ctx.fillStyle = k ? "#C9D2E8" : "#fff"; ctx.fillText(m, 56, y + 25); });
  ctx.font = "700 30px AI"; ctx.fillStyle = D.tx; ctx.fillText(t.titulo, 226, 62); ctx.font = "400 15px AI"; ctx.fillStyle = D.mut; ctx.fillText("Gestão da sua empresa em um só lugar", 226, 88);
  ctx.fillStyle = D.card; rr(ctx, 836, 38, 140, 36, 9); ctx.fill(); ctx.font = "500 14px AI"; ctx.fillStyle = "#C9D2E8"; ctx.fillText("Últimos 30 dias ▾", 850, 61);
  t.kpis.forEach(([l, v], k) => { const x = 226 + k * 252; ctx.fillStyle = D.card; rr(ctx, x, 112, 236, 104, 12); ctx.fill(); ctx.font = "500 15px AI"; ctx.fillStyle = D.mut; ctx.fillText(l, x + 18, 142); ctx.font = "700 32px AI"; ctx.fillStyle = D.tx; ctx.fillText(v, x + 18, 190); });
  ctx.fillStyle = D.card; rr(ctx, 226, 232, 470, 420, 12); ctx.fill(); ctx.font = "600 18px AI"; ctx.fillStyle = D.tx; ctx.fillText(t.grafico[0], 246, 268);
  ctx.font = "400 12px AI"; ctx.fillStyle = D.mut; for (let k = 0; k <= 4; k++) { ctx.fillText(100 - k * 25 + "%", 246, 310 + k * 72); ctx.fillStyle = D.line; ctx.fillRect(290, 306 + k * 72, 390, 1); ctx.fillStyle = D.mut; }
  areaChart(ctx, 290, 306, 390, 288, seed);
  ctx.fillStyle = D.card; rr(ctx, 712, 232, 264, 420, 12); ctx.fill(); ctx.font = "600 18px AI"; ctx.fillStyle = D.tx; ctx.fillText(t.lista[0], 730, 268);
  t.lista[1].forEach(([a, b], k) => { const y = 306 + k * 62; ctx.strokeStyle = "#8C98B5"; ctx.lineWidth = 2; rr(ctx, 730, y - 14, 18, 18, 4); ctx.stroke(); ctx.font = "500 14px AI"; ctx.fillStyle = "#DDE4F5"; ctx.fillText(a.length > 18 ? a.slice(0, 17) + "…" : a, 760, y); ctx.fillStyle = D.mut; ctx.textAlign = "right"; ctx.fillText(b, 958, y); ctx.textAlign = "left"; });
}
// Site (notebook) em 1000x620.
function siteDark(ctx, e) {
  const g = ctx.createLinearGradient(0, 0, 1000, 620); g.addColorStop(0, "#070C1C"); g.addColorStop(1, "#0C1631"); ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 620);
  brandSmall(ctx, 40, 58, 24);
  ctx.font = "500 15px AI"; ctx.fillStyle = "#C9D2E8"; ["Soluções", "Projetos", "Sobre"].forEach((m, k) => ctx.fillText(m, 560 + k * 90, 52));
  ctx.fillStyle = ON_BLUE; rr(ctx, 840, 28, 126, 38, 19); ctx.fill(); ctx.font = "600 15px AI"; ctx.fillStyle = "#fff"; ctx.fillText("Fale conosco", 858, 53);
  txt(ctx, (e && e.h) || "Soluções digitais <em>para o seu negócio</em>", { x: 40, y: 210, w: 470, font: "700 44px AI", lh: 54, color: "#fff", em: "#7FB0FF" });
  ctx.font = "400 17px AI"; ctx.fillStyle = "#AEB8D2"; ctx.fillText("Sites profissionais que fortalecem", 40, 360); ctx.fillText("sua marca e geram resultados.", 40, 384);
  ctx.fillStyle = ON_BLUE; rr(ctx, 40, 418, 230, 50, 25); ctx.fill(); ctx.font = "600 16px AI"; ctx.fillStyle = "#fff"; ctx.fillText("Solicite um orçamento →", 60, 449);
  // "foto" geométrica: formas em perspectiva com luz azul
  ctx.save(); ctx.beginPath(); ctx.moveTo(540, 620); ctx.lineTo(820, 120); ctx.lineTo(1000, 120); ctx.lineTo(1000, 620); ctx.closePath(); ctx.clip();
  const gg = ctx.createLinearGradient(540, 120, 1000, 620); gg.addColorStop(0, "#DCE6F7"); gg.addColorStop(0.5, "#8FA8D6"); gg.addColorStop(1, "#1B3A7A"); ctx.fillStyle = gg; ctx.fillRect(540, 100, 460, 520);
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2; for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.moveTo(600 + k * 40, 620); ctx.lineTo(840 + k * 18, 140); ctx.stroke(); }
  ctx.fillStyle = "rgba(10,20,50,.55)"; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) ctx.fillRect(760 + c * 56 + r * 10, 300 + r * 70, 40, 50);
  ctx.restore();
}
function phoneUI(ctx, t, seed) { // 380x800
  ctx.fillStyle = D.bg; ctx.fillRect(0, 0, 380, 800);
  ctx.fillStyle = ON_BLUE; ctx.fillRect(0, 0, 380, 150); brandSmall(ctx, 30, 120, 30);
  ctx.fillStyle = "#fff"; [0, 1, 2].forEach((k) => ctx.fillRect(318, 98 + k * 9, 32, 3));
  ctx.font = "700 30px AI"; ctx.fillStyle = "#fff"; ctx.fillText("Visão geral", 26, 200);
  ctx.fillStyle = D.card; rr(ctx, 240, 174, 116, 36, 18); ctx.fill(); ctx.font = "500 13px AI"; ctx.fillStyle = "#C9D2E8"; ctx.fillText("Este mês ▾", 258, 197);
  t.kpis.slice(0, 2).forEach(([l, v], k) => { const x = 22 + k * 172; ctx.fillStyle = D.card; rr(ctx, x, 226, 162, 92, 12); ctx.fill(); ctx.font = "500 13px AI"; ctx.fillStyle = D.mut; ctx.fillText(l, x + 14, 252); ctx.font = "700 24px AI"; ctx.fillStyle = "#fff"; ctx.fillText(v.length > 10 ? v.slice(0, 10) : v, x + 14, 292); });
  ctx.fillStyle = D.card; rr(ctx, 22, 334, 336, 232, 12); ctx.fill(); ctx.font = "600 17px AI"; ctx.fillStyle = "#fff"; ctx.fillText("Desempenho", 38, 366);
  areaChart(ctx, 40, 386, 300, 150, seed);
  ctx.fillStyle = D.card; rr(ctx, 22, 582, 160, 196, 12); ctx.fill(); rr(ctx, 198, 582, 160, 196, 12); ctx.fill();
  [0.45, 0.7, 0.95].forEach((v, k) => { ctx.fillStyle = ON_BLUE; rr(ctx, 44 + k * 44, 760 - 140 * v, 30, 140 * v, 5); ctx.fill(); });
  ctx.lineWidth = 18; ctx.strokeStyle = "#1C2742"; ctx.beginPath(); ctx.arc(278, 680, 50, 0, 7); ctx.stroke(); ctx.strokeStyle = ON_BLUE; ctx.beginPath(); ctx.arc(278, 680, 50, -1.57, 2.2); ctx.stroke();
  ctx.font = "700 22px AI"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText("32", 278, 688); ctx.textAlign = "left";
}
function metal(ctx, x, y, w, h) { const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#5E636D"); g.addColorStop(0.3, "#D9DCE2"); g.addColorStop(0.6, "#7C818C"); g.addColorStop(1, "#C4C8CF"); return g; }
function phoneDev(ctx, cx, cy, h, t, seed, rot = -0.32) {
  const w = h * 0.48; ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.transform(1, 0, 0.12, 1, 0, 0);
  ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 30; ctx.fillStyle = metal(ctx, -w / 2, -h / 2, w, h); rr(ctx, -w / 2, -h / 2, w, h, w * 0.17); ctx.fill(); ctx.shadowColor = "transparent";
  ctx.fillStyle = "#0A0A0C"; rr(ctx, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, w * 0.15); ctx.fill();
  const bz = w * 0.05; ctx.save(); rr(ctx, -w / 2 + bz, -h / 2 + bz, w - 2 * bz, h - 2 * bz, w * 0.13); ctx.clip(); ctx.translate(-w / 2 + bz, -h / 2 + bz); ctx.scale((w - 2 * bz) / 380, (h - 2 * bz) / 800); typeof t === "function" ? t(ctx) : phoneUI(ctx, t, seed); ctx.restore();
  ctx.fillStyle = "#000"; rr(ctx, -w * 0.16, -h / 2 + bz + 12, w * 0.32, w * 0.09, w * 0.045); ctx.fill();
  ctx.restore();
}
function tabletDev(ctx, x, y, w, t, seed) {
  const h = w * 0.68; ctx.save(); ctx.translate(x, y); ctx.transform(1, 0.05, -0.04, 1, 0, 0);
  ctx.fillStyle = "#15171C"; ctx.beginPath(); ctx.moveTo(w * 0.08, h * 0.45); ctx.lineTo(w * 0.2, h * 0.45); ctx.lineTo(w * 0.1, h + 40); ctx.lineTo(-w * 0.02, h + 40); ctx.closePath(); ctx.fill();
  ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26; ctx.fillStyle = metal(ctx, 0, 0, w, h); rr(ctx, 0, 0, w, h, 34); ctx.fill(); ctx.shadowColor = "transparent";
  ctx.fillStyle = "#0A0A0C"; rr(ctx, 6, 6, w - 12, h - 12, 30); ctx.fill();
  ctx.save(); rr(ctx, 22, 22, w - 44, h - 44, 16); ctx.clip(); ctx.translate(22, 22); ctx.scale((w - 44) / 1000, (h - 44) / 680); dashDark(ctx, t, seed); ctx.restore();
  ctx.restore();
}
function laptopDev(ctx, x, y, w, extra) {
  const sh = w * 0.6; ctx.save(); ctx.translate(x, y); ctx.transform(1, -0.03, 0, 1, 0, 0);
  ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20; ctx.fillStyle = "#1A1C22"; rr(ctx, 0, 0, w, sh, 22); ctx.fill(); ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#5A5E68"; ctx.lineWidth = 3; rr(ctx, 1.5, 1.5, w - 3, sh - 3, 22); ctx.stroke();
  ctx.save(); rr(ctx, 18, 18, w - 36, sh - 30, 6); ctx.clip(); ctx.translate(18, 18); ctx.scale((w - 36) / 1000, (sh - 30) / 620); siteDark(ctx, extra); ctx.restore();
  ctx.fillStyle = metal(ctx, -60, sh, w + 120, 40); ctx.beginPath(); ctx.moveTo(-10, sh); ctx.lineTo(w + 10, sh); ctx.lineTo(w + 70, sh + 34); ctx.lineTo(-70, sh + 34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#2A2D34"; ctx.fillRect(w * 0.06, sh + 6, w * 0.88, 10);
  ctx.fillStyle = "#9EA3AD"; rr(ctx, -70, sh + 34, w + 140, 8, 4); ctx.fill();
  ctx.restore();
}
function iconPanel(ctx, cx, cy, size, ic) {
  ctx.save(); const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size); g.addColorStop(0, "rgba(22,104,255,.45)"); g.addColorStop(1, "rgba(22,104,255,0)"); ctx.fillStyle = g; ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
  ctx.translate(cx, cy); ctx.rotate(-0.08); ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26;
  const gg = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2); gg.addColorStop(0, "#1D2B52"); gg.addColorStop(1, "#0B1124"); ctx.fillStyle = gg; rr(ctx, -size / 2, -size / 2, size, size, size * 0.2); ctx.fill(); ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(127,176,255,.45)"; ctx.lineWidth = 3; ctx.stroke();
  lineIcon(ctx, ic, -size * 0.3, -size * 0.3, size * 0.6, "#fff", 1.6); ctx.restore();
}
// Escolhe o aparelho certo para o assunto do slide.
function deviceFor(ctx, ic, top, seed, tela) {
  const t = TELAS[tela] || TELAS.financeiro, space = H - 150 - top;
  if (ic === "site" || tela === "site") return laptopDev(ctx, (W - 740) / 2, top + Math.max(20, (space - 520) / 2), 740);
  if (ic === "app") return phoneDev(ctx, W / 2 + 40, top + space / 2 + 60, Math.min(760, space + 120), t, seed);
  if (["painel", "grafico", "agenda", "caixa", "doc", "pessoas"].includes(ic) || tela) return tabletDev(ctx, (W - 720) / 2, top + Math.max(10, (space - 560) / 2), 720, t, seed);
  return iconPanel(ctx, W / 2, top + space / 2, Math.min(380, space - 60), ic);
}

/* ---------- slides dos carrosséis (escuro) ---------- */
SL.kCapa = (ctx, s, i, total) => {
  darkBg(ctx, i); logo3d(ctx, W / 2, 960, 640, { glow: false, rot: -0.22 });
  headDark(ctx, i, total); titleBlock(ctx, (s.pre ? s.pre + "\n" : "") + s.h, s.sub); counter(ctx, i, total);
};
SL.kItem = (ctx, s, i, total) => {
  darkBg(ctx, i); headDark(ctx, i, total);
  const end = titleBlock(ctx, s.t, s.p, { size: s.t.length > 34 ? 96 : 110 });
  const top = Math.max(600, end + 40);
  cena(ctx, s.fig || cenaPadrao({ ic: s.ic, tela: s.tela }), { x: MX - 20, y: top, w: MWX + 40, h: H - 170 - top }, "dark", { ic: s.ic, tela: s.tela, seed: s.seed || i, lado: i % 2 ? "esq" : "dir" });
  counter(ctx, i, total);
};
SL.kDorCapa = (ctx, s, i, total) => {
  darkBg(ctx, i); headDark(ctx, i, total);
  const end = titleBlock(ctx, s.h, s.sub, { size: 104 });
  // celular com a conversa caótica
  const top = Math.max(620, end + 40), h = H - top + 260, w = h * 0.48, cx = W / 2 + 60, cy = top + h / 2 - 40;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.22);
  ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 30; ctx.fillStyle = metal(ctx, -w / 2, -h / 2, w, h); rr(ctx, -w / 2, -h / 2, w, h, w * 0.17); ctx.fill(); ctx.shadowColor = "transparent";
  ctx.fillStyle = "#0A0A0C"; rr(ctx, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, w * 0.15); ctx.fill();
  const bz = w * 0.05; rr(ctx, -w / 2 + bz, -h / 2 + bz, w - 2 * bz, h - 2 * bz, w * 0.13); ctx.clip(); ctx.translate(-w / 2 + bz, -h / 2 + bz); ctx.scale((w - 2 * bz) / 380, (h - 2 * bz) / 800);
  ctx.fillStyle = "#0B1120"; ctx.fillRect(0, 0, 380, 800); ctx.fillStyle = "#111A2F"; ctx.fillRect(0, 0, 380, 140);
  ctx.fillStyle = "#24345E"; ctx.beginPath(); ctx.arc(52, 100, 24, 0, 7); ctx.fill(); ctx.font = "700 22px AI"; ctx.fillStyle = "#fff"; ctx.fillText("Clientes", 88, 96); ctx.font = "400 15px AI"; ctx.fillStyle = "#8C98B5"; ctx.fillText("digitando…", 88, 118);
  ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(330, 100, 20, 0, 7); ctx.fill(); ctx.font = "700 17px AI"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText("47", 330, 106); ctx.textAlign = "left";
  const caos = s.caos || ["planilha_final_v3.xlsx", "Caderno de anotações", "WhatsApp · 47 mensagens"];
  [[caos[0], 0], ["Oi, tem horário amanhã?", 1], [caos[1], 0], ["Mandou o orçamento?", 1], [caos[2], 0], ["???", 1], ["Alguém viu meu pedido?", 1], ["Preciso disso hoje!", 0]].forEach(([m, mine], k) => {
    ctx.font = "500 19px AI"; const bw = Math.min(ctx.measureText(m).width + 36, 300), bx = mine ? 356 - bw : 24, y = 168 + k * 74;
    ctx.fillStyle = mine ? ON_BLUE : "#1A2440"; rr(ctx, bx, y, bw, 52, 16); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText(m.length > 26 ? m.slice(0, 25) + "…" : m, bx + 18, y + 33);
  });
  ctx.restore();
  counter(ctx, i, total);
};
SL.kProblemas = (ctx, s, i, total) => {
  darkBg(ctx, i); headDark(ctx, i, total);
  let y = 270; y += txt(ctx, "Isso acontece <em>aí?</em>", { x: MX, y, w: MWX, font: "700 104px MS", lh: 90, color: "#fff", em: ON_BLUE });
  const io = { w: MWX - 170, font: "700 40px MS", lh: 46 }, po = { w: MWX - 170, font: "400 28px MS", lh: 34 };
  const hs = s.itens.map((it) => hgt(ctx, it.t, io) + 14 + hgt(ctx, it.p, po) + 70), gap = 26, tot = hs.reduce((a, b) => a + b + gap, 0);
  y = Math.max(y - 20, (H - 150 + y - tot) / 2);
  s.itens.forEach((it, k) => {
    ctx.save(); ctx.fillStyle = "rgba(8,14,32,.88)"; rr(ctx, MX, y, MWX, hs[k], 28); ctx.fill(); ctx.strokeStyle = "rgba(127,176,255,.28)"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    ctx.fillStyle = "rgba(255,90,95,.15)"; ctx.beginPath(); ctx.arc(MX + 72, y + 72, 40, 0, 7); ctx.fill(); lineIcon(ctx, "x", MX + 52, y + 52, 40, RED, 3);
    let yy = y + 36 + 40; yy += txt(ctx, it.t, { ...io, x: MX + 140, y: yy, color: "#fff", em: "#7FB0FF" });
    txt(ctx, it.p, { ...po, x: MX + 140, y: yy - 46 + 14 + 34, color: "#B7C2DD" });
    y += hs[k] + gap;
  });
  counter(ctx, i, total);
};
SL.kSolucao = (ctx, s, i, total) => {
  darkBg(ctx, i); headDark(ctx, i, total);
  let y = 270; y += txt(ctx, s.h, { x: MX, y, w: MWX, font: "700 100px MS", lh: 88, color: "#fff", em: ON_BLUE });
  y += 10;
  const io = { w: MWX - 110, font: "600 36px MS", lh: 42 };
  s.itens.forEach((t) => {
    const h = Math.max(64, hgt(ctx, t, io)); ctx.fillStyle = ON_BLUE; ctx.beginPath(); ctx.arc(MX + 32, y + 20, 32, 0, 7); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(MX + 18, y + 21); ctx.lineTo(MX + 28, y + 31); ctx.lineTo(MX + 47, y + 10); ctx.stroke(); ctx.lineCap = "butt";
    txt(ctx, t, { ...io, x: MX + 92, y: y + 34, color: "#fff", em: "#fff" }); y += h + 36;
  });
  counter(ctx, i, total);
};
SL.kCase = (ctx, s, i, total) => {
  darkBg(ctx, i); headDark(ctx, i, total);
  const end = titleBlock(ctx, s.t, s.p, { size: 96 });
  tabletDev(ctx, (W - 720) / 2, Math.max(640, end + 60), 720, TELAS[s.tela] || TELAS.barbearia, 5); counter(ctx, i, total);
};
SL.kCta = (ctx, s, i, total) => {
  darkBg(ctx, i);
  ctx.font = "36px AN"; ctx.fillStyle = "#fff"; ctx.fillText(BANK.insta || "@armetec.br", MX, 140); wordmark(ctx, W - MX, 146, { size: 36, color: "#fff", align: "right", tec: BLUE_2 });
  logo3d(ctx, W / 2, 470, 400, { glow: false, rot: 0.15 });
  let y = 830; y += txt(ctx, s.h, { x: MX, y, w: MWX, font: "700 92px MS", lh: 84, color: "#fff", em: ON_BLUE, align: "center" });
  txt(ctx, s.p, { x: MX + 40, y: y - 84 + 56, w: MWX - 80, font: "400 30px MS", lh: 36, color: "#fff", align: "center" });
  ctx.font = "700 38px MS"; const site = BANK.site || "armetec.com.br", bw = ctx.measureText(site).width + 120, bx = (W - bw) / 2, by = 1100;
  ctx.fillStyle = ON_BLUE; rr(ctx, bx, by, bw, 96, 48); ctx.fill(); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(site, W / 2, by + 50); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  counter(ctx, i, total);
};

/* ---------- serviço: blueprint azul ---------- */
function bpBg(ctx, tag) {
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0F4FD8"); g.addColorStop(1, "#1668FF"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,.08)";
  for (let x = 0; x <= W; x += 27.5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y <= H; y += 27.5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = "rgba(255,255,255,.2)"; for (let x = 47; x <= W; x += 110) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 79; y <= H; y += 110) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeRect(40, 40, W - 80, H - 80);
  const bx = W - 40 - 520, by = H - 40 - 130; ctx.lineWidth = 2; ctx.strokeRect(bx, by, 520, 130); ctx.beginPath(); ctx.moveTo(bx, by + 65); ctx.lineTo(bx + 520, by + 65); ctx.moveTo(bx + 300, by); ctx.lineTo(bx + 300, by + 130); ctx.stroke();
  ctx.font = "400 18px JB"; ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillText("PROJETO", bx + 16, by + 24); ctx.fillText("SERVIÇO", bx + 316, by + 24); ctx.fillText("CONTATO", bx + 16, by + 89); ctx.fillText("SITE", bx + 316, by + 89);
  ctx.font = "700 24px JB"; ctx.fillStyle = "#fff"; ctx.fillText("ARMETEC", bx + 16, by + 54); ctx.font = "700 20px JB"; ctx.fillText(tag.slice(0, 16).toUpperCase(), bx + 316, by + 54); ctx.font = "700 24px JB"; ctx.fillText(BANK.insta || "@armetec.br", bx + 16, by + 119); ctx.font = "700 20px JB"; ctx.fillText(BANK.site || "armetec.com.br", bx + 316, by + 119);
}
function bpDim(ctx, x1, y1, x2, y2, label) {
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const tick = (x, y) => { ctx.beginPath(); ctx.moveTo(x - 9, y + 9); ctx.lineTo(x + 9, y - 9); ctx.stroke(); }; tick(x1, y1); tick(x2, y2);
  ctx.font = "400 20px JB"; ctx.fillStyle = "#fff"; ctx.fillText(label, (x1 + x2) / 2 + 12, (y1 + y2) / 2 - 12);
}
// Planta técnica da tela: navegador (site) ou painel (sistemas), com chamadas A, B, C.
function bpWire(ctx, tela, x, y, w, h, seed) {
  const t = TELAS[tela] || TELAS.financeiro; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, y + 46); ctx.lineTo(x + w, y + 46); ctx.stroke();
  [0, 1, 2].forEach((k) => { ctx.beginPath(); ctx.arc(x + 28 + k * 26, y + 23, 7, 0, 7); ctx.stroke(); });
  ctx.lineWidth = 2; const calls = [];
  if (tela === "site") {
    ctx.strokeRect(x + 36, y + 90, w * 0.42, 40); ctx.strokeRect(x + 36, y + 150, w * 0.34, 22); ctx.strokeRect(x + 36, y + 186, w * 0.38, 22); ctx.strokeRect(x + 36, y + 240, 170, 52);
    const ix = x + w * 0.55, iw = w * 0.4, ih = h - 120; ctx.beginPath(); ctx.rect(ix, y + 80, iw, ih); ctx.moveTo(ix, y + 80); ctx.lineTo(ix + iw, y + 80 + ih); ctx.moveTo(ix + iw, y + 80); ctx.lineTo(ix, y + 80 + ih); ctx.stroke();
    calls.push([x + 36 + w * 0.42, y + 110, "A — título que vende"], [x + 206, y + 266, "B — botão de WhatsApp"], [ix + iw, y + 80 + ih / 2, "C — rápido no celular"]);
  } else {
    const sx = x + 150; ctx.beginPath(); ctx.moveTo(sx, y + 46); ctx.lineTo(sx, y + h); ctx.stroke();
    for (let k = 0; k < 6; k++) ctx.strokeRect(x + 22, y + 74 + k * 40, 106, 20);
    const cw = (x + w - sx - 30 - 2 * 16) / 3; t.kpis.forEach((_, k) => { const kx = sx + 15 + k * (cw + 16); ctx.strokeRect(kx, y + 70, cw, 70); ctx.strokeRect(kx + 14, y + 86, cw * 0.45, 10); ctx.strokeRect(kx + 14, y + 108, cw * 0.65, 18); });
    const gx = sx + 15, gy = y + 160, gw = (x + w - sx) * 0.58, gh = h - 180; ctx.strokeRect(gx, gy, gw, gh);
    const r = seeded(seed + 9); ctx.beginPath(); for (let k = 0; k <= 7; k++) { const px = gx + 20 + ((gw - 40) * k) / 7, py = gy + gh - 20 - (gh - 50) * Math.min(0.95, 0.15 + k * 0.1 + (r() - 0.4) * 0.2); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
    const lx = gx + gw + 16, lw = x + w - 15 - lx; ctx.strokeRect(lx, gy, lw, gh); for (let k = 0; k < 4; k++) { ctx.strokeRect(lx + 14, gy + 24 + k * 44, 16, 16); ctx.strokeRect(lx + 42, gy + 27 + k * 44, lw - 60, 10); }
    calls.push([sx + 15 + cw, y + 105, "A — " + t.kpis[0][0].toLowerCase()], [gx + gw / 2, gy + 20, "B — " + t.grafico[0].toLowerCase()], [lx + lw, gy + gh / 2, "C — " + t.lista[0].toLowerCase()]);
  }
  return calls;
}
SL.bpServico = (ctx, s) => {
  bpBg(ctx, s.k || "Sistema");
  ctx.font = "400 22px JB"; ctx.fillStyle = "#fff"; ctx.fillText("FIG. 01 — " + strip(s.k || "Serviço").toUpperCase(), 90, 118);
  // título em caixa alta; o destaque vira marca-texto branco
  const segs = parseRich(s.h.toUpperCase().replace(/<\/?EM>/g, (m) => m.toLowerCase())); ctx.font = "900 82px AR";
  const words = []; segs.forEach((sg) => sg.t.split(/(\s+)/).forEach((t) => t && words.push({ t, em: sg.em })));
  const lines = [[]]; let lw = 0; for (const w of words) { const ww = ctx.measureText(w.t).width; if (/^\s+$/.test(w.t)) { if (lines.at(-1).length) { lines.at(-1).push(w); lw += ww; } continue; } if (lw + ww > W - 180 && lines.at(-1).length) { lines.push([]); lw = 0; } lines.at(-1).push(w); lw += ww; }
  let y = 230; lines.forEach((ln) => { while (ln.length && /^\s+$/.test(ln.at(-1).t)) ln.pop(); let x = 90; ln.forEach((w) => { const ww = ctx.measureText(w.t).width; if (w.em && !/^\s+$/.test(w.t)) { ctx.fillStyle = "#fff"; ctx.fillRect(x - 8, y - 70, ww + 16, 86); } ctx.fillStyle = w.em ? "#0F4FD8" : "#fff"; ctx.fillText(w.t, x, y); x += ww; }); y += 92; });
  if (s.sub) y += txt(ctx, s.sub, { x: 90, y: y + 8, w: W - 200, font: "400 26px JB", lh: 38, color: "rgba(255,255,255,.9)" });
  const top = Math.max(y + 50, 560), box = { x: 100, y: top + 30, w: W - 200, h: H - 250 - top };
  // cotas da "planta" em volta da figura
  ctx.save(); ctx.setLineDash([10, 10]); ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 2; ctx.strokeRect(box.x - 10, box.y - 10, box.w + 20, box.h + 20); ctx.restore();
  bpDim(ctx, box.x - 10, box.y - 34, box.x + box.w + 10, box.y - 34, s.tela === "site" ? "celular e computador" : "sob medida para a sua rotina");
  cena(ctx, s.fig || cenaPadrao({ tela: s.tela }), box, "blue", { tela: s.tela, seed: s.seed || 1, lado: (s.seed || 1) % 2 ? "esq" : "dir", telaExtra: s.telaExtra, ...(s.cena || {}) });
};

/* ---------- dica: branco com grade azul e onda azul ---------- */
function lightBg(ctx) {
  ctx.fillStyle = "#F7F9FD"; ctx.fillRect(0, 0, W, H);
  const glow = (x) => { const g = ctx.createRadialGradient(x, 800, 0, x, 800, 380); g.addColorStop(0, "rgba(22,104,255,.16)"); g.addColorStop(1, "rgba(22,104,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  glow(0); glow(W);
  ctx.strokeStyle = "rgba(22,104,255,.10)"; ctx.lineWidth = 1.5;
  for (let x = 47; x <= W; x += 110) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 79; y <= H; y += 101) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}
SL.dica = (ctx, s) => {
  lightBg(ctx);
  ctx.font = "36px AN"; ctx.fillStyle = INK; ctx.fillText(BANK.insta || "@armetec.br", MX, 140); wordmark(ctx, W - MX, 146, { size: 36, color: INK, align: "right" });
  ctx.fillStyle = ON_BLUE; rr(ctx, MX, 196, 150, 52, 26); ctx.fill(); ctx.font = "700 24px MS"; ctx.fillStyle = "#fff"; ctx.letterSpacing = "4px"; ctx.fillText("DICA", MX + 30, 231); ctx.letterSpacing = "0px";
  const size = strip(s.h).length <= 26 ? 124 : strip(s.h).length <= 40 ? 108 : 92, lh = size * 0.9;
  let y = 250 + size; y += txt(ctx, s.h, { x: MX, y, w: MWX, font: `800 ${size}px MS`, lh, color: INK, em: ON_BLUE });
  if (s.sub) y += txt(ctx, s.sub, { x: MX, y: y - lh + 62, w: 820, font: "500 32px MS", lh: 40, color: "rgba(11,18,32,.72)" }) - lh + 62;
  const top = Math.max(y + 20, 560);
  cena(ctx, s.fig || "lista", { x: MX - 30, y: top, w: MWX + 60, h: H - 130 - top }, "light", { seed: s.seed || 1, lado: (s.seed || 1) % 2 ? "esq" : "dir", ...(s.cena || {}) });
  ctx.font = "600 28px MS"; ctx.fillStyle = INK; ctx.fillText(BANK.site || "armetec.com.br", MX, H - 72);
};

/* ---------- figuras dos posts de foto única ---------- */
// Celular com tela clara (dica): saudação, tarefas do dia com check e um anel de progresso.
function phoneLightUI(ctx) {
  ctx.fillStyle = "#F5F7FC"; ctx.fillRect(0, 0, 380, 800);
  ctx.fillStyle = ON_BLUE; ctx.fillRect(0, 0, 380, 190); brandSmall(ctx, 30, 120, 30);
  ctx.font = "700 26px AI"; ctx.fillStyle = "#fff"; ctx.fillText("Bom dia!", 30, 168);
  ctx.fillStyle = "#fff"; rr(ctx, 22, 214, 336, 150, 18); ctx.fill();
  ctx.lineWidth = 14; ctx.strokeStyle = "#E3EAF8"; ctx.beginPath(); ctx.arc(96, 289, 46, 0, 7); ctx.stroke(); ctx.strokeStyle = ON_BLUE; ctx.beginPath(); ctx.arc(96, 289, 46, -1.57, 3.6); ctx.stroke();
  ctx.font = "800 22px AI"; ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.fillText("82%", 96, 297); ctx.textAlign = "left";
  ctx.font = "700 20px AI"; ctx.fillText("Rotina em dia", 168, 276); ctx.font = "400 16px AI"; ctx.fillStyle = "#6B7690"; ctx.fillText("9 de 11 tarefas", 168, 302);
  ctx.font = "700 20px AI"; ctx.fillStyle = INK; ctx.fillText("Hoje", 26, 410);
  [["Confirmar agenda", 1], ["Enviar orçamento", 1], ["Revisar pedidos", 0], ["Fechar o caixa", 0]].forEach(([t, ok], k) => {
    const y = 432 + k * 86; ctx.fillStyle = "#fff"; rr(ctx, 22, y, 336, 72, 14); ctx.fill();
    ctx.fillStyle = ok ? ON_BLUE : "#fff"; ctx.strokeStyle = ok ? ON_BLUE : "#C5CEDD"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(58, y + 36, 15, 0, 7); ctx.fill(); ctx.stroke();
    if (ok) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(51, y + 36); ctx.lineTo(56, y + 42); ctx.lineTo(66, y + 30); ctx.stroke(); }
    ctx.font = "600 18px AI"; ctx.fillStyle = ok ? "#8A94AA" : INK; ctx.fillText(t, 88, y + 43);
  });
}
// Celular com um site aberto (serviço de sites).
function phoneSiteUI(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, 800); g.addColorStop(0, "#070C1C"); g.addColorStop(1, "#0C1631"); ctx.fillStyle = g; ctx.fillRect(0, 0, 380, 800);
  brandSmall(ctx, 26, 112, 24); ctx.fillStyle = "#fff"; [0, 1, 2].forEach((k) => ctx.fillRect(320, 94 + k * 9, 32, 3));
  txt(ctx, "Seu negócio <em>em destaque</em> na internet", { x: 26, y: 210, w: 320, font: "700 36px AI", lh: 44, color: "#fff", em: "#7FB0FF" });
  ctx.font = "400 16px AI"; ctx.fillStyle = "#AEB8D2"; ctx.fillText("Rápido, bonito e feito para vender.", 26, 380);
  ctx.fillStyle = ON_BLUE; rr(ctx, 26, 410, 328, 56, 28); ctx.fill(); ctx.font = "700 17px AI"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText("Falar no WhatsApp", 190, 444); ctx.textAlign = "left";
  const gg = ctx.createLinearGradient(26, 490, 354, 770); gg.addColorStop(0, "#DCE6F7"); gg.addColorStop(0.5, "#8FA8D6"); gg.addColorStop(1, "#1B3A7A"); ctx.fillStyle = gg; rr(ctx, 26, 490, 328, 280, 18); ctx.fill();
  ctx.fillStyle = "rgba(10,20,50,.5)"; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(70 + c * 66 + r * 8, 560 + r * 66, 44, 46);
}
// Cartão flutuante (notificação) com sombra.
function floatCard(ctx, x, y, w, ic, title, sub, color = ON_BLUE, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.shadowColor = "rgba(15,40,100,.22)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18; ctx.fillStyle = "#fff"; rr(ctx, 0, 0, w, 116, 26); ctx.fill(); ctx.shadowColor = "transparent";
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(60, 58, 34, 0, 7); ctx.fill(); lineIcon(ctx, ic, 43, 41, 34, "#fff", 2.4);
  ctx.font = "700 27px MS"; ctx.fillStyle = INK; ctx.fillText(title, 112, 52); ctx.font = "400 22px MS"; ctx.fillStyle = "#6B7690"; ctx.fillText(sub, 112, 84);
  ctx.restore();
}

/* ---------- montagem: cada formato ganha o seu fundo ---------- */
buildPost = function (p, gi) { // eslint-disable-line no-global-assign
  const slides = [], card = ([t, x, ic], k, fb) => ({ n: String(k + 1).padStart(2, "0"), t, p: x, ic: ic || iconFor(t, fb) });
  if (p.f === "institucional") {
    slides.push({ type: "kCapa", pre: p.pre, h: p.h, sub: p.sub });
    p.itens.forEach((it, k) => slides.push({ type: "kItem", ...card(it, k, "check"), fig: it[3], seed: gi * 7 + k }));
  } else if (p.f === "dor") {
    slides.push({ type: "kDorCapa", k: p.k, h: p.h, sub: p.sub, caos: p.caos });
    slides.push({ type: "kProblemas", itens: p.itens.map((it, k) => card(it, k)) });
    slides.push({ type: "kSolucao", h: p.sol.h, itens: p.sol.itens });
    if (p.case) slides.push({ type: "kCase", t: p.case.t, p: p.case.p, tela: p.case.tela });
  } else if (p.f === "mockup") {
    slides.push({ type: "bpServico", k: p.k, h: p.h, sub: p.sub, tela: p.tela, fig: p.fig, cena: p.cena, telaExtra: p.telaExtra, seed: gi + 1 });
  } else {
    slides.push({ type: "dica", h: p.h, sub: p.sub, fig: p.fig, cena: p.cena, seed: gi + 1 });
  }
  if (slides.length > 1) { const c = p.cta || CTAS[gi % CTAS.length]; slides.push({ type: "kCta", h: c[0], p: c[1] }); }
  const hook = strip((p.pre ? p.pre + " " : "") + p.h), body = p.leg || strip(p.sub || "");
  const caption = hook + "\n\n" + (body ? body + "\n\n" : "") + FECHO[gi % FECHO.length] + "\n\n" + TAGS[gi % TAGS.length];
  return { slides, caption, hook, k: p.k || p.f, f: p.f };
};

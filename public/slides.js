/* Desenha os posts da Armetec (1080x1350, 4:5) no canvas e monta cada post a partir do banco.
   Formatos: "institucional" (carrossel escuro com logo 3D), "dor" (carrossel problema → solução),
   "mockup" (foto única, fundo claro, computador + celular com tela de sistema) e "frase" (foto única). */
const LOGO = "/icons/logo.png";
const W = 1080, H = 1350, X = 84, MW = W - 2 * X;
const BLUE = "#1668FF", BLUE_2 = "#4D8DFF", NAVY = "#050B1F", INK = "#0B1220", PAPER = "#F3F6FC", RED = "#FF5A5F", GREEN = "#16B364";
const FONTS = ["800 40px AJ", "700 40px AJ", "40px AN", "500 40px AI", "600 40px AI", "700 40px AI", "800 40px AM"];
let BANK = null;

/* ---------- datas ---------- */
function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function dayIndex(date) { const [y, m, d] = BANK.inicio.split("-").map(Number); return Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(y, m - 1, d)) / 864e5); }
// Um post a cada "cadaDias" dias, a partir de "inicio". Dia sem post → null.
const every = () => Math.max(1, Number(BANK.cadaDias) || 1);
function isPostDay(date) { const d = dayIndex(date); return ((d % every()) + every()) % every() === 0; }
function postSeq(date) { return Math.ceil(dayIndex(date) / every()); } // número do post na sequência (0, 1, 2…)
function postIndex(date) { const n = BANK.posts.length; return ((postSeq(date) % n) + n) % n; }

/* ---------- texto ---------- */
function parseRich(html) { const out = []; html.split(/(<em>.*?<\/em>)/).forEach((p) => { if (!p) return; const e = p.startsWith("<em>"); out.push({ t: e ? p.slice(4, -5) : p, em: e }); }); return out; }
function wrapRich(ctx, segs, maxW) {
  const words = []; segs.forEach((s) => s.t.split(/(\s+|\n)/).forEach((w) => { if (w) words.push({ t: w, em: s.em }); }));
  const lines = [[]]; let w = 0;
  for (const wd of words) {
    if (wd.t === "\n") { lines.push([]); w = 0; continue; }
    const ww = ctx.measureText(wd.t).width;
    if (/^\s+$/.test(wd.t)) { if (lines.at(-1).length) { lines.at(-1).push(wd); w += ww; } continue; }
    if (w + ww > maxW && lines.at(-1).length) { while (lines.at(-1).length && /^\s+$/.test(lines.at(-1).at(-1).t)) lines.at(-1).pop(); lines.push([]); w = 0; }
    lines.at(-1).push(wd); w += ww;
  }
  lines.forEach((ln) => { while (ln.length && /^\s+$/.test(ln.at(-1).t)) ln.pop(); });
  return lines;
}
// o: {x, y, w, font, lh, color, em, align}. y é a linha de base da primeira linha. Devolve a altura usada.
function txt(ctx, text, o) {
  ctx.font = o.font; const lines = wrapRich(ctx, parseRich(text), o.w);
  lines.forEach((ln, i) => {
    const width = ln.reduce((a, w) => a + ctx.measureText(w.t).width, 0);
    let cx = o.align === "center" ? o.x + (o.w - width) / 2 : o.x;
    ln.forEach((w) => { ctx.fillStyle = w.em ? o.em || o.color : o.color; ctx.fillText(w.t, cx, o.y + i * o.lh); cx += ctx.measureText(w.t).width; });
  });
  return lines.length * o.lh;
}
const hgt = (ctx, text, o) => { ctx.font = o.font; return wrapRich(ctx, parseRich(text), o.w).length * o.lh; };
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function label(ctx, s, x, y, color, size = 24, spacing = 4, align = "left") {
  ctx.font = `700 ${size}px AI`; ctx.letterSpacing = spacing + "px"; ctx.fillStyle = color; ctx.textAlign = align;
  ctx.fillText(s, x, y); const w = ctx.measureText(s).width; ctx.letterSpacing = "0px"; ctx.textAlign = "left"; return w;
}
function pill(ctx, s, x, y, bg, fg, size = 24) {
  ctx.font = `700 ${size}px AI`; ctx.letterSpacing = "4px"; const w = ctx.measureText(s).width + 48; ctx.letterSpacing = "0px";
  ctx.fillStyle = bg; rr(ctx, x, y, w, size + 30, (size + 30) / 2); ctx.fill();
  label(ctx, s, x + 24, y + size + 7, fg, size); return w;
}
const stack = (parts, top, bottom) => top + (bottom - top - parts.reduce((a, p) => a + p, 0)) / 2;
const strip = (s) => String(s || "").replace(/<[^>]+>/g, "");

/* ---------- logo ---------- */
let logoImg = null; const tinted = {};
function loadLogo() { return new Promise((r) => { const i = new Image(); i.onload = () => { logoImg = i; r(); }; i.onerror = r; i.src = LOGO; }); }
function tint(color) {
  if (tinted[color]) return tinted[color];
  const c = document.createElement("canvas"); c.width = logoImg.width; c.height = logoImg.height; const g = c.getContext("2d");
  g.drawImage(logoImg, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return (tinted[color] = c);
}
function icon(ctx, x, y, s, color = "#fff") { if (logoImg) ctx.drawImage(color === "#fff" ? logoImg : tint(color), x, y, s, s); }
// Marca: ícone + "Arme" + "tec" (azul), em Nasalization.
function wordmark(ctx, x, y, { size = 34, color = "#fff", align = "left", tec = null } = {}) {
  ctx.font = `${size}px AN`; const a = ctx.measureText("Arme").width, b = ctx.measureText("tec").width, is = size * 1.15, gap = size * 0.3;
  const total = is + gap + a + b, x0 = align === "right" ? x - total : align === "center" ? x - total / 2 : x;
  icon(ctx, x0, y - is * 0.78, is, color);
  ctx.textBaseline = "alphabetic"; ctx.fillStyle = color; ctx.fillText("Arme", x0 + is + gap, y); ctx.fillStyle = tec || (color === "#fff" ? BLUE_2 : BLUE); ctx.fillText("tec", x0 + is + gap + a, y);
  return total;
}
// Logo em relevo: camadas deslocadas (profundidade), face clara com degradê e brilho atrás.
function logo3d(ctx, cx, cy, size, { glow = true, rot = -0.18 } = {}) {
  if (!logoImg) return;
  ctx.save(); ctx.translate(cx, cy);
  if (glow) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.75); g.addColorStop(0, "rgba(22,104,255,.55)"); g.addColorStop(1, "rgba(22,104,255,0)"); ctx.fillStyle = g; ctx.fillRect(-size, -size, size * 2, size * 2); }
  ctx.rotate(rot);
  const depth = Math.round(size * 0.05), side = tint("#7F8BA6"), dark = tint("#3A4560");
  ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = size * 0.08; ctx.shadowOffsetY = size * 0.05;
  ctx.drawImage(dark, -size / 2 + depth, -size / 2 + depth * 1.2, size, size); ctx.shadowColor = "transparent";
  for (let d = depth; d > 0; d--) ctx.drawImage(d > depth * 0.5 ? dark : side, -size / 2 + d, -size / 2 + d * 1.2, size, size);
  // face: branco com sombreado azulado de baixo para cima
  const c = document.createElement("canvas"); c.width = c.height = Math.ceil(size); const g2 = c.getContext("2d");
  g2.drawImage(logoImg, 0, 0, size, size); g2.globalCompositeOperation = "source-atop";
  const lg = g2.createLinearGradient(0, 0, size, size); lg.addColorStop(0, "#FFFFFF"); lg.addColorStop(0.55, "#E9EEF8"); lg.addColorStop(1, "#AEB9D0");
  g2.fillStyle = lg; g2.fillRect(0, 0, size, size);
  ctx.drawImage(c, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/* ---------- fundos ---------- */
function bgTech(ctx, { glowX = W * 0.75, glowY = H * 0.62 } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#030817"); g.addColorStop(1, "#071437"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const r = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 760); r.addColorStop(0, "rgba(22,104,255,.38)"); r.addColorStop(1, "rgba(22,104,255,0)"); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(77,141,255,.13)"; ctx.lineWidth = 1.5;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
  ctx.fillStyle = "rgba(140,180,255,.35)";
  for (let x = 0; x <= W; x += 240) for (let y = 0; y <= H; y += 240) { ctx.fillRect(x - 7, y - 1, 14, 3); ctx.fillRect(x - 1, y - 7, 3, 14); }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.55)"); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
function bgLight(ctx) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const r = ctx.createRadialGradient(W, H, 0, W, H, 900); r.addColorStop(0, "rgba(22,104,255,.16)"); r.addColorStop(1, "rgba(22,104,255,0)"); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  const r2 = ctx.createRadialGradient(0, 0, 0, 0, 0, 700); r2.addColorStop(0, "rgba(255,255,255,.9)"); r2.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(22,104,255,.06)"; ctx.lineWidth = 1.5;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
}
function bgBlue(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0E4FD6"); g.addColorStop(0.6, BLUE); g.addColorStop(1, "#3C86FF"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 1.5;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
  ctx.globalAlpha = 0.07; icon(ctx, W - 560, H - 600, 760); ctx.globalAlpha = 1;
}

/* ---------- moldura do carrossel ---------- */
function chrome(ctx, i, total, { dark = true, arrow = true, blue = false } = {}) {
  const fg = dark ? "#fff" : INK, mut = dark ? "rgba(255,255,255,.75)" : "rgba(11,18,32,.6)", accent = blue ? "#fff" : dark ? BLUE_2 : BLUE;
  ctx.font = "600 30px AI"; ctx.fillStyle = mut; ctx.fillText(BANK.insta || "@armetec.br", X, 118);
  wordmark(ctx, W - X, 120, { size: 32, color: fg, align: "right", tec: blue ? "#BFD5FF" : null });
  if (total > 1) {
    ctx.font = "700 34px AI"; const a = String(i).padStart(2, "0"); ctx.fillStyle = accent; ctx.fillText(a, X, H - 86);
    const aw = ctx.measureText(a).width; ctx.fillStyle = mut; ctx.fillText("/" + String(total).padStart(2, "0"), X + aw, H - 86);
    if (arrow && i < total) {
      const bw = 104, bh = 50, bx = W - X - bw, by = H - 86 - 36;
      ctx.strokeStyle = fg; ctx.lineWidth = 3; rr(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + 30, by + bh / 2); ctx.lineTo(bx + bw - 30, by + bh / 2); ctx.moveTo(bx + bw - 44, by + bh / 2 - 12); ctx.lineTo(bx + bw - 30, by + bh / 2); ctx.lineTo(bx + bw - 44, by + bh / 2 + 12); ctx.stroke();
    }
  }
}

/* ---------- mockups ---------- */
function seeded(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const TELAS = {
  financeiro: { marca: "Sua Empresa", titulo: "Resumo da empresa", menu: ["Visão geral", "Agenda", "Equipe", "Clientes", "Produtos", "Orçamentos", "Financeiro", "Relatórios"],
    kpis: [["Faturamento", "R$ 48.000", "+12%"], ["Despesas", "R$ 32.000", "+4%"], ["Resultado", "R$ 16.000", "+21%"]], grafico: ["Fluxo de caixa", "linha"],
    lista: ["Tarefas da equipe", [["Revisar proposta", "Hoje"], ["Enviar orçamento", "Amanhã"], ["Confirmar reunião", "16 Mai"], ["Atualizar estoque", "18 Mai"]]],
    fone: ["Minha agenda", [["10h", "Reunião", "Com a Ana"], ["14h", "Visita técnica", "Cliente novo"], ["16h", "Alinhamento", "Equipe"]]] },
  agenda: { marca: "Clínica Vida", titulo: "Agenda de hoje", menu: ["Agenda", "Pacientes", "Profissionais", "Salas", "Financeiro", "Lembretes", "Relatórios"],
    kpis: [["Atendimentos", "18", "+3"], ["Confirmados", "15", "83%"], ["Faltas", "1", "-2"]], grafico: ["Atendimentos na semana", "barras"],
    lista: ["Próximos horários", [["09:00 · Ana Souza", "Confirmado"], ["09:40 · Bruno Lima", "Confirmado"], ["10:20 · Carla Dias", "Aguardando"], ["11:00 · Diego Reis", "Confirmado"]]],
    fone: ["Agendar horário", [["09h", "Avaliação", "Sala 2"], ["10h", "Retorno", "Sala 1"], ["11h", "Consulta", "Sala 3"]]] },
  vendas: { marca: "Comercial", titulo: "Funil de vendas", menu: ["Painel", "Leads", "Propostas", "Clientes", "Metas", "Equipe", "Relatórios"],
    kpis: [["Leads no mês", "126", "+18%"], ["Propostas", "34", "+9%"], ["Fechado", "R$ 92 mil", "+27%"]], grafico: ["Vendas por semana", "barras"],
    lista: ["Follow-ups de hoje", [["Mercado Bom Preço", "Ligar"], ["Construtora Alfa", "Proposta"], ["Ótica Central", "Reunião"], ["Studio Fit", "Contrato"]]],
    fone: ["Meus leads", [["Novo", "Padaria Real", "Pediu orçamento"], ["Quente", "Auto Peças Sul", "Proposta enviada"], ["Fechar", "Studio Fit", "Assinar contrato"]]] },
  pedidos: { marca: "Loja Online", titulo: "Pedidos e estoque", menu: ["Painel", "Pedidos", "Produtos", "Estoque", "Clientes", "Entregas", "Relatórios"],
    kpis: [["Pedidos no mês", "342", "+15%"], ["Ticket médio", "R$ 186", "+6%"], ["Estoque baixo", "7 itens", "Repor"]], grafico: ["Vendas no mês", "linha"],
    lista: ["Pedidos recentes", [["#1042 · Maria L.", "Pago"], ["#1041 · João P.", "Enviado"], ["#1040 · Rafa M.", "Separando"], ["#1039 · Lia S.", "Entregue"]]],
    fone: ["Pedidos de hoje", [["#1042", "Maria L.", "R$ 240,00 · Pago"], ["#1041", "João P.", "R$ 129,90 · Enviado"], ["#1040", "Rafa M.", "R$ 312,50 · Separando"]]] },
  barbearia: { marca: "Titan Barber", titulo: "Resumo da barbearia", menu: ["Visão geral", "Agenda", "Barbeiros", "Clientes", "Serviços", "Comissões", "Caixa", "Fidelidade"],
    kpis: [["Faturamento", "R$ 18.400", "+14%"], ["Atendimentos", "412", "+9%"], ["Lucro real", "R$ 7.950", "+11%"]], grafico: ["Faturamento por semana", "linha"],
    lista: ["Agenda de hoje", [["09:00 · Corte + barba", "Lucas"], ["09:40 · Degradê", "Pedro"], ["10:20 · Barba", "Lucas"], ["11:00 · Corte", "Rafa"]]],
    fone: ["Minha agenda", [["09h", "Corte + barba", "Cliente: Marcos"], ["10h", "Degradê", "Cliente: João"], ["11h", "Barba", "Cliente: André"]]] },
};
// Tela de sistema desenhada em 1000x625 (coordenadas virtuais).
function screenApp(ctx, t, seed) {
  const rnd = seeded(seed + 7);
  ctx.fillStyle = "#F5F7FB"; ctx.fillRect(0, 0, 1000, 625);
  ctx.fillStyle = "#0B1633"; ctx.fillRect(0, 0, 190, 625);
  icon(ctx, 22, 22, 30, "#fff"); ctx.font = "700 17px AI"; ctx.fillStyle = "#fff"; ctx.fillText(t.marca, 60, 43);
  t.menu.forEach((m, k) => {
    const y = 82 + k * 44;
    if (!k) { ctx.fillStyle = BLUE; rr(ctx, 12, y - 4, 166, 36, 8); ctx.fill(); }
    ctx.fillStyle = k ? "rgba(255,255,255,.35)" : "#fff"; rr(ctx, 26, y + 6, 16, 16, 4); ctx.fill();
    ctx.font = "600 15px AI"; ctx.fillStyle = k ? "rgba(255,255,255,.7)" : "#fff"; ctx.fillText(m, 52, y + 19);
  });
  ctx.font = "800 26px AJ"; ctx.fillStyle = INK; ctx.fillText(t.titulo, 214, 52);
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#E3E8F2"; ctx.lineWidth = 1.5; rr(ctx, 800, 26, 108, 36, 8); ctx.fill(); ctx.stroke();
  ctx.font = "600 14px AI"; ctx.fillStyle = "#56627A"; ctx.fillText("Este mês ▾", 814, 49);
  ctx.fillStyle = "#DCE6FF"; ctx.beginPath(); ctx.arc(950, 44, 18, 0, 7); ctx.fill(); ctx.font = "700 13px AI"; ctx.fillStyle = BLUE; ctx.textAlign = "center"; ctx.fillText("AR", 950, 49); ctx.textAlign = "left";
  const card = (x, y, w, h) => { ctx.save(); ctx.shadowColor = "rgba(15,30,70,.08)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = "#fff"; rr(ctx, x, y, w, h, 12); ctx.fill(); ctx.restore(); };
  t.kpis.forEach(([l, v, d], k) => {
    const x = 214 + k * 260; card(x, 84, 244, 112);
    ctx.fillStyle = "#E8F0FF"; rr(ctx, x + 16, x ? 100 : 100, 28, 28, 7); ctx.fill(); ctx.fillStyle = BLUE; [8, 14, 20].forEach((hh, q) => ctx.fillRect(x + 22 + q * 6, 122 - hh * 0.7, 4, hh * 0.7));
    ctx.font = "600 15px AI"; ctx.fillStyle = "#56627A"; ctx.fillText(l, x + 54, 119);
    ctx.font = "800 28px AJ"; ctx.fillStyle = INK; ctx.fillText(v, x + 16, 163);
    const neg = /^-/.test(d); ctx.font = "700 13px AI"; const dw = ctx.measureText("↑ " + d).width + 16;
    ctx.fillStyle = neg ? "#E8F0FF" : "#E3F7EC"; rr(ctx, x + 16, 172, dw, 20, 6); ctx.fill(); ctx.fillStyle = neg ? BLUE : GREEN; ctx.fillText((neg ? "↓ " : "↑ ") + d.replace(/^[-+]/, ""), x + 24, 187);
  });
  // gráfico
  card(214, 212, 450, 390); ctx.font = "800 19px AJ"; ctx.fillStyle = INK; ctx.fillText(t.grafico[0], 234, 248);
  ctx.font = "600 13px AI"; ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(520, 243, 5, 0, 7); ctx.fill(); ctx.fillStyle = "#56627A"; ctx.fillText("Entradas", 530, 248);
  ctx.fillStyle = "#AFC6F5"; ctx.beginPath(); ctx.arc(600, 243, 5, 0, 7); ctx.fill(); ctx.fillStyle = "#56627A"; ctx.fillText("Saídas", 610, 248);
  const gx = 270, gy = 280, gw = 370, gh = 270;
  ctx.strokeStyle = "#EDF1F7"; ctx.lineWidth = 1.5; ctx.font = "500 12px AI"; ctx.fillStyle = "#8A95AB";
  for (let k = 0; k <= 4; k++) { const y = gy + (gh * k) / 4; ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke(); ctx.fillText(String((4 - k) * 20), 234, y + 4); }
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"]; months.forEach((m, k) => ctx.fillText(m, gx + (gw * k) / 5 - 10, gy + gh + 26));
  if (t.grafico[1] === "barras") {
    for (let k = 0; k < 6; k++) { const a = 0.35 + rnd() * 0.55, b = a * (0.45 + rnd() * 0.3), bx = gx + 14 + k * 62;
      ctx.fillStyle = "#AFC6F5"; rr(ctx, bx + 20, gy + gh - gh * b, 18, gh * b, 4); ctx.fill(); ctx.fillStyle = BLUE; rr(ctx, bx, gy + gh - gh * a, 18, gh * a, 4); ctx.fill(); }
  } else {
    const pts = (base, amp) => Array.from({ length: 7 }, (_, k) => [gx + (gw * k) / 6, gy + gh - gh * Math.min(0.95, base + k * 0.08 + (rnd() - 0.4) * amp)]);
    const draw = (p, color, fill) => {
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      for (let k = 1; k < p.length; k++) { const [x0, y0] = p[k - 1], [x1, y1] = p[k], mx = (x0 + x1) / 2; ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1); }
      if (fill) { ctx.save(); ctx.lineTo(gx + gw, gy + gh); ctx.lineTo(gx, gy + gh); ctx.closePath(); const g = ctx.createLinearGradient(0, gy, 0, gy + gh); g.addColorStop(0, "rgba(22,104,255,.28)"); g.addColorStop(1, "rgba(22,104,255,0)"); ctx.fillStyle = g; ctx.fill(); ctx.restore();
        ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let k = 1; k < p.length; k++) { const [x0, y0] = p[k - 1], [x1, y1] = p[k], mx = (x0 + x1) / 2; ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1); } }
      ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
    };
    draw(pts(0.2, 0.18), "#AFC6F5", false); draw(pts(0.32, 0.2), BLUE, true);
  }
  // lista
  card(680, 212, 300, 390); ctx.font = "800 19px AJ"; ctx.fillStyle = INK; ctx.fillText(t.lista[0], 700, 248);
  ctx.fillStyle = BLUE; ctx.font = "700 18px AI"; ctx.fillText("→", 948, 248);
  t.lista[1].forEach(([a, b], k) => {
    const y = 278 + k * 76; ctx.strokeStyle = "#EDF1F7"; ctx.lineWidth = 1.5; if (k) { ctx.beginPath(); ctx.moveTo(700, y - 10); ctx.lineTo(960, y - 10); ctx.stroke(); }
    ctx.strokeStyle = k ? "#C5CEDD" : BLUE; ctx.lineWidth = 2; rr(ctx, 700, y + 10, 20, 20, 5); ctx.stroke();
    if (!k) { ctx.fillStyle = BLUE; rr(ctx, 700, y + 10, 20, 20, 5); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(705, y + 20); ctx.lineTo(709, y + 25); ctx.lineTo(716, y + 15); ctx.stroke(); }
    ctx.font = "600 15px AI"; ctx.fillStyle = INK; ctx.fillText(a.length > 22 ? a.slice(0, 21) + "…" : a, 732, y + 26);
    ctx.font = "700 12px AI"; const bw = ctx.measureText(b).width + 16; ctx.fillStyle = k ? "#F0F3F8" : "#E3F7EC"; rr(ctx, 960 - bw, y + 38, bw, 22, 6); ctx.fill();
    ctx.fillStyle = k ? "#56627A" : GREEN; ctx.fillText(b, 968 - bw, y + 53);
  });
}
// Tela de site (página inicial) em 1000x625.
function screenSite(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 1000, 625); g.addColorStop(0, "#071437"); g.addColorStop(1, "#0E2C75"); ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 625);
  ctx.font = "800 22px AJ"; ctx.fillStyle = "#fff"; ctx.fillText(t.marca || "Sua Marca", 50, 52);
  ctx.font = "600 15px AI"; ctx.fillStyle = "rgba(255,255,255,.75)"; ["Início", "Serviços", "Sobre", "Contato"].forEach((m, k) => ctx.fillText(m, 520 + k * 90, 50));
  ctx.fillStyle = BLUE; rr(ctx, 870, 26, 100, 38, 10); ctx.fill(); ctx.font = "700 14px AI"; ctx.fillStyle = "#fff"; ctx.fillText("Orçamento", 884, 50);
  txt(ctx, t.h || "Seu negócio <em>no topo</em> do Google", { x: 50, y: 190, w: 470, font: "800 46px AJ", lh: 54, color: "#fff", em: BLUE_2 });
  ctx.font = "500 17px AI"; ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillText("Rápido no celular, fácil de achar e feito para", 50, 360); ctx.fillText("transformar visita em cliente.", 50, 384);
  ctx.fillStyle = BLUE; rr(ctx, 50, 420, 190, 52, 12); ctx.fill(); ctx.font = "700 16px AI"; ctx.fillStyle = "#fff"; ctx.fillText("Falar no WhatsApp", 70, 452);
  ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 1.5; rr(ctx, 256, 420, 150, 52, 12); ctx.stroke(); ctx.fillText("Ver serviços", 280, 452);
  // card de imagem
  const cg = ctx.createLinearGradient(560, 110, 950, 560); cg.addColorStop(0, "#1668FF"); cg.addColorStop(1, "#7AA8FF"); ctx.fillStyle = cg; rr(ctx, 570, 110, 380, 440, 22); ctx.fill();
  ctx.globalAlpha = 0.18; icon(ctx, 620, 170, 280); ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff"; rr(ctx, 530, 430, 230, 92, 14); ctx.fill(); ctx.font = "800 28px AJ"; ctx.fillStyle = INK; ctx.fillText("+2x", 552, 474); ctx.font = "600 14px AI"; ctx.fillStyle = "#56627A"; ctx.fillText("contatos pelo site", 552, 500);
  ctx.fillStyle = "rgba(255,255,255,.12)"; [0, 1, 2].forEach((k) => { rr(ctx, 50 + k * 160, 520, 140, 60, 10); ctx.fill(); });
  ctx.font = "700 14px AI"; ctx.fillStyle = "#fff"; ["Google", "Celular", "PWA"].forEach((m, k) => ctx.fillText("✓ " + m, 70 + k * 160, 556));
}
function phoneScreen(ctx, t, site) { // 300x600 virtuais
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 300, 600);
  if (site) {
    const g = ctx.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, "#071437"); g.addColorStop(1, "#0E2C75"); ctx.fillStyle = g; ctx.fillRect(0, 0, 300, 600);
    ctx.font = "800 18px AJ"; ctx.fillStyle = "#fff"; ctx.fillText(t.marca || "Sua Marca", 22, 66); ctx.fillStyle = "#fff"; [0, 1, 2].forEach((k) => ctx.fillRect(250, 54 + k * 7, 26, 3));
    txt(ctx, t.h || "Seu negócio <em>no topo</em> do Google", { x: 22, y: 140, w: 250, font: "800 28px AJ", lh: 34, color: "#fff", em: BLUE_2 });
    ctx.fillStyle = BLUE; rr(ctx, 22, 330, 256, 48, 12); ctx.fill(); ctx.font = "700 15px AI"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText("Falar no WhatsApp", 150, 360); ctx.textAlign = "left";
    const cg = ctx.createLinearGradient(0, 400, 300, 580); cg.addColorStop(0, BLUE); cg.addColorStop(1, "#7AA8FF"); ctx.fillStyle = cg; rr(ctx, 22, 400, 256, 170, 16); ctx.fill();
    return;
  }
  const [title, items] = t.fone;
  ctx.font = "800 22px AJ"; ctx.fillStyle = INK; ctx.fillText(title, 22, 74);
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex"], nums = [12, 13, 14, 15, 16];
  days.forEach((d, k) => { const x = 22 + k * 52; if (k === 3) { ctx.fillStyle = BLUE; rr(ctx, x - 4, 92, 46, 62, 12); ctx.fill(); }
    ctx.font = "600 12px AI"; ctx.fillStyle = k === 3 ? "#fff" : "#8A95AB"; ctx.textAlign = "center"; ctx.fillText(d, x + 19, 116); ctx.font = "800 18px AJ"; ctx.fillStyle = k === 3 ? "#fff" : INK; ctx.fillText(String(nums[k]), x + 19, 142); ctx.textAlign = "left"; });
  items.forEach(([a, b, c], k) => {
    const y = 176 + k * 112; ctx.fillStyle = k ? "#F3F6FC" : "#E8F0FF"; rr(ctx, 22, y, 256, 96, 14); ctx.fill();
    if (!k) { ctx.fillStyle = BLUE; rr(ctx, 22, y, 6, 96, 3); ctx.fill(); }
    ctx.font = "800 17px AJ"; ctx.fillStyle = INK; ctx.fillText(a + " · " + b, 40, y + 40); ctx.font = "500 14px AI"; ctx.fillStyle = "#56627A"; ctx.fillText(c, 40, y + 68);
  });
  ctx.fillStyle = "#F3F6FC"; ctx.fillRect(0, 530, 300, 70); ["⌂", "▦", "＋", "☰"].forEach((m, k) => { ctx.font = "600 22px AI"; ctx.fillStyle = k === 1 ? BLUE : "#8A95AB"; ctx.fillText(m, 36 + k * 70, 572); });
}
// Computador (tipo iMac) com o celular na frente. (x,y) = canto superior esquerdo do monitor; w = largura do monitor.
function devices(ctx, tela, x, y, w, seed, extra = {}) {
  const t = { ...(TELAS[tela] || TELAS.financeiro), ...extra }, site = tela === "site";
  const sw = w - 36, sh = sw * 0.625, chin = w * 0.085, mh = sh + 36 + chin;
  // pé
  ctx.save();
  const neckW = w * 0.2, neckH = w * 0.17, nx = x + (w - neckW) / 2, ny = y + mh - 4;
  let g = ctx.createLinearGradient(nx, 0, nx + neckW, 0); g.addColorStop(0, "#B9BEC8"); g.addColorStop(0.5, "#E7EAF0"); g.addColorStop(1, "#AEB4BF");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(nx + 6, ny); ctx.lineTo(nx + neckW - 6, ny); ctx.lineTo(nx + neckW + 10, ny + neckH); ctx.lineTo(nx - 10, ny + neckH); ctx.closePath(); ctx.fill();
  ctx.shadowColor = "rgba(15,30,70,.25)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#D5D9E1"; rr(ctx, nx - 40, ny + neckH - 4, neckW + 80, 16, 8); ctx.fill();
  // corpo
  ctx.shadowColor = "rgba(15,30,70,.28)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
  g = ctx.createLinearGradient(0, y, 0, y + mh); g.addColorStop(0, "#E9ECF1"); g.addColorStop(1, "#C9CED8"); ctx.fillStyle = g; rr(ctx, x, y, w, mh, 24); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#0E1015"; ctx.beginPath(); ctx.roundRect(x, y, w, sh + 36, [24, 24, 0, 0]); ctx.fill();
  ctx.fillStyle = "#9BA2AF"; ctx.beginPath(); ctx.arc(x + w / 2, y + mh - chin / 2, 9, 0, 7); ctx.fill();
  // tela
  ctx.save(); ctx.beginPath(); ctx.rect(x + 18, y + 18, sw, sh); ctx.clip(); ctx.translate(x + 18, y + 18); ctx.scale(sw / 1000, sh / 625);
  site ? screenSite(ctx, t) : screenApp(ctx, t, seed); ctx.restore();
  // celular
  const pw = w * 0.27, ph = pw * 2.05, px = x + w - pw * 0.55, py = y + mh - ph * 0.62;
  ctx.save(); ctx.shadowColor = "rgba(15,30,70,.4)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20; ctx.fillStyle = "#14161C"; rr(ctx, px, py, pw, ph, pw * 0.16); ctx.fill(); ctx.restore();
  ctx.strokeStyle = "#3B3F48"; ctx.lineWidth = 3; rr(ctx, px + 1.5, py + 1.5, pw - 3, ph - 3, pw * 0.16); ctx.stroke();
  const bz = pw * 0.045; ctx.save(); rr(ctx, px + bz, py + bz, pw - 2 * bz, ph - 2 * bz, pw * 0.13); ctx.clip();
  ctx.translate(px + bz, py + bz); ctx.scale((pw - 2 * bz) / 300, (ph - 2 * bz) / 600); phoneScreen(ctx, t, site); ctx.restore();
  ctx.fillStyle = "#0E1015"; rr(ctx, px + pw / 2 - pw * 0.15, py + bz + 8, pw * 0.3, pw * 0.08, pw * 0.04); ctx.fill();
}

/* ---------- formatos ---------- */
const SL = {};
// Institucional: capa escura com logo 3D
SL.capaInst = (ctx, s, i, total) => {
  bgTech(ctx, { glowX: W * 0.55, glowY: H * 0.72 });
  logo3d(ctx, W * 0.56, H * 0.75, 560);
  chrome(ctx, i, total);
  let y = 300;
  if (s.pre) y += txt(ctx, s.pre, { x: X, y, w: MW, font: "800 112px AJ", lh: 116, color: "#fff", em: BLUE_2 });
  y += txt(ctx, s.h, { x: X, y, w: MW, font: "800 112px AJ", lh: 116, color: "#fff", em: BLUE_2 });
  if (s.sub) txt(ctx, s.sub, { x: X, y: y - 116 + 74, w: 720, font: "500 32px AI", lh: 44, color: "rgba(255,255,255,.78)", em: "#fff" });
};
// Item numerado (institucional, escuro)
SL.item = (ctx, s, i, total) => {
  bgTech(ctx, { glowX: W * 0.9, glowY: H * 0.15 });
  chrome(ctx, i, total);
  const ot = { x: X, w: MW, font: "800 80px AJ", lh: 88, color: "#fff", em: BLUE_2 }, op = { x: X, w: MW - 40, font: "500 40px AI", lh: 58, color: "rgba(255,255,255,.8)", em: "#fff" };
  const ht = hgt(ctx, s.t, ot), hp = hgt(ctx, s.p, op), y = stack([200, 40, ht, 36, hp], 200, H - 170);
  ctx.font = "800 230px AJ"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(77,141,255,.85)"; ctx.strokeText(s.n, X - 8, y + 190);
  ctx.globalAlpha = 0.07; icon(ctx, W - 470, H - 560, 560); ctx.globalAlpha = 1;
  let yy = y + 200 + 40 + 70; yy += txt(ctx, s.t, { ...ot, y: yy });
  const last = yy - 88; ctx.fillStyle = BLUE; ctx.fillRect(X, last + 40, 110, 7);
  txt(ctx, s.p, { ...op, y: last + 40 + 82 });
};
// Dor: capa clara com "bagunça" (cartões tortos)
SL.capaDor = (ctx, s, i, total) => {
  bgLight(ctx); chrome(ctx, i, total, { dark: false });
  pill(ctx, s.k.toUpperCase(), X, 190, "rgba(22,104,255,.1)", BLUE);
  const o = { x: X, w: MW, font: "800 100px AJ", lh: 106, color: INK, em: BLUE };
  let y = 360; y += txt(ctx, s.h, { ...o, y });
  if (s.sub) txt(ctx, s.sub, { x: X, y: y - 106 + 70, w: 820, font: "500 34px AI", lh: 48, color: "rgba(11,18,32,.65)" });
  const caos = s.caos || ["planilha_final_v3.xlsx", "Caderno de anotações", "WhatsApp · 47 mensagens"];
  const base = 860;
  caos.slice(0, 3).forEach((c, k) => {
    ctx.save(); ctx.translate(X + 10 + k * 300, base + [0, 110, 20][k]); ctx.rotate([-0.08, 0.06, -0.035][k]);
    ctx.shadowColor = "rgba(15,30,70,.18)"; ctx.shadowBlur = 34; ctx.shadowOffsetY = 16; ctx.fillStyle = "#fff"; rr(ctx, 0, 0, 340, 200, 24); ctx.fill(); ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(255,90,95,.14)"; ctx.beginPath(); ctx.arc(58, 58, 30, 0, 7); ctx.fill(); ctx.font = "800 36px AJ"; ctx.fillStyle = RED; ctx.textAlign = "center"; ctx.fillText("!", 58, 71); ctx.textAlign = "left";
    ctx.fillStyle = "#E9EDF5"; rr(ctx, 104, 42, 150, 12, 6); ctx.fill(); rr(ctx, 104, 64, 100, 12, 6); ctx.fill();
    ctx.font = "700 28px AI"; ctx.fillStyle = INK; const l = wrapRich(ctx, [{ t: c }], 290); l.slice(0, 2).forEach((ln, q) => ctx.fillText(ln.map((w) => w.t).join(""), 28, 140 + q * 34));
    ctx.restore();
  });
};
// Dor: cada problema, em claro com marcador vermelho
SL.dor = (ctx, s, i, total) => {
  bgLight(ctx); chrome(ctx, i, total, { dark: false });
  const ot = { x: X, w: MW, font: "800 78px AJ", lh: 86, color: INK, em: BLUE }, op = { x: X, w: MW - 40, font: "500 40px AI", lh: 58, color: "rgba(11,18,32,.72)", em: INK };
  const ht = hgt(ctx, s.t, ot), hp = hgt(ctx, s.p, op), y = stack([96, 50, ht, 36, hp], 200, H - 170);
  ctx.fillStyle = "rgba(255,90,95,.12)"; rr(ctx, X, y, 96, 96, 26); ctx.fill();
  ctx.strokeStyle = RED; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(X + 32, y + 32); ctx.lineTo(X + 64, y + 64); ctx.moveTo(X + 64, y + 32); ctx.lineTo(X + 32, y + 64); ctx.stroke(); ctx.lineCap = "butt";
  label(ctx, "PROBLEMA " + s.n, X + 124, y + 58, RED, 26, 5);
  let yy = y + 96 + 50 + 66; yy += txt(ctx, s.t, { ...ot, y: yy });
  yy += 36 - 86 + 40; txt(ctx, s.p, { ...op, y: yy });
};
// Solução: fundo azul com checklist
SL.solucao = (ctx, s, i, total) => {
  bgBlue(ctx); chrome(ctx, i, total, { blue: true });
  const oh = { x: X, w: MW, font: "800 84px AJ", lh: 92, color: "#fff", em: "#BFD5FF" };
  const items = s.itens, iw = MW - 100, io = { w: iw, font: "600 38px AI", lh: 52 };
  const hi = items.map((t) => Math.max(64, hgt(ctx, t, io))), hh = hgt(ctx, s.h, oh);
  let y = stack([hh, 60, ...hi.map((h) => h + 34)], 210, H - 170) + 76;
  y += txt(ctx, s.h, { ...oh, y }); y += 60 - 92;
  items.forEach((t, k) => {
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(X + 32, y + 32, 32, 0, 7); ctx.fill();
    ctx.strokeStyle = BLUE; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(X + 18, y + 33); ctx.lineTo(X + 28, y + 43); ctx.lineTo(X + 47, y + 22); ctx.stroke(); ctx.lineCap = "butt";
    txt(ctx, t, { ...io, x: X + 100, y: y + 44, color: "#fff", em: "#fff" }); y += hi[k] + 34;
  });
};
// Case / prova: texto + aparelhos
SL.case = (ctx, s, i, total) => {
  bgLight(ctx); chrome(ctx, i, total, { dark: false });
  pill(ctx, (s.k || "CASE").toUpperCase(), X, 190, BLUE, "#fff");
  let y = 330; y += txt(ctx, s.t, { x: X, y, w: MW, font: "800 70px AJ", lh: 78, color: INK, em: BLUE });
  txt(ctx, s.p, { x: X, y: y - 78 + 60, w: MW, font: "500 34px AI", lh: 48, color: "rgba(11,18,32,.7)" });
  devices(ctx, s.tela || "barbearia", X + 30, 630, 620, s.seed || 3);
};
// CTA final (escuro)
SL.cta = (ctx, s, i, total) => {
  bgTech(ctx, { glowX: W / 2, glowY: 420 });
  chrome(ctx, i, total, { arrow: false });
  logo3d(ctx, W / 2, 430, 340);
  const oh = { x: X, w: MW, font: "800 84px AJ", lh: 92, color: "#fff", em: BLUE_2, align: "center" }, op = { x: X + 40, w: MW - 80, font: "500 36px AI", lh: 50, color: "rgba(255,255,255,.78)", align: "center" };
  let y = stack([hgt(ctx, s.h, oh), 30, hgt(ctx, s.p, op), 40, 104], 640, H - 160) + 70; y += txt(ctx, s.h, { ...oh, y }); y += txt(ctx, s.p, { ...op, y: y - 92 + 64 }) - 92 + 64;
  ctx.font = "800 38px AJ"; const site = BANK.site || "armetec.com.br", bw = ctx.measureText(site).width + 110, bx = (W - bw) / 2, by = y - 50 + 44;
  ctx.save(); ctx.shadowColor = "rgba(22,104,255,.6)"; ctx.shadowBlur = 40; ctx.fillStyle = BLUE; rr(ctx, bx, by, bw, 104, 52); ctx.fill(); ctx.restore();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(site, W / 2, by + 54); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
};
// Foto única com mockup (claro)
SL.mockup = (ctx, s) => {
  bgLight(ctx);
  wordmark(ctx, X, 128, { size: 40, color: INK });
  let y = 250; y += txt(ctx, s.h, { x: X, y, w: MW, font: "800 72px AJ", lh: 80, color: INK, em: BLUE });
  if (s.sub) txt(ctx, s.sub, { x: X, y: y - 80 + 60, w: 860, font: "500 32px AI", lh: 44, color: "rgba(11,18,32,.66)" });
  devices(ctx, s.tela, X + 40, 600, 760, s.seed || 1, s.telaExtra || {});
  ctx.font = "700 26px AI"; ctx.fillStyle = "rgba(11,18,32,.5)"; ctx.textAlign = "right"; ctx.fillText(BANK.site || "armetec.com.br", W - X, 128); ctx.textAlign = "left";
};
// Foto única: frase (escura ou clara)
SL.frase = (ctx, s) => {
  const dark = !s.claro;
  dark ? bgTech(ctx, { glowX: W * 0.85, glowY: H * 0.9 }) : bgLight(ctx);
  const fg = dark ? "#fff" : INK, em = dark ? BLUE_2 : BLUE;
  wordmark(ctx, X, 128, { size: 36, color: fg });
  ctx.font = "600 28px AI"; ctx.fillStyle = dark ? "rgba(255,255,255,.7)" : "rgba(11,18,32,.55)"; ctx.textAlign = "right"; ctx.fillText(BANK.insta || "@armetec.br", W - X, 128); ctx.textAlign = "left";
  const oq = { x: X, w: MW, font: "800 92px AJ", lh: 102, color: fg, em }, op = { x: X, w: MW - 60, font: "500 36px AI", lh: 50, color: dark ? "rgba(255,255,255,.75)" : "rgba(11,18,32,.66)" };
  const hq = hgt(ctx, s.h, oq), hp = s.sub ? hgt(ctx, s.sub, op) : 0, y = stack([150, hq, 50, hp], 210, H - 170);
  ctx.font = "800 260px AJ"; ctx.fillStyle = em; ctx.fillText("“", X - 14, y + 200);
  let yy = y + 150 + 80; yy += txt(ctx, s.h, { ...oq, y: yy });
  if (s.sub) { yy += 50 - 102 + 36; ctx.fillStyle = em; ctx.fillRect(X, yy - 30, 90, 7); txt(ctx, s.sub, { ...op, y: yy + 40 }); }
  ctx.globalAlpha = dark ? 0.08 : 0.06; icon(ctx, W - 420, H - 470, 520, dark ? "#fff" : BLUE); ctx.globalAlpha = 1;
  ctx.font = "700 26px AI"; ctx.fillStyle = dark ? "rgba(255,255,255,.6)" : "rgba(11,18,32,.5)"; ctx.fillText(BANK.site || "armetec.com.br", X, H - 86);
};

function drawSlide(slide, i, total) {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d");
  (SL[slide.type] || SL.frase)(ctx, slide, i, total);
  return c;
}

/* ---------- montagem do post ---------- */
const CTAS = [
  ["Vamos tirar sua <em>ideia do papel?</em>", "Site, sistema ou aplicativo sob medida, com escopo e valor definidos antes de começar."],
  ["Sua empresa no <em>próximo nível</em>", "Conte o que você precisa. A gente desenha a solução e te mostra o caminho."],
  ["Bora <em>organizar</em> isso?", "Fale com quem desenvolve: sem robô, sem fila, direto com o time da Armetec."],
  ["Chega de <em>improviso</em>", "Tecnologia sob medida para empresas que querem crescer sem bagunça."],
];
const FECHO = [
  "Quer um site, sistema ou app do jeito que sua empresa trabalha? Fale com a gente pelo link na bio.",
  "Conta pra gente nos comentários: o que mais trava a rotina da sua empresa hoje? 👇",
  "Salva esse post e manda pro seu sócio. Orçamento sem compromisso em armetec.com.br.",
  "Segue a @armetec.br para mais conteúdo sobre tecnologia para o seu negócio.",
];
const TAGS = [
  "#armetec #desenvolvimentodesoftware #sistemas #sitesprofissionais #empreendedorismo",
  "#armetec #tecnologia #transformacaodigital #pequenasempresas #automacao",
  "#armetec #criacaodesites #sistemaweb #aplicativos #gestaoempresarial",
  "#armetec #softwaresobmedida #negocios #produtividade #pwa",
];
function buildPost(p, gi) {
  const slides = [];
  if (p.f === "institucional") {
    slides.push({ type: "capaInst", pre: p.pre, h: p.h, sub: p.sub });
    p.itens.forEach(([t, x], k) => slides.push({ type: "item", n: String(k + 1).padStart(2, "0"), t, p: x }));
  } else if (p.f === "dor") {
    slides.push({ type: "capaDor", k: p.k, h: p.h, sub: p.sub, caos: p.caos });
    p.itens.forEach(([t, x], k) => slides.push({ type: "dor", n: String(k + 1).padStart(2, "0"), t, p: x }));
    slides.push({ type: "solucao", h: p.sol.h, itens: p.sol.itens });
    if (p.case) slides.push({ type: "case", k: p.case.k, t: p.case.t, p: p.case.p, tela: p.case.tela, seed: gi });
  } else if (p.f === "mockup") {
    slides.push({ type: "mockup", h: p.h, sub: p.sub, tela: p.tela, seed: gi + 1, telaExtra: p.telaExtra });
  } else {
    slides.push({ type: "frase", h: p.h, sub: p.sub, claro: Boolean(p.claro) });
  }
  if (slides.length > 1) { const c = p.cta || CTAS[gi % CTAS.length]; slides.push({ type: "cta", h: c[0], p: c[1] }); }
  const hook = strip((p.pre ? p.pre + " " : "") + p.h);
  const body = p.leg || strip(p.sub || "");
  const caption = hook + "\n\n" + (body ? body + "\n\n" : "") + FECHO[gi % FECHO.length] + "\n\n" + TAGS[gi % TAGS.length];
  return { slides, caption, hook, k: p.k || p.f, f: p.f };
}

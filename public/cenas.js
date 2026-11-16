/* Cenas ilustradas: cada post escolhe a sua (campo "fig" no banco), para nenhum post ficar igual ao outro.
   Cada cena desenha dentro de uma caixa {x, y, w, h}, no tema "light" (branco), "blue" (blueprint) ou "dark" (carrossel).
   Usa os utilitários de slides.js e estilos.js (rr, txt, icon, lineIcon, phoneDev, tabletDev, laptopDev, phoneUI, phoneLightUI, phoneSiteUI, logo3d, TELAS). */
const CENA = {};
function cardBox(ctx, x, y, w, h, th, r = 26) {
  ctx.save();
  if (th === "dark") { ctx.fillStyle = "rgba(14,22,42,.96)"; rr(ctx, x, y, w, h, r); ctx.fill(); ctx.strokeStyle = "rgba(127,176,255,.3)"; ctx.lineWidth = 2; ctx.stroke(); }
  else { ctx.shadowColor = th === "blue" ? "rgba(0,20,80,.35)" : "rgba(15,40,100,.18)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 22; ctx.fillStyle = "#fff"; rr(ctx, x, y, w, h, r); ctx.fill(); }
  ctx.restore();
}
const ink = (th) => (th === "dark" ? "#fff" : INK), mut = (th) => (th === "dark" ? "#8C98B5" : "#6B7690"), soft = (th) => (th === "dark" ? "#1A2440" : "#EEF3FC");
// Selo flutuante pequeno (ícone + 2 linhas).
function chip(ctx, x, y, th, ic, a, b, color = ON_BLUE, rot = 0, w = null) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = "700 26px MS"; const ww = w || Math.max(ctx.measureText(a).width, (ctx.font = "400 21px MS", ctx.measureText(b || "").width)) + 132;
  cardBox(ctx, 0, 0, ww, b ? 104 : 84, th, 24);
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(52, b ? 52 : 42, 30, 0, 7); ctx.fill(); lineIcon(ctx, ic, 37, b ? 37 : 27, 30, "#fff", 2.4);
  ctx.font = "700 26px MS"; ctx.fillStyle = ink(th); ctx.fillText(a, 98, b ? 48 : 52);
  if (b) { ctx.font = "400 21px MS"; ctx.fillStyle = mut(th); ctx.fillText(b, 98, 80); }
  ctx.restore(); return ww;
}
function glowAt(ctx, x, y, r, a = 0.3) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(22,104,255,${a})`); g.addColorStop(1, "rgba(22,104,255,0)"); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
const telaDe = (d) => TELAS[d.tela] || TELAS.financeiro;

// 1. Celular inclinado com a tela do assunto + um selo
CENA.celular = (ctx, b, th, d) => {
  const cx = b.x + b.w * (d.lado === "esq" ? 0.32 : 0.66), cy = b.y + b.h * 0.56;
  glowAt(ctx, cx, cy, 420, th === "dark" ? 0.35 : 0.25);
  phoneDev(ctx, cx, cy, Math.min(760, b.h * 1.15), d.tela === "site" ? phoneSiteUI : d.tela === "rotina" ? phoneLightUI : telaDe(d), d.seed || 1, d.lado === "esq" ? -0.16 : 0.16);
  chip(ctx, d.lado === "esq" ? b.x + b.w * 0.52 : b.x, b.y + b.h * 0.22, th, d.chipIc || "check", d.chip || "Tudo no celular", d.chipSub || "acesse de qualquer lugar", d.chipCor || GREEN, -0.03);
};
// 2. Notebook com site + selo de velocidade
CENA.notebook = (ctx, b, th, d) => {
  const w = Math.min(b.w * 0.92, 820, (b.h - 30) / 0.68); glowAt(ctx, b.x + b.w / 2, b.y + b.h / 2, 460, 0.22);
  laptopDev(ctx, b.x + (b.w - w) / 2 + 20, b.y + (b.h - w * 0.66) / 2, w, d.telaExtra);
  chip(ctx, b.x + b.w - 330, b.y + b.h - 110, th, "relogio", d.chip || "Abre em 1,2 s", d.chipSub || "rápido no celular", GREEN, 0.03);
};
// 3. Notebook + celular (site em todos os aparelhos)
CENA.duo = (ctx, b, th, d) => {
  const w = Math.min(b.w * 0.82, 740, (b.h - 40) / 0.7); glowAt(ctx, b.x + b.w * 0.45, b.y + b.h / 2, 460, 0.22);
  laptopDev(ctx, b.x + 10, b.y + (b.h - w * 0.66) / 2 - 20, w, d.telaExtra);
  phoneDev(ctx, b.x + b.w - 150, b.y + b.h * 0.62, Math.min(520, b.h * 0.85), phoneSiteUI, 2, 0.08);
};
// 4. Tablet com painel + indicador flutuante
CENA.tablet = (ctx, b, th, d) => {
  const w = Math.min(b.w * 0.86, 760, (b.h - 50) / 0.74); glowAt(ctx, b.x + b.w / 2, b.y + b.h / 2, 460, 0.22);
  tabletDev(ctx, b.x + (b.w - w) / 2, b.y + (b.h - w * 0.74) / 2, w, telaDe(d), d.seed || 2);
  const k = telaDe(d).kpis[2]; chip(ctx, b.x + b.w - 340, b.y + b.h - 120, th, "grafico", k[1], k[0] + " " + k[2], ON_BLUE, -0.03);
};
// 5. Três celulares em leque (app)
CENA.trio = (ctx, b, th, d) => {
  const h = Math.min(640, b.h * 1.02), cy = b.y + b.h * 0.55; glowAt(ctx, b.x + b.w / 2, cy, 480, 0.28);
  phoneDev(ctx, b.x + b.w * 0.22, cy + 30, h * 0.86, phoneLightUI, 1, -0.22);
  phoneDev(ctx, b.x + b.w * 0.78, cy + 30, h * 0.86, phoneSiteUI, 2, 0.22);
  phoneDev(ctx, b.x + b.w * 0.5, cy - 10, h, TELAS.financeiro, 3, 0);
};
// 6. Agenda: calendário do mês com horários marcados
CENA.agenda = (ctx, b, th, d) => {
  const w = Math.min(640, b.w * 0.72), h = Math.min(560, b.h * 0.9), x = b.x + (d.lado === "esq" ? 0 : b.w - w - 30), y = b.y + (b.h - h) / 2;
  glowAt(ctx, x + w / 2, y + h / 2, 420, 0.22); cardBox(ctx, x, y, w, h, th, 30);
  ctx.font = "700 32px MS"; ctx.fillStyle = ink(th); ctx.fillText("Novembro", x + 36, y + 62); ctx.font = "500 22px MS"; ctx.fillStyle = mut(th); ctx.fillText("12 horários hoje", x + 36, y + 94);
  const cw = (w - 72) / 7, top = y + 130, booked = [3, 4, 8, 10, 11, 15, 17, 18, 22, 24, 25, 29];
  "DSTQQSS".split("").forEach((l, k) => { ctx.font = "700 20px MS"; ctx.fillStyle = mut(th); ctx.textAlign = "center"; ctx.fillText(l, x + 36 + cw * k + cw / 2, top); });
  for (let n = 1; n <= 30; n++) { const k = (n + 5) % 7, r = Math.floor((n + 5) / 7), cx = x + 36 + cw * k + cw / 2, cy = top + 44 + r * Math.min(64, (h - 200) / 5);
    if (n === 18) { ctx.fillStyle = ON_BLUE; ctx.beginPath(); ctx.arc(cx, cy - 8, 26, 0, 7); ctx.fill(); }
    else if (booked.includes(n)) { ctx.fillStyle = th === "dark" ? "#1C2B52" : "#DCE7FF"; ctx.beginPath(); ctx.arc(cx, cy - 8, 26, 0, 7); ctx.fill(); }
    ctx.font = "600 22px MS"; ctx.fillStyle = n === 18 ? "#fff" : ink(th); ctx.fillText(String(n), cx, cy); }
  ctx.textAlign = "left";
  chip(ctx, d.lado === "esq" ? x + w - 120 : b.x, y + h - 70, th, "check", "Horário confirmado", "qui, 18 · 14:30", GREEN, -0.04);
};
// 7. Conversa: cliente pergunta e a resposta automática sai na hora
CENA.chat = (ctx, b, th, d) => {
  const w = Math.min(600, b.w * 0.68), h = Math.min(600, b.h * 0.96), x = b.x + (d.lado === "esq" ? 20 : b.w - w - 20), y = b.y + (b.h - h) / 2;
  glowAt(ctx, x + w / 2, y + h / 2, 420, 0.22); cardBox(ctx, x, y, w, h, th, 30);
  ctx.fillStyle = soft(th); rr(ctx, x, y, w, 100, [30, 30, 0, 0]); ctx.fill();
  ctx.fillStyle = ON_BLUE; ctx.beginPath(); ctx.arc(x + 56, y + 50, 28, 0, 7); ctx.fill(); icon(ctx, x + 38, y + 32, 36, "#fff");
  ctx.font = "700 26px MS"; ctx.fillStyle = ink(th); ctx.fillText(d.marca || "Sua Empresa", x + 100, y + 46); ctx.font = "500 19px MS"; ctx.fillStyle = GREEN; ctx.fillText("online agora", x + 100, y + 74);
  const msgs = d.msgs || [["Oi! Vocês fazem orçamento?", 0], ["Olá! Fazemos sim 😊 Qual serviço você procura?", 1], ["Um site para minha loja", 0], ["Perfeito! Te mando 3 horários para conversarmos:", 1]];
  let my = y + 140;
  msgs.forEach(([m, me]) => {
    ctx.font = "500 23px MS"; const lines = wrapRich(ctx, [{ t: m.replace(/[^\u0000-ɏ ]/g, "") }], w * 0.62), bw = Math.max(...lines.map((l) => l.reduce((a, q) => a + ctx.measureText(q.t).width, 0))) + 40, bh = lines.length * 30 + 30, bx = me ? x + w - 28 - bw : x + 28;
    if (my + bh > y + h - 20) return;
    ctx.fillStyle = me ? ON_BLUE : soft(th); rr(ctx, bx, my, bw, bh, 20); ctx.fill(); ctx.fillStyle = me ? "#fff" : ink(th);
    lines.forEach((l, q) => ctx.fillText(l.map((z) => z.t).join(""), bx + 20, my + 38 + q * 30)); my += bh + 16;
  });
  chip(ctx, d.lado === "esq" ? x + w - 100 : b.x, y + h * 0.36, th, "raio", "Resposta em 1 min", "atendimento automático", GREEN, 0.03);
};
// 8. Busca: o cliente procura e a sua empresa aparece primeiro
CENA.busca = (ctx, b, th, d) => {
  const w = Math.min(820, b.w * 0.94), x = b.x + (b.w - w) / 2, y = b.y + 10; glowAt(ctx, b.x + b.w / 2, b.y + b.h / 2, 460, 0.22);
  cardBox(ctx, x, y, w, 100, th, 50); lineIcon(ctx, "busca", x + 36, y + 32, 36, mut(th), 2.4);
  ctx.font = "500 30px MS"; ctx.fillStyle = ink(th); ctx.fillText(d.busca || "clínica perto de mim", x + 96, y + 61); ctx.fillStyle = ON_BLUE; ctx.fillRect(x + 96 + ctx.measureText(d.busca || "clínica perto de mim").width + 6, y + 34, 3, 36);
  const rs = [[d.marca || "Sua Empresa", "suaempresa.com.br", "★★★★★ 4,9 · Aberto agora", 1], ["Concorrente A", "concorrente-a.com", "★★★☆☆ 3,8", 0], ["Concorrente B", "concorrente-b.com", "Fechado", 0]];
  rs.forEach(([n, u, r, top], k) => {
    const ry = y + 140 + k * 150, rw = top ? w : w - 60, rx = top ? x : x + 30; if (ry + 130 > b.y + b.h + 40) return;
    ctx.save(); if (!top) ctx.globalAlpha = 0.55; cardBox(ctx, rx, ry, rw, 130, th, 22);
    if (top) { ctx.strokeStyle = ON_BLUE; ctx.lineWidth = 4; rr(ctx, rx, ry, rw, 130, 22); ctx.stroke(); ctx.fillStyle = ON_BLUE; rr(ctx, rx + rw - 150, ry + 20, 126, 38, 19); ctx.fill(); ctx.font = "700 18px MS"; ctx.fillStyle = "#fff"; ctx.fillText("1º lugar", rx + rw - 128, ry + 46); }
    ctx.font = "500 19px MS"; ctx.fillStyle = mut(th); ctx.fillText(u, rx + 30, ry + 40); ctx.font = "700 30px MS"; ctx.fillStyle = top ? ON_BLUE : ink(th); ctx.fillText(n, rx + 30, ry + 80); ctx.font = "500 20px MS"; ctx.fillStyle = top ? "#F5A524" : mut(th); ctx.fillText(r, rx + 30, ry + 112);
    ctx.restore();
  });
};
// 9. Gráfico: barras + linha de lucro e selos de resultado
CENA.grafico = (ctx, b, th, d) => {
  const w = Math.min(700, b.w * 0.78), h = Math.min(520, b.h * 0.86), x = b.x + (d.lado === "esq" ? 0 : b.w - w - 20), y = b.y + (b.h - h) / 2 + 20;
  glowAt(ctx, x + w / 2, y + h / 2, 440, 0.24); cardBox(ctx, x, y, w, h, th, 30);
  ctx.font = "700 30px MS"; ctx.fillStyle = ink(th); ctx.fillText(d.titulo || "Resultado do mês", x + 36, y + 60); ctx.font = "800 54px MS"; ctx.fillText(d.valor || "R$ 16.000", x + 36, y + 130);
  const r = seeded((d.seed || 1) + 4), n = 7, gx = x + 36, gw = w - 72, gy = y + 170, gh = h - 220, bw = gw / n - 18;
  const vals = Array.from({ length: n }, (_, k) => 0.3 + k * 0.09 + r() * 0.12);
  vals.forEach((v, k) => { ctx.fillStyle = k === n - 1 ? ON_BLUE : th === "dark" ? "#22325C" : "#CFDDFB"; rr(ctx, gx + k * (bw + 18), gy + gh - gh * v, bw, gh * v, 10); ctx.fill(); });
  ctx.strokeStyle = GREEN; ctx.lineWidth = 5; ctx.beginPath(); vals.forEach((v, k) => { const px = gx + k * (bw + 18) + bw / 2, py = gy + gh - gh * v - 34; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
  chip(ctx, x + w - 300, y - 52, th, "grafico", d.chip || "Lucro +21%", d.chipSub || "vs. mês passado", GREEN, -0.03);
  chip(ctx, Math.max(b.x - 10, x - 90), y + h - 70, th, "dinheiro", "Taxas e comissões", "descontadas sozinhas", ON_BLUE, 0.03);
};
// 10. Lista de tarefas com progresso (organização)
CENA.lista = (ctx, b, th, d) => {
  const w = Math.min(620, b.w * 0.7), h = Math.min(560, b.h * 0.92), x = b.x + (d.lado === "esq" ? 10 : b.w - w - 10), y = b.y + (b.h - h) / 2;
  glowAt(ctx, x + w / 2, y + h / 2, 420, 0.22); cardBox(ctx, x, y, w, h, th, 30);
  ctx.font = "700 32px MS"; ctx.fillStyle = ink(th); ctx.fillText(d.titulo || "Tarefas da equipe", x + 36, y + 64);
  ctx.fillStyle = soft(th); rr(ctx, x + 36, y + 92, w - 72, 14, 7); ctx.fill(); ctx.fillStyle = ON_BLUE; rr(ctx, x + 36, y + 92, (w - 72) * 0.72, 14, 7); ctx.fill();
  const items = d.itens || [["Confirmar agenda", "Ana", 1], ["Enviar orçamento", "Bruno", 1], ["Separar pedidos", "Carla", 1], ["Fechar o caixa", "Diego", 0], ["Ligar para fornecedor", "Ana", 0]];
  items.forEach(([t, who, ok], k) => { const iy = y + 140 + k * Math.min(82, (h - 170) / items.length); if (iy + 60 > y + h) return;
    ctx.fillStyle = ok ? ON_BLUE : "transparent"; ctx.strokeStyle = ok ? ON_BLUE : "#C5CEDD"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 58, iy + 24, 17, 0, 7); ctx.fill(); ctx.stroke();
    if (ok) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 50, iy + 24); ctx.lineTo(x + 56, iy + 31); ctx.lineTo(x + 67, iy + 17); ctx.stroke(); }
    ctx.font = "600 25px MS"; ctx.fillStyle = ok ? mut(th) : ink(th); ctx.fillText(t, x + 92, iy + 33);
    ctx.fillStyle = soft(th); rr(ctx, x + w - 128, iy + 6, 92, 36, 18); ctx.fill(); ctx.font = "600 18px MS"; ctx.fillStyle = mut(th); ctx.textAlign = "center"; ctx.fillText(who, x + w - 82, iy + 30); ctx.textAlign = "left"; });
  chip(ctx, d.lado === "esq" ? x + w - 120 : b.x, y + h * 0.62, th, "pessoas", "72% concluído", "atualizado agora", GREEN, -0.03);
};
// 11. Segurança: escudo grande e selos
CENA.seguranca = (ctx, b, th, d) => {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, s = Math.min(b.h * 0.85, 460); glowAt(ctx, cx, cy, 480, 0.35);
  ctx.save(); ctx.translate(cx - s / 2, cy - s / 2); ctx.scale(s / 24, s / 24);
  const p = new Path2D("M12 2.5l8 3v6.2c0 5.1-3.4 8.6-8 9.8-4.6-1.2-8-4.7-8-9.8V5.5z"); const g = ctx.createLinearGradient(4, 2, 20, 22); g.addColorStop(0, "#4D8DFF"); g.addColorStop(1, "#0E4FD6");
  ctx.shadowColor = "rgba(0,30,120,.45)"; ctx.shadowBlur = 2; ctx.shadowOffsetY = 0.8; ctx.fillStyle = g; ctx.fill(p); ctx.shadowColor = "transparent"; ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 0.35; ctx.stroke(p);
  ctx.fillStyle = "#fff"; rr(ctx, 8.6, 10.6, 6.8, 5.6, 1); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(12, 10.6, 2.1, Math.PI, 0); ctx.stroke(); ctx.fillStyle = "#0E4FD6"; ctx.beginPath(); ctx.arc(12, 13, 0.8, 0, 7); ctx.fill();
  ctx.restore();
  chip(ctx, b.x, b.y + b.h * 0.12, th, "nuvem", "Backup diário", "seus dados guardados", ON_BLUE, -0.04);
  chip(ctx, b.x + b.w - 380, b.y + b.h * 0.42, th, "chave", "Acesso por perfil", "cada um vê o que precisa", GREEN, 0.03);
  chip(ctx, b.x + 30, b.y + b.h * 0.76, th, "escudo", "Dados criptografados", "boas práticas de LGPD", ON_BLUE, -0.02);
};
// 12. Orçamento: documento com total e botão de aprovar
CENA.documento = (ctx, b, th, d) => {
  const w = Math.min(560, b.w * 0.64), h = Math.min(600, b.h * 0.98), x = b.x + (d.lado === "esq" ? 10 : b.w - w - 30), y = b.y + (b.h - h) / 2;
  glowAt(ctx, x + w / 2, y + h / 2, 420, 0.24);
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(0.03); ctx.translate(-w / 2, -h / 2); cardBox(ctx, 0, 0, w, h, th, 24);
  icon(ctx, 36, 34, 44, ON_BLUE); ctx.font = "800 30px MS"; ctx.fillStyle = ink(th); ctx.fillText("Orçamento #248", 92, 66); ctx.font = "500 20px MS"; ctx.fillStyle = mut(th); ctx.fillText("válido por 7 dias", 92, 94);
  const step = Math.min(66, (h - 330) / 3);
  [["Site institucional", "R$ 2.900"], ["Agenda online", "R$ 1.200"], ["Hospedagem 12 meses", "R$ 700"]].forEach(([a, v], k) => { const ly = 156 + k * step; ctx.fillStyle = soft(th); ctx.fillRect(36, ly + 22, w - 72, 2); ctx.font = "500 24px MS"; ctx.fillStyle = ink(th); ctx.fillText(a, 36, ly); ctx.textAlign = "right"; ctx.fillText(v, w - 36, ly); ctx.textAlign = "left"; });
  ctx.font = "700 24px MS"; ctx.fillStyle = mut(th); ctx.fillText("Total", 36, h - 160); ctx.font = "800 48px MS"; ctx.fillStyle = ON_BLUE; ctx.fillText("R$ 4.800", 120, h - 156);
  ctx.fillStyle = GREEN; rr(ctx, 36, h - 106, w - 72, 70, 35); ctx.fill(); ctx.font = "700 26px MS"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText("Aprovar orçamento", w / 2, h - 66); ctx.textAlign = "left";
  ctx.restore();
  chip(ctx, d.lado === "esq" ? x + w - 200 : Math.max(b.x - 10, x - 230), y - 46, th, "chat", "Enviado no WhatsApp", "há 2 minutos", GREEN, -0.04);
};
// 13. Estoque: produtos com nível e alerta de estoque baixo
CENA.estoque = (ctx, b, th, d) => {
  const w = Math.min(660, b.w * 0.74), h = Math.min(540, b.h * 0.92), x = b.x + (d.lado === "esq" ? 10 : b.w - w - 20), y = b.y + (b.h - h) / 2;
  glowAt(ctx, x + w / 2, y + h / 2, 420, 0.22); cardBox(ctx, x, y, w, h, th, 30);
  ctx.font = "700 32px MS"; ctx.fillStyle = ink(th); ctx.fillText("Estoque", x + 36, y + 64);
  [["Camiseta básica P", 0.82], ["Tênis runner 41", 0.56], ["Boné aba reta", 0.12], ["Mochila urbana", 0.68], ["Garrafa térmica", 0.34]].forEach(([n, v], k) => {
    const iy = y + 116 + k * Math.min(84, (h - 140) / 5); if (iy + 60 > y + h) return;
    ctx.fillStyle = soft(th); rr(ctx, x + 36, iy, 56, 56, 14); ctx.fill(); lineIcon(ctx, "caixa", x + 48, iy + 12, 32, v < 0.2 ? RED : ON_BLUE, 2.2);
    ctx.font = "600 24px MS"; ctx.fillStyle = ink(th); ctx.fillText(n, x + 112, iy + 24);
    ctx.fillStyle = soft(th); rr(ctx, x + 112, iy + 38, w - 260, 12, 6); ctx.fill(); ctx.fillStyle = v < 0.2 ? RED : ON_BLUE; rr(ctx, x + 112, iy + 38, (w - 260) * v, 12, 6); ctx.fill();
    ctx.font = "700 22px MS"; ctx.fillStyle = v < 0.2 ? RED : mut(th); ctx.textAlign = "right"; ctx.fillText(Math.round(v * 60) + " un", x + w - 36, iy + 48); ctx.textAlign = "left";
  });
  chip(ctx, d.lado === "esq" ? x + w - 120 : b.x, y + h * 0.5, th, "x", "Estoque baixo", "Boné aba reta · 7 un", RED, -0.04);
};
// 14. Código: editor escuro + deploy concluído
CENA.codigo = (ctx, b, th, d) => {
  const w = Math.min(700, b.w * 0.8), h = Math.min(500, b.h * 0.86), x = b.x + (d.lado === "esq" ? 10 : b.w - w - 20), y = b.y + (b.h - h) / 2;
  glowAt(ctx, x + w / 2, y + h / 2, 440, 0.3);
  ctx.save(); ctx.shadowColor = "rgba(0,10,40,.5)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24; ctx.fillStyle = "#0B1020"; rr(ctx, x, y, w, h, 24); ctx.fill(); ctx.restore();
  ctx.strokeStyle = "rgba(127,176,255,.3)"; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 24); ctx.stroke();
  ["#FF5F57", "#FEBC2E", "#28C840"].forEach((c, k) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 34 + k * 28, y + 34, 9, 0, 7); ctx.fill(); });
  ctx.font = "400 20px JB"; ctx.fillStyle = "#8C98B5"; ctx.fillText(d.arquivo || "automacao.ts", x + 130, y + 41);
  const L = d.codigo || [[["// todo dia às 8h", "#5B6B8C"]], [["agenda", "#E6ECFF"], [".", "#9AA7C7"], ["lembrar", "#F2C46D"], ["(", "#9AA7C7"], ["clientes", "#E6ECFF"], [")", "#9AA7C7"]], [["financeiro", "#E6ECFF"], [".", "#9AA7C7"], ["fecharCaixa", "#F2C46D"], ["()", "#9AA7C7"]], [["relatorio", "#E6ECFF"], [".", "#9AA7C7"], ["enviar", "#F2C46D"], ["(", "#9AA7C7"], ['"whatsapp"', "#7EE0A1"], [")", "#9AA7C7"]]];
  L.forEach((ln, k) => { let lx = x + 70; ctx.font = "400 24px JB"; ctx.fillStyle = "#2E3A5C"; ctx.fillText(String(k + 1), x + 36, y + 110 + k * 46); ln.forEach(([t, c]) => { ctx.fillStyle = c; ctx.fillText(t, lx, y + 110 + k * 46); lx += ctx.measureText(t).width; }); });
  ctx.font = "400 22px JB"; ctx.fillStyle = "#7EE0A1"; ctx.fillText("✓ 3 tarefas feitas sozinhas", x + 36, y + h - 40);
  chip(ctx, d.lado === "esq" ? x + w - 100 : b.x, y - 20, "light", "raio", d.chip || "Automático", d.chipSub || "sem ninguém digitar", GREEN, -0.04);
};
// 15. Notificações empilhadas (lembretes)
CENA.notificacoes = (ctx, b, th, d) => {
  const cx = b.x + b.w / 2; glowAt(ctx, cx, b.y + b.h / 2, 460, 0.28);
  phoneDev(ctx, b.x + b.w * (d.lado === "esq" ? 0.28 : 0.72), b.y + b.h * 0.6, Math.min(700, b.h * 1.1), phoneLightUI, 1, d.lado === "esq" ? -0.12 : 0.12);
  const ns = d.notifs || [["agenda", "Lembrete de horário", "Amanhã às 14:30 · confirme", ON_BLUE], ["check", "Cliente confirmou", "Mariana · 14:30", GREEN], ["chat", "Mensagem automática", "enviada para 12 clientes", "#7C5CFF"]];
  ns.forEach(([ic, a, s2, c], k) => chip(ctx, d.lado === "esq" ? b.x + b.w * 0.36 + k * 18 : b.x + k * 26, b.y + 40 + k * 140, th, ic, a, s2, c, (k - 1) * 0.025, 470));
};
// 16. Estrela 3D com selos dos serviços
CENA.estrela = (ctx, b, th, d) => {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2; logo3d(ctx, cx, cy, Math.min(b.h * 0.95, 560), { glow: th !== "light", rot: -0.18 });
  chip(ctx, b.x, b.y + b.h * 0.1, th, "site", "Sites", null, ON_BLUE, -0.05); chip(ctx, b.x + b.w - 260, b.y + b.h * 0.32, th, "painel", "Sistemas", null, GREEN, 0.04); chip(ctx, b.x + 40, b.y + b.h * 0.74, th, "app", "Aplicativos", null, "#7C5CFF", -0.03);
};

// Cena padrão pelo assunto (quando o post não diz qual quer).
function cenaPadrao(d) {
  const t = d.tela;
  if (t === "site") return "duo"; if (t === "agenda") return "agenda"; if (t === "vendas") return "grafico"; if (t === "pedidos") return "estoque"; if (t === "barbearia") return "celular";
  const m = { site: "notebook", painel: "tablet", app: "trio", chat: "chat", escudo: "seguranca", codigo: "codigo", agenda: "agenda", grafico: "grafico", doc: "documento", pessoas: "lista", relogio: "notificacoes", foguete: "estrela", chave: "seguranca", nuvem: "seguranca", busca: "busca", lapis: "duo", caixa: "estoque", raio: "codigo", check: "lista", dinheiro: "grafico", alvo: "grafico" };
  return m[d.ic] || "tablet";
}
function cena(ctx, nome, box, th, d = {}) { (CENA[nome] || CENA[cenaPadrao(d)] || CENA.tablet)(ctx, box, th, d); }

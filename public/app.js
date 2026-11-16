/* Tela do app: login, dias, cartão do post (salvar fotos, copiar legenda, marcar postado) e notificações.
   Um post a cada "cadaDias" dias (banco.json); nos outros dias a tela mostra quando é o próximo. */
const PER = 1;
const $ = (s, el = document) => el.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
};
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
const today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) => ymd(a) === ymd(b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let selected = today0();
let cards = []; // cartões do dia selecionado

function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 2400); }
const key = (kind, date, j) => kind + ":" + ymd(date) + ":" + j;
const flag = (kind, date, j) => store.get(key(kind, date, j)) === "1";
const setFlag = (kind, date, j, v) => store.set(key(kind, date, j), v ? "1" : null);
const isDone = (date, j) => flag("done", date, j);

/* ---------- login ---------- */
function showLogin() {
  $("#app").hidden = true; $("#login").hidden = false;
  setTimeout(() => $("#email").focus(), 50);
}
$("#showPass").onclick = () => { const i = $("#password"); i.type = i.type === "password" ? "text" : "password"; };
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#loginErr"), btn = $("#loginBtn");
  err.hidden = true; btn.disabled = true; btn.textContent = "Entrando…";
  try {
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: $("#email").value, password: $("#password").value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Não deu pra entrar. Tente de novo.");
    $("#password").value = "";
    await boot();
  } catch (x) { err.textContent = x.message === "Failed to fetch" ? "Sem internet. Conecte e tente de novo." : x.message; err.hidden = false; }
  btn.disabled = false; btn.textContent = "Entrar";
});

/* ---------- salvar e copiar ---------- */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    let ok = false; try { ok = document.execCommand("copy"); } catch (e2) {}
    ta.remove(); return ok;
  }
}
async function saveFiles(files) {
  // iPhone/iPad: menu do sistema -> "Salvar N imagens" vai direto pra galeria, na ordem.
  if (isIOS && navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files }); return "shared"; }
    catch (e) { return e && e.name === "AbortError" ? "cancel" : "fail"; }
  }
  // Android e computador: baixa cada imagem em ordem (01, 02, 03…).
  for (const f of files) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    await sleep(400);
  }
  return "downloaded";
}

/* ---------- semana e cabeçalho ---------- */
// Só aparecem os dias que têm post (1 a cada "cadaDias" dias, até o fim do banco).
function postDays() { const [y, m, d] = BANK.inicio.split("-").map(Number); return BANK.posts.map((_, k) => new Date(y, m - 1, d + k * every())); }
function firstFrom(from) { return postDays().find((d) => d >= from) || null; }
function renderWeek() {
  const days = $("#days"); days.innerHTML = "";
  const t = today0(), list = postDays(), idx = Math.max(0, list.findIndex((d) => sameDay(d, selected))), start = Math.floor(idx / 7) * 7;
  list.slice(start, start + 7).forEach((d) => {
    const b = document.createElement("button");
    b.className = "day" + (sameDay(d, t) ? " today" : "") + (d < t ? " past" : "");
    b.setAttribute("aria-current", sameDay(d, selected));
    b.setAttribute("aria-label", d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
    b.innerHTML = `<small>${d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3)}</small><b>${d.getDate()}</b><em>${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</em>`;
    if (isDone(d, 0)) b.appendChild(document.createElement("i"));
    b.onclick = () => { if (!sameDay(d, selected)) { selected = d; renderDay(); } };
    days.appendChild(b);
  });
  $("#prevW").disabled = start === 0; $("#nextW").disabled = start + 7 >= list.length;
  $("#prevW").onclick = () => { selected = list[Math.max(0, start - 7)]; renderDay(); };
  $("#nextW").onclick = () => { selected = list[Math.min(list.length - 1, start + 7)]; renderDay(); };
}
function nextPostDay(from) { return postDays().find((d) => d >= from && !isDone(d, 0)) || null; }
function renderProgress() {
  const t = today0(), postDay = isPostDay(t), doneN = postDay && isDone(t, 0) ? 1 : 0;
  $("#ring").hidden = !postDay;
  $("#ringTxt").textContent = doneN + "/1";
  $("#ringArc").style.strokeDashoffset = 119.4 * (1 - doneN);
  $("#ring").classList.toggle("full", doneN === 1);
  $("#ring").setAttribute("aria-label", doneN ? "Post de hoje feito" : "Post de hoje pendente");
  const n = nextPostDay(t);
  if (!n) { $("#nextUp").textContent = "Banco de posts acabou"; return; }
  const diff = Math.round((n - t) / 864e5);
  $("#nextUp").textContent = "Próximo post: " + (diff === 0 ? "hoje" : diff === 1 ? "amanhã" : n.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })) + " às " + BANK.horarios[0];
}

/* ---------- cartões ---------- */
function updateCard(c) {
  const s = flag("saved", selected, c.j), cp = flag("copied", selected, c.j), d = isDone(selected, c.j);
  c.el.classList.toggle("is-done", d);
  const steps = [[c.saveBtn, s], [c.copyBtn, cp], [c.postBtn, d]];
  const cur = steps.findIndex(([, ok]) => !ok);
  steps.forEach(([b, ok], i) => { b.classList.toggle("is-ok", ok); b.classList.toggle("is-cur", i === cur); });
  $(".tx small", c.saveBtn).textContent = s ? "Fotos salvas · toque pra salvar de novo" : "Vão pra galeria, em ordem";
  $(".tx small", c.copyBtn).textContent = cp ? "Copiada · cole no Instagram" : "Texto e hashtags";
}
function layout(scrollToNext) {
  const pending = $("#pending"), done = $("#done");
  const p = cards.filter((c) => !isDone(selected, c.j)), d = cards.filter((c) => isDone(selected, c.j));
  p.forEach((c) => pending.appendChild(c.el)); d.forEach((c) => done.appendChild(c.el));
  cards.forEach((c) => { c.el.classList.toggle("is-next", c === p[0] && sameDay(selected, today0())); updateCard(c); });
  $("#doneTitle").hidden = d.length === 0 || p.length === 0;
  $("#allDone").hidden = p.length > 0;
  if (scrollToNext && p[0]) {
    const y = p[0].el.getBoundingClientRect().top + scrollY - $(".top").offsetHeight - 12;
    scrollTo({ top: Math.max(0, y), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
}
function withTransition(fn) {
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(fn);
  else fn();
}
function setDone(c, v) {
  setFlag("done", selected, c.j, v);
  withTransition(() => layout(v));
  renderProgress(); renderWeek();
  if (v) toast("Post marcado como postado ✓");
}

function buildCard(gi, j) {
  const post = buildPost(BANK.posts[gi], gi), base = ymd(selected) + "_armetec";
  const el = $("#tpl-post").content.firstElementChild.cloneNode(true);
  el.style.viewTransitionName = "post-" + j;
  const c = { j, el, post, files: null, saveBtn: $(".save", el), copyBtn: $(".copy", el), postBtn: $(".post-btn", el) };
  $(".time", el).textContent = BANK.horarios[j] || "";
  const FMT = { institucional: "Carrossel institucional", dor: "Carrossel problema → solução", mockup: "Foto com mockup", frase: "Frase" };
  $(".meta", el).textContent = (FMT[post.f] || post.f) + " · " + post.k + " · " + post.slides.length + (post.slides.length > 1 ? " slides" : " foto");
  $(".hook", el).textContent = post.hook;
  $(".cap-txt", el).textContent = post.caption;
  $(".mini-time", el).textContent = BANK.horarios[j] + " · postado";
  $(".mini-hook", el).textContent = post.hook;
  $(".save b", el).textContent = post.slides.length > 1 ? "Salvar " + post.slides.length + " fotos" : "Salvar a foto";

  // slides
  const track = $(".track", el), dots = $(".dots", el), total = post.slides.length;
  post.slides.forEach((_, k) => { const i = document.createElement("i"); if (!k) i.className = "on"; dots.appendChild(i); });
  Promise.all(post.slides.map((s, k) => new Promise((res) => drawSlide(s, k + 1, total).toBlob(res, "image/jpeg", 0.94)))).then((bs) => {
    c.files = bs.map((b, k) => new File([b], base + "_" + String(k + 1).padStart(2, "0") + ".jpg", { type: "image/jpeg" }));
    c.files.forEach((f, k) => { const im = new Image(); im.alt = "Slide " + (k + 1) + " de " + total; im.decoding = "async"; im.src = URL.createObjectURL(f); track.appendChild(im); });
  });
  const at = () => Math.round(track.scrollLeft / track.clientWidth);
  track.addEventListener("scroll", () => { const k = at(); [...dots.children].forEach((d, i) => d.classList.toggle("on", i === k)); }, { passive: true });
  $(".arrow.l", el).onclick = () => track.scrollTo({ left: (at() - 1) * track.clientWidth, behavior: "smooth" });
  $(".arrow.r", el).onclick = () => track.scrollTo({ left: (at() + 1) * track.clientWidth, behavior: "smooth" });

  // legenda
  const more = $(".cap-more", el);
  more.onclick = () => { const o = $(".cap", el).classList.toggle("open"); more.textContent = o ? "Mostrar menos" : "Ver legenda completa"; };

  // passos
  c.saveBtn.onclick = async () => {
    if (!c.files) return toast("Preparando as fotos, toque de novo");
    const r = await saveFiles(c.files);
    if (r === "shared" || r === "downloaded") { setFlag("saved", selected, j, true); updateCard(c); toast(r === "shared" ? "Fotos salvas na galeria" : total + " fotos baixadas, em ordem"); }
    else if (r === "fail") toast("Não deu pra salvar. Tente de novo.");
  };
  c.copyBtn.onclick = async () => {
    if (await copyText(post.caption)) { setFlag("copied", selected, j, true); updateCard(c); toast("Legenda copiada"); }
    else toast("Não consegui copiar. Abra a legenda e copie segurando o texto.");
  };
  c.postBtn.onclick = () => setDone(c, true);
  $(".undo", el).onclick = () => setDone(c, false);
  return c;
}

function renderDay() {
  const t = today0(), diff = Math.round((selected - t) / 864e5);
  $("#dTitle").textContent = diff === 0 ? "Hoje" : diff === 1 ? "Amanhã" : diff === -1 ? "Ontem" : selected.toLocaleDateString("pt-BR", { weekday: "long" });
  const postDay = isPostDay(selected);
  $("#dSub").textContent = selected.toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) + (postDay ? " · post às " + BANK.horarios[0] : " · sem post");
  const n = BANK.posts.length, seq = postSeq(selected), left = n - postSeq(t), note = $("#note");
  if (postDay && (seq >= n || seq < 0)) { note.hidden = false; note.textContent = "O banco de posts acabou e este dia repete conteúdo. Peça pro Claude recarregar o banco."; }
  else if (left <= 4) { note.hidden = false; note.textContent = "Faltam " + Math.max(left, 0) + " posts no banco (" + Math.max(left, 0) * every() + " dias). Peça pro Claude recarregar."; }
  else note.hidden = true;
  renderWeek();
  $("#pending").innerHTML = ""; $("#done").innerHTML = "";
  cards.forEach((c) => $$imgs(c).forEach((u) => URL.revokeObjectURL(u)));
  cards = postDay ? [buildCard(postIndex(selected), 0)] : [];
  $("#allBtn").hidden = !postDay;
  $("#offDay").hidden = postDay;
  if (!postDay) { const nx = firstFrom(selected); $("#offTxt").textContent = nx ? "O próximo post é " + nx.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) + "." : "O banco de posts acabou. Peça pro Claude recarregar."; $("#offBtn").hidden = !nx; if (nx) $("#offBtn").onclick = () => { selected = nx; renderDay(); }; }
  layout(false);
  if (!postDay) $("#allDone").hidden = true;
  renderProgress();
}
const $$imgs = (c) => [...c.el.querySelectorAll(".track img")].map((i) => i.src);

$("#allBtn").onclick = async () => {
  const list = cards.filter((c) => !isDone(selected, c.j)).length ? cards.filter((c) => !isDone(selected, c.j)) : cards;
  if (list.some((c) => !c.files)) return toast("Preparando as fotos, toque de novo");
  const files = list.flatMap((c) => c.files), r = await saveFiles(files);
  if (r === "shared" || r === "downloaded") { list.forEach((c) => { setFlag("saved", selected, c.j, true); updateCard(c); }); toast(files.length + " fotos salvas, em ordem"); }
};

/* ---------- notificações ---------- */
const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4), raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (ch) => ch.charCodeAt(0)); };
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
async function currentSub() { if (!pushSupported()) return null; const reg = await navigator.serviceWorker.ready; return reg.pushManager.getSubscription(); }
async function refreshPushUI() {
  const btn = $("#pushBtn"), txt = $("#pushTxt"), test = $("#testBtn"), inst = $("#installRow");
  inst.hidden = isStandalone();
  $("#installTxt").textContent = isIOS ? "No Safari: Compartilhar → Adicionar à Tela de Início." : "No Chrome: menu ⋮ → Instalar app.";
  if (isIOS && !isStandalone()) { btn.hidden = true; test.hidden = true; txt.textContent = "No iPhone, instale o app na Tela de Início e abra por lá para ativar."; $("#bellPip").hidden = false; return; }
  if (!pushSupported()) { btn.hidden = true; test.hidden = true; txt.textContent = "Este navegador não recebe notificações."; return; }
  if (!BANK.push) {
    btn.hidden = true; test.hidden = true; txt.textContent = "Verificando a configuração…";
    try { const st = await (await fetch("/api/status", { cache: "no-store" })).json(); txt.textContent = st.missing && st.missing.length ? "Falta na Vercel: " + st.missing.join("; ") + ". Depois, faça Redeploy." : "Configurado. Feche e abra o app de novo."; }
    catch (e) { txt.textContent = "Falta terminar a configuração na Vercel."; }
    return;
  }
  btn.hidden = false;
  if (Notification.permission === "denied") { btn.hidden = true; test.hidden = true; txt.textContent = "Bloqueadas. Libere nas configurações do celular para este app."; return; }
  const sub = await currentSub();
  btn.textContent = sub ? "Desativar" : "Ativar"; btn.className = "btn small " + (sub ? "dark" : "gold");
  txt.textContent = sub ? "Ativadas: aviso perto das " + BANK.horarios[0] + " nos dias de post." : "Aviso no celular na hora de cada post.";
  test.hidden = !sub; $("#bellPip").hidden = Boolean(sub);
}
$("#pushBtn").onclick = async () => {
  const btn = $("#pushBtn"); btn.disabled = true;
  try {
    const existing = await currentSub();
    if (existing) {
      await fetch("/api/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: existing.toJSON() }) });
      await existing.unsubscribe(); toast("Notificações desativadas");
    } else {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast("Permissão negada"); }
      else {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(BANK.vapid) });
        const r = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
        if (!r.ok) { await sub.unsubscribe(); throw new Error((await r.json().catch(() => ({}))).error || "Não deu pra ativar."); }
        toast("Notificações ativadas");
      }
    }
  } catch (e) { toast(e.message || "Não deu pra ativar agora."); }
  btn.disabled = false; refreshPushUI();
};
$("#testBtn").onclick = async () => {
  const r = await fetch("/api/test-push", { method: "POST" }).catch(() => null);
  toast(r && r.ok ? "Notificação enviada" : "Não deu pra enviar o teste.");
};

/* ---------- ajustes ---------- */
function openSheet(v) { $("#sheet").hidden = !v; $("#sheetBg").hidden = !v; if (v) { refreshPushUI(); refreshSocialUI(); } }

/* ---------- postagem automática ---------- */
const NETS = { instagram: "Instagram" };
async function refreshSocialUI() {
  let st;
  try { const r = await fetch("/api/social", { cache: "no-store" }); st = await r.json(); if (!r.ok) throw new Error(st.error); }
  catch (e) { Object.keys(NETS).forEach((n) => { $(".net-txt", $("#net-" + n)).textContent = "Não consegui verificar agora."; $(".net-btn", $("#net-" + n)).hidden = true; }); return; }
  for (const net of Object.keys(NETS)) {
    const row = $("#net-" + net), txt = $(".net-txt", row), btn = $(".net-btn", row), info = st[net] || {}, on = st.config && st.config[net];
    const appOk = st.setup && (net === "instagram" ? st.setup.instagramApp : st.setup.tiktokApp);
    txt.className = "net-txt"; btn.hidden = false; btn.disabled = false;
    if (st.error) { txt.textContent = "Falta conectar o banco Redis na Vercel."; btn.hidden = true; continue; }
    if (!appOk) { txt.textContent = "Falta criar o app de desenvolvedor e as chaves na Vercel (veja o README)."; btn.hidden = true; continue; }
    if (!info.connected) { txt.textContent = "Não conectado."; btn.textContent = "Conectar"; btn.className = "btn small gold net-btn"; btn.onclick = () => (location.href = "/api/conectar?net=" + net); continue; }
    if (info.error) { txt.textContent = "Erro: " + info.error; txt.classList.add("bad"); btn.textContent = "Reconectar"; btn.className = "btn small gold net-btn"; btn.onclick = () => (location.href = "/api/conectar?net=" + net); continue; }
    const who = info.username ? "@" + info.username : info.name || "conta conectada";
    txt.textContent = on ? who + " · posta sozinho a cada " + every() + " dias, às " + BANK.horarios[0] : who + " · postagem automática desligada";
    if (on) txt.classList.add("on");
    btn.textContent = on ? "Desligar" : "Ligar"; btn.className = "btn small " + (on ? "dark" : "gold") + " net-btn";
    btn.onclick = async () => {
      btn.disabled = true;
      const r = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [net]: !on }) }).catch(() => null);
      toast(r && r.ok ? NETS[net] + (on ? ": automático desligado" : ": vai postar sozinho") : "Não deu pra salvar.");
      refreshSocialUI();
    };
  }
  $("#igManual").hidden = !(st.igPending && !(st.instagram && st.instagram.connected));
}
$("#igManual").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#igId").value.replace(/\D/g, ""), btn = $("#igManual button");
  if (!id) return toast("Cole o ID da conta (só números).");
  btn.disabled = true; btn.textContent = "Conferindo…";
  try {
    const r = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ igManual: { id } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Não deu certo.");
    toast("Instagram conectado ✓ " + (j.instagram && j.instagram.username ? "@" + j.instagram.username : ""));
    $("#igId").value = ""; refreshSocialUI();
  } catch (x) { toast(x.message); }
  btn.disabled = false; btn.textContent = "Concluir";
});
// Volta da tela de autorização do Instagram/TikTok.
(() => {
  const q = new URLSearchParams(location.search), net = q.get("rede");
  if (!net || !NETS[net]) return;
  history.replaceState(null, "", "/");
  let tries = 0;
  const go = () => { if (!BANK && tries++ < 20) return setTimeout(go, 300); toast(q.get("ok") ? NETS[net] + " conectado ✓" : NETS[net] + ": " + (q.get("erro") || "não conectou")); if (BANK) openSheet(true); };
  go();
})();
$("#menuBtn").onclick = () => openSheet(true);
$("#sheetBg").onclick = () => openSheet(false);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") openSheet(false); });
$("#logoutBtn").onclick = async () => {
  try { const s = await currentSub(); if (s) { await fetch("/api/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: s.toJSON() }) }); await s.unsubscribe(); } } catch (e) {}
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  try { for (const k of await caches.keys()) await caches.delete(k); } catch (e) {}
  location.reload();
};

/* ---------- início ---------- */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !BANK) return;
  renderProgress();
});
async function boot() {
  const [r] = await Promise.all([fetch("/api/banco", { cache: "no-cache" }), loadLogo(), ...FONTS.map((f) => document.fonts.load(f))]);
  if (r.status === 401) return showLogin();
  if (!r.ok) throw new Error("http " + r.status);
  BANK = await r.json();
  { const l = postDays(); selected = firstFrom(today0()) || l[l.length - 1]; } // abre no próximo dia com post
  $("#login").hidden = true; $("#app").hidden = false;
  renderDay();
  refreshPushUI().catch(() => {});
}
boot().catch(() => { $("#app").hidden = false; $("#nextUp").textContent = "Sem conexão"; $("#dSub").textContent = "Não consegui carregar os posts. Verifique a internet e abra de novo."; });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

// Futbol bo'limi: prognoz o'yini, o'yin eslatmalari va jonli efir reaksiyalari.
// fifa.js'dan oldin yuklanadi va window.FifaFun orqali ulanadi.
(function initFifaFun() {
  if (window.FifaFun) return;
  const API = "/api/categories?type=";
  const ASSET_VERSION = "20261028-fifa-fun-v1";
  const REACTIONS = ["⚽", "🔥", "👏", "😍", "😂", "😱"];
  const DAY_NAMES = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const TASHKENT_OFFSET_MS = 5 * 3600 * 1000;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `/static/fifa/fifa-fun.css?v=${ASSET_VERSION}`;
  document.head.appendChild(link);

  const tg = () => window.Telegram?.WebApp;
  const initData = () => tg()?.initData || "";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const haptic = (kind = "light") => { try { tg()?.HapticFeedback?.impactOccurred(kind); } catch (_) {} };
  const notify = (kind) => { try { tg()?.HapticFeedback?.notificationOccurred(kind); } catch (_) {} };

  function toast(msg) {
    if (typeof window.showToast === "function") return window.showToast(msg);
    let el = document.getElementById("fifaFunToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "fifaFunToast";
      el.className = "ff-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-on"), 2600);
  }

  async function api(type, { method = "GET", body, query = "" } = {}) {
    const headers = { Accept: "application/json" };
    if (initData()) headers["X-TG-Init-Data"] = initData();
    if (body) headers["Content-Type"] = "application/json";
    const res = await fetch(`${API}${type}${query}`, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok !== false, status: res.status, data };
  }

  function tashkentParts(ms) {
    const d = new Date(ms + TASHKENT_OFFSET_MS);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), dow: d.getUTCDay(), hh: d.getUTCHours(), mm: d.getUTCMinutes() };
  }
  const dayKey = (ms) => { const p = tashkentParts(ms); return `${p.y}-${p.m}-${p.day}`; };
  const clock = (ms) => { const p = tashkentParts(ms); return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`; };
  function dayLabel(ms) {
    const now = Date.now();
    if (dayKey(ms) === dayKey(now)) return "Bugun";
    if (dayKey(ms) === dayKey(now + 86400000)) return "Ertaga";
    const p = tashkentParts(ms);
    return `${DAY_NAMES[p.dow]}, ${p.day}-${MONTHS[p.m]}`;
  }
  const logo = (url, alt) => (url ? `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">` : `<span class="ff-logo-fallback">${esc(String(alt || "?").charAt(0))}</span>`);
  const canTrack = (m) => /^\d{3,12}$/.test(String(m?.id || "")) && /^[a-z]{2,6}\.[a-z0-9_.]{1,24}$/i.test(String(m?.leagueId || ""));

  // =====================================================================
  // Eslatmalar: o'yin boshlanishidan 15 daqiqa oldin botdan xabar keladi.
  // =====================================================================
  const reminders = new Set();
  let remindersLoaded = false;

  async function loadReminders() {
    if (!initData() || remindersLoaded) return;
    try {
      const { ok, data } = await api("fifa-remind");
      if (!ok) return;
      remindersLoaded = true;
      reminders.clear();
      (data.matches || []).forEach((id) => reminders.add(String(id)));
      paintBells();
    } catch (_) {}
  }

  function bellHtml(m) {
    if (m?.status !== "upcoming" || !canTrack(m)) return "";
    const kickoff = Date.parse(m.kickoff || "");
    if (Number.isFinite(kickoff) && kickoff <= Date.now()) return "";
    const on = reminders.has(String(m.id));
    return `<button type="button" class="ff-bell${on ? " is-on" : ""}" data-fifa-remind data-match-id="${esc(m.id)}" data-league-id="${esc(m.leagueId)}" aria-pressed="${on}" aria-label="${on ? "Eslatmani o'chirish" : "Eslatib qo'y"}">${BELL_ICON}</button>`;
  }
  const BELL_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>`;

  function paintBells() {
    document.querySelectorAll("[data-fifa-remind]").forEach((btn) => {
      const on = reminders.has(String(btn.dataset.matchId));
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", on ? "Eslatmani o'chirish" : "Eslatib qo'y");
    });
  }

  async function toggleReminder(btn) {
    const matchId = String(btn.dataset.matchId || "");
    const leagueId = String(btn.dataset.leagueId || "");
    if (!initData()) return toast("Eslatma uchun ilovani Telegram orqali oching");
    if (btn.dataset.busy) return;
    btn.dataset.busy = "1";
    const turningOn = !reminders.has(matchId);
    // Darhol ko'rsatamiz, xato bo'lsa qaytaramiz.
    if (turningOn) reminders.add(matchId); else reminders.delete(matchId);
    paintBells();
    haptic();
    try {
      const { ok, data } = await api("fifa-remind", { method: turningOn ? "POST" : "DELETE", body: { matchId, leagueId } });
      if (!ok) throw new Error(data.error || "Xatolik");
      reminders.clear();
      (data.matches || []).forEach((id) => reminders.add(String(id)));
      if (turningOn) {
        notify("success");
        toast("🔔 Eslatma qo'yildi — o'yindan 15 daqiqa oldin botga xabar keladi");
      } else {
        toast("Eslatma o'chirildi");
      }
    } catch (err) {
      if (turningOn) reminders.delete(matchId); else reminders.add(matchId);
      toast(err.message || "Eslatmani saqlab bo'lmadi");
    } finally {
      delete btn.dataset.busy;
      paintBells();
    }
  }

  // =====================================================================
  // Prognoz o'yini
  // =====================================================================
  const predict = {
    panel: null,
    view: "matches",
    period: "week",
    mine: null, // { predictions, week, all, me }
    drafts: new Map(), // matchId -> {h, a}
    loadingMine: null,
    getUpcoming: null,
  };

  async function loadMine(force = false) {
    if (!initData()) return null;
    if (predict.mine && !force) return predict.mine;
    if (predict.loadingMine) return predict.loadingMine;
    predict.loadingMine = (async () => {
      try {
        const { ok, data } = await api("fifa-predict", { query: "&view=mine" });
        if (ok) predict.mine = data;
      } catch (_) {}
      predict.loadingMine = null;
      return predict.mine;
    })();
    return predict.loadingMine;
  }

  const myPrediction = (matchId) => (predict.mine?.predictions || []).find((p) => p.matchId === String(matchId)) || null;

  function heroHtml() {
    const w = predict.mine?.week;
    const all = predict.mine?.all;
    const stats = initData()
      ? `<div class="ff-hero__stats">
          <span><b>${w?.points ?? 0}</b> ball<small>shu hafta</small></span>
          <span><b>${w?.rank ? `${w.rank}-o'rin` : "—"}</b><small>reytingda</small></span>
          <span><b>${all?.points ?? 0}</b> ball<small>umumiy</small></span>
        </div>`
      : `<p class="ff-hero__note">Prognoz qilish uchun ilovani Telegram orqali oching.</p>`;
    return `
      <section class="ff-hero">
        <div class="ff-hero__top">
          <span class="ff-hero__icon" aria-hidden="true">🏆</span>
          <div>
            <h3>Prognoz o'yini</h3>
            <p>Hisobni toping: <b>aniq hisob — 3 ball</b>, to'g'ri natija — 1 ball. Har hafta yangi reyting!</p>
          </div>
        </div>
        ${stats}
      </section>`;
  }

  function segHtml() {
    const items = [["matches", "O'yinlar"], ["board", "Reyting"], ["mine", "Mening prognozlarim"]];
    return `<div class="ff-seg" role="tablist">${items.map(([id, label]) => `<button type="button" class="ff-seg__btn${predict.view === id ? " is-active" : ""}" data-ff-view="${id}" role="tab" aria-selected="${predict.view === id}">${label}</button>`).join("")}</div>`;
  }

  function distHtml(dist, m) {
    if (!dist || !dist.total) return "";
    const pct = (n) => Math.round((n / dist.total) * 100);
    return `
      <div class="ff-dist" aria-label="Muxlislar prognozi">
        <div class="ff-dist__bar">
          <i style="flex:${dist.home || 0.0001}" class="is-home"></i><i style="flex:${dist.draw || 0.0001}" class="is-draw"></i><i style="flex:${dist.away || 0.0001}" class="is-away"></i>
        </div>
        <div class="ff-dist__legend">
          <span>${esc(m.home)} ${pct(dist.home)}%</span><span>Durang ${pct(dist.draw)}%</span><span>${esc(m.away)} ${pct(dist.away)}%</span>
        </div>
        <small>${dist.total} muxlis prognoz qildi</small>
      </div>`;
  }

  function predictCardHtml(m) {
    const saved = myPrediction(m.id);
    const draft = predict.drafts.get(String(m.id)) || (saved ? { h: saved.h, a: saved.a } : { h: 0, a: 0 });
    const kickoff = Date.parse(m.kickoff);
    const changed = !saved || saved.h !== draft.h || saved.a !== draft.a;
    const stepper = (side, value) => `
      <div class="ff-step" data-side="${side}">
        <button type="button" data-ff-step="${side}" data-d="1" aria-label="Qo'shish">+</button>
        <output>${value}</output>
        <button type="button" data-ff-step="${side}" data-d="-1" aria-label="Kamaytirish"${value <= 0 ? " disabled" : ""}>−</button>
      </div>`;
    const action = !initData()
      ? `<span class="ff-card__hint">Telegram orqali oching</span>`
      : changed
        ? `<button type="button" class="ff-save" data-ff-save>${saved ? "Yangilash" : "Prognozni saqlash"}</button>`
        : `<span class="ff-saved">✓ Prognozingiz: <b>${saved.h} : ${saved.a}</b></span>`;
    return `
      <article class="ff-card" data-ff-match="${esc(m.id)}" data-league-id="${esc(m.leagueId)}">
        <header class="ff-card__head">
          <span class="ff-card__league">${esc(m.leagueName || "")}</span>
          <span class="ff-card__time">${esc(clock(kickoff))}</span>
          ${bellHtml(m)}
        </header>
        <div class="ff-card__body">
          <div class="ff-team">${logo(m.homeLogo, m.home)}<span>${esc(m.home)}</span></div>
          <div class="ff-score">${stepper("h", draft.h)}<span class="ff-score__sep">:</span>${stepper("a", draft.a)}</div>
          <div class="ff-team">${logo(m.awayLogo, m.away)}<span>${esc(m.away)}</span></div>
        </div>
        <footer class="ff-card__foot">${action}</footer>
        ${saved ? distHtml(saved.dist, m) : ""}
      </article>`;
  }

  async function matchesViewHtml() {
    const all = predict.getUpcoming ? await predict.getUpcoming() : [];
    const now = Date.now();
    const list = (all || [])
      .filter((m) => m.status === "upcoming" && canTrack(m) && Date.parse(m.kickoff) > now && Date.parse(m.kickoff) - now < 4 * 86400000)
      .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
      .slice(0, 40);
    if (!list.length) return emptyHtml("⚽", "Yaqin kunlarda o'yin yo'q", "Yangi o'yinlar jadvalga qo'shilishi bilan shu yerda chiqadi.");
    let html = "";
    let lastDay = "";
    for (const m of list) {
      const label = dayLabel(Date.parse(m.kickoff));
      if (label !== lastDay) {
        html += `<h4 class="ff-day">${esc(label)}</h4>`;
        lastDay = label;
      }
      html += predictCardHtml(m);
    }
    return html;
  }

  async function boardViewHtml() {
    const periods = [["week", "Shu hafta"], ["lastweek", "O'tgan hafta"], ["all", "Umumiy"]];
    const chips = `<div class="ff-chips">${periods.map(([id, label]) => `<button type="button" class="ff-chip${predict.period === id ? " is-active" : ""}" data-ff-period="${id}">${label}</button>`).join("")}</div>`;
    let rows = [];
    try {
      const { ok, data } = await api("fifa-predict", { query: `&view=leaderboard&period=${predict.period}` });
      if (ok) rows = data.rows || [];
    } catch (_) {}
    if (!rows.length) {
      return chips + emptyHtml("🏆", "Reyting hali bo'sh", "O'yinlar tugashi bilan to'plangan ballar shu yerda ko'rinadi. Birinchi bo'ling!");
    }
    const me = predict.mine?.me;
    const medal = (rank) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank);
    const list = rows.map((r) => `
      <li class="ff-row${r.id === me ? " is-me" : ""}">
        <span class="ff-row__rank">${medal(r.rank)}</span>
        <span class="ff-row__avatar">${esc(r.name.charAt(0).toUpperCase())}</span>
        <span class="ff-row__name">${esc(r.name)}${r.id === me ? " <small>(siz)</small>" : ""}<small>${r.played} prognoz · ${r.exact} aniq</small></span>
        <span class="ff-row__pts"><b>${r.points}</b> ball</span>
      </li>`).join("");
    const mine = predict.period === "all" ? predict.mine?.all : predict.period === "week" ? predict.mine?.week : null;
    const meOutside = mine?.rank && !rows.some((r) => r.id === me)
      ? `<div class="ff-row ff-row--me-outside"><span class="ff-row__rank">${mine.rank}</span><span class="ff-row__name">Sizning o'rningiz</span><span class="ff-row__pts"><b>${mine.points}</b> ball</span></div>`
      : "";
    return `${chips}<ol class="ff-board">${list}</ol>${meOutside}`;
  }

  function mineViewHtml() {
    if (!initData()) return emptyHtml("🔒", "Telegram orqali oching", "Prognozlaringiz Telegram akkauntingizga bog'lanadi.");
    const list = predict.mine?.predictions || [];
    if (!list.length) return emptyHtml("🎯", "Hali prognoz yo'q", "\"O'yinlar\" bo'limida hisobni taxmin qiling — o'yin tugagach ball olasiz.");
    return list.map((p) => {
      let badge;
      if (p.status === "settled") badge = `<span class="ff-badge ff-badge--pts${p.pts ? "" : " is-zero"}">+${p.pts}</span>`;
      else if (p.status === "void") badge = `<span class="ff-badge">Bekor</span>`;
      else badge = `<span class="ff-badge ff-badge--wait">${p.kickoffMs > Date.now() ? clock(p.kickoffMs) : "Kutilmoqda"}</span>`;
      const result = p.final ? `<span>Natija: <b>${p.final.h} : ${p.final.a}</b></span>` : `<span>${esc(dayLabel(p.kickoffMs))}</span>`;
      return `
        <article class="ff-pick">
          <div class="ff-pick__teams">
            <span>${logo(p.homeLogo, p.home)}${esc(p.home)}</span>
            <span>${logo(p.awayLogo, p.away)}${esc(p.away)}</span>
          </div>
          <div class="ff-pick__meta">
            <span>Prognoz: <b>${p.h} : ${p.a}</b></span>
            ${result}
          </div>
          ${badge}
        </article>`;
    }).join("");
  }

  function emptyHtml(icon, title, text) {
    return `<div class="ff-empty"><span>${icon}</span><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
  }

  async function renderPredictPanel(panel, { getUpcoming } = {}) {
    if (!panel) return;
    predict.panel = panel;
    if (getUpcoming) predict.getUpcoming = getUpcoming;
    if (!panel.dataset.ffBound) bindPredictPanel(panel);
    if (!panel.querySelector(".ff-wrap")) panel.innerHTML = `<div class="ff-wrap"><div class="ff-loading">Yuklanmoqda…</div></div>`;
    await loadMine();
    await paintPredict();
  }

  async function paintPredict() {
    const panel = predict.panel;
    if (!panel) return;
    const view = predict.view;
    const body = view === "matches" ? await matchesViewHtml() : view === "board" ? await boardViewHtml() : mineViewHtml();
    if (predict.view !== view) return; // foydalanuvchi boshqa bo'limga o'tib ulgurdi
    panel.innerHTML = `<div class="ff-wrap">${heroHtml()}${segHtml()}<div class="ff-body">${body}</div></div>`;
  }

  function bindPredictPanel(panel) {
    panel.dataset.ffBound = "1";
    panel.addEventListener("click", async (e) => {
      const viewBtn = e.target.closest("[data-ff-view]");
      if (viewBtn) {
        predict.view = viewBtn.dataset.ffView;
        haptic();
        panel.querySelectorAll("[data-ff-view]").forEach((b) => b.classList.toggle("is-active", b === viewBtn));
        const bodyEl = panel.querySelector(".ff-body");
        if (bodyEl) bodyEl.innerHTML = `<div class="ff-loading">Yuklanmoqda…</div>`;
        if (predict.view === "mine") await loadMine(true);
        return paintPredict();
      }
      const periodBtn = e.target.closest("[data-ff-period]");
      if (periodBtn) {
        predict.period = periodBtn.dataset.ffPeriod;
        haptic();
        return paintPredict();
      }
      // Qo'ng'iroqcha tugmasini fifa.js'ning umumiy click handleri boshqaradi.
      if (e.target.closest("[data-fifa-remind]")) return;
      const card = e.target.closest("[data-ff-match]");
      if (!card) return;
      const matchId = card.dataset.ffMatch;
      const step = e.target.closest("[data-ff-step]");
      if (step) {
        const saved = myPrediction(matchId);
        const draft = { ...(predict.drafts.get(matchId) || (saved ? { h: saved.h, a: saved.a } : { h: 0, a: 0 })) };
        const side = step.dataset.ffStep;
        draft[side] = Math.max(0, Math.min(20, draft[side] + Number(step.dataset.d)));
        predict.drafts.set(matchId, draft);
        haptic("soft");
        repaintCard(card, matchId);
        return;
      }
      if (e.target.closest("[data-ff-save]")) {
        const saved = myPrediction(matchId);
        const draft = predict.drafts.get(matchId) || (saved ? { h: saved.h, a: saved.a } : { h: 0, a: 0 });
        const btn = e.target.closest("[data-ff-save]");
        btn.disabled = true;
        btn.textContent = "Saqlanmoqda…";
        try {
          const { ok, data } = await api("fifa-predict", { method: "POST", body: { leagueId: card.dataset.leagueId, matchId, home: draft.h, away: draft.a } });
          if (!ok) throw new Error(data.error || "Saqlab bo'lmadi");
          const list = (predict.mine?.predictions || []).filter((p) => p.matchId !== matchId);
          predict.mine = { ...(predict.mine || {}), predictions: [{ ...data.prediction, dist: data.dist }, ...list] };
          predict.drafts.delete(matchId);
          notify("success");
          toast(`✓ Prognoz saqlandi: ${draft.h} : ${draft.a}`);
        } catch (err) {
          notify("error");
          toast(err.message);
        }
        repaintCard(card, matchId);
      }
    });
  }

  async function repaintCard(card, matchId) {
    const all = predict.getUpcoming ? await predict.getUpcoming() : [];
    const m = (all || []).find((x) => String(x.id) === String(matchId));
    if (!m) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = predictCardHtml(m).trim();
    card.replaceWith(tmp.firstElementChild);
  }

  // =====================================================================
  // Jonli efir reaksiyalari
  // =====================================================================
  const POLL_MS = 4000;
  const FLUSH_MS = 1800;
  const reactions = {
    root: null,
    timer: null,
    shown: new Map(), // bucket -> {emoji: count}
    own: {}, // hali serverdan qaytmagan o'z bosishlarim
    queue: {},
    flushTimer: null,
    initialized: false,
    recentTotal: 0,
  };

  function mountReactions(root) {
    if (!root) return;
    reactions.root = root;
    root.innerHTML = `
      <div class="frx-layer" aria-hidden="true"></div>
      <div class="frx-bar" role="group" aria-label="Efirga reaksiya bildiring">
        ${REACTIONS.map((e) => `<button type="button" class="frx-btn" data-frx="${e}" aria-label="${e} reaksiya">${e}</button>`).join("")}
        <span class="frx-count" hidden></span>
      </div>`;
    if (!root.dataset.frxBound) {
      root.dataset.frxBound = "1";
      root.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-frx]");
        if (!btn) return;
        const emoji = btn.dataset.frx;
        floatEmoji(emoji, true);
        btn.classList.remove("is-pop");
        void btn.offsetWidth;
        btn.classList.add("is-pop");
        haptic("light");
        if (!initData()) return;
        reactions.queue[emoji] = (reactions.queue[emoji] || 0) + 1;
        reactions.own[emoji] = (reactions.own[emoji] || 0) + 1;
        if (!reactions.flushTimer) reactions.flushTimer = setTimeout(flushReactions, FLUSH_MS);
      });
    }
    syncReactions();
  }

  async function flushReactions() {
    reactions.flushTimer = null;
    const counts = reactions.queue;
    reactions.queue = {};
    if (!Object.keys(counts).length) return;
    try { await api("fifa-reactions", { method: "POST", body: { counts } }); } catch (_) {}
  }

  function floatEmoji(emoji, mine = false) {
    const layer = reactions.root?.querySelector(".frx-layer");
    if (!layer || layer.childElementCount > 45) return;
    const el = document.createElement("span");
    el.className = "frx-float" + (mine ? " is-mine" : "");
    el.textContent = emoji;
    el.style.setProperty("--x", `${Math.round(Math.random() * 70 + 10)}%`);
    el.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 60)}px`);
    el.style.setProperty("--dur", `${(2.4 + Math.random() * 1.2).toFixed(2)}s`);
    el.style.setProperty("--size", `${mine ? 30 : 22 + Math.round(Math.random() * 8)}px`);
    el.addEventListener("animationend", () => el.remove());
    layer.appendChild(el);
  }

  function isActive() {
    const root = reactions.root;
    const view = document.getElementById("fifaView");
    return Boolean(root && root.isConnected && view && !view.hidden && !document.hidden);
  }

  async function pollReactions() {
    if (!isActive()) return;
    try {
      const res = await fetch(`${API}fifa-reactions`, { headers: { Accept: "application/json" } });
      const data = await res.json();
      if (!data?.ok) return;
      let total = 0;
      const fresh = {};
      for (const { b, counts } of data.buckets || []) {
        const before = reactions.shown.get(b) || {};
        for (const [emoji, n] of Object.entries(counts || {})) {
          total += n;
          const delta = n - (before[emoji] || 0);
          if (delta > 0) fresh[emoji] = (fresh[emoji] || 0) + delta;
        }
        reactions.shown.set(b, { ...counts });
      }
      for (const b of reactions.shown.keys()) if (!(data.buckets || []).some((x) => x.b === b)) reactions.shown.delete(b);
      reactions.recentTotal = total;
      paintCount();
      if (!reactions.initialized) {
        reactions.initialized = true; // eski reaksiyalarni bir yo'la otib yubormaymiz
        return;
      }
      // Boshqalarning reaksiyalari keyingi 4 soniya davomida bir tekis uchib chiqadi.
      for (const [emoji, n] of Object.entries(fresh)) {
        const mine = Math.min(n, reactions.own[emoji] || 0);
        reactions.own[emoji] = (reactions.own[emoji] || 0) - mine;
        const others = Math.min(14, n - mine);
        for (let i = 0; i < others; i++) setTimeout(() => floatEmoji(emoji), Math.random() * POLL_MS);
      }
    } catch (_) {}
  }

  function paintCount() {
    const el = reactions.root?.querySelector(".frx-count");
    if (!el) return;
    el.hidden = reactions.recentTotal < 1;
    el.textContent = `${reactions.recentTotal} reaksiya`;
  }

  function syncReactions() {
    const active = isActive();
    if (active && !reactions.timer) {
      reactions.timer = setInterval(pollReactions, POLL_MS);
      pollReactions();
    } else if (!active && reactions.timer) {
      clearInterval(reactions.timer);
      reactions.timer = null;
      reactions.initialized = false;
      if (reactions.flushTimer) {
        clearTimeout(reactions.flushTimer);
        flushReactions();
      }
    }
  }
  document.addEventListener("visibilitychange", syncReactions);
  // Tanlangan tab yonga surilgan bo'lsa ko'rinadigan joyga olib kelamiz.
  document.addEventListener("click", (e) => {
    const tab = e.target.closest?.(".fifa-tab");
    if (tab) tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  });
  // Bo'lim ochilib-yopilganini kuzatamiz (fifa.js fifaView.hidden ni o'zgartiradi).
  const viewEl = document.getElementById("fifaView");
  if (viewEl && "MutationObserver" in window) {
    new MutationObserver(syncReactions).observe(viewEl, { attributes: true, attributeFilter: ["hidden"] });
  }

  window.FifaFun = {
    bellHtml,
    toggleReminder,
    loadReminders,
    renderPredictPanel,
    mountReactions,
    syncReactions,
    _version: ASSET_VERSION,
  };
})();

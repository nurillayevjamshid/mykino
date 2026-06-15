// FIFA JCH 2026 — view, banner, tablar, REAL data (openfootball + worldcup26.ir)
// app.js dan ajratildi (bosqich 4). Lazy-load: app.js ichidagi ensureFifaModule()
// foydalanuvchi FIFA tabini bosgach yuklaydi.

// FIFA JCH 2026 — view, banner, tablar, REAL data (openfootball + worldcup26.ir)
// ============================================================
(function initFifaModule() {
  const fifaView = document.getElementById("fifaView");
  const fifaBanner = document.getElementById("fifaHomeBanner");
  const appShell = document.getElementById("appShell");
  if (!fifaView) return;

  // Jamoa nomi (openfootball EN) → { uz, flag }
  // JCH 2026: 47 ta tasdiqlangan + play-off g'oliblari uchun placeholder mapping.
  const TEAM_MAP = {
    "Mexico":              { uz: "Meksika",         flag: "🇲🇽" },
    "South Africa":        { uz: "Janubiy Afrika",  flag: "🇿🇦" },
    "South Korea":         { uz: "Janubiy Koreya",  flag: "🇰🇷" },
    "Czech Republic":      { uz: "Chexiya",         flag: "🇨🇿" },
    "Canada":              { uz: "Kanada",          flag: "🇨🇦" },
    "Bosnia & Herzegovina":{ uz: "Bosniya",         flag: "🇧🇦" },
    "Qatar":               { uz: "Qatar",           flag: "🇶🇦" },
    "Switzerland":         { uz: "Shveytsariya",    flag: "🇨🇭" },
    "Brazil":              { uz: "Braziliya",       flag: "🇧🇷" },
    "Morocco":             { uz: "Marokash",        flag: "🇲🇦" },
    "Haiti":               { uz: "Gaiti",           flag: "🇭🇹" },
    "Scotland":            { uz: "Shotlandiya",     flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
    "USA":                 { uz: "AQSh",            flag: "🇺🇸" },
    "Paraguay":            { uz: "Paragvay",        flag: "🇵🇾" },
    "Australia":           { uz: "Avstraliya",      flag: "🇦🇺" },
    "Turkey":              { uz: "Turkiya",         flag: "🇹🇷" },
    "Germany":             { uz: "Germaniya",       flag: "🇩🇪" },
    "Curaçao":             { uz: "Kyurasao",        flag: "🇨🇼" },
    "Ivory Coast":         { uz: "Kot-d'Ivuar",     flag: "🇨🇮" },
    "Ecuador":             { uz: "Ekvador",         flag: "🇪🇨" },
    "Netherlands":         { uz: "Niderlandiya",    flag: "🇳🇱" },
    "Japan":               { uz: "Yaponiya",        flag: "🇯🇵" },
    "Sweden":              { uz: "Shvetsiya",       flag: "🇸🇪" },
    "Tunisia":             { uz: "Tunis",           flag: "🇹🇳" },
    "Argentina":           { uz: "Argentina",       flag: "🇦🇷" },
    "Algeria":             { uz: "Jazoir",          flag: "🇩🇿" },
    "Austria":             { uz: "Avstriya",        flag: "🇦🇹" },
    "Belgium":             { uz: "Belgiya",         flag: "🇧🇪" },
    "Cape Verde":          { uz: "Kabo-Verde",      flag: "🇨🇻" },
    "Colombia":            { uz: "Kolumbiya",       flag: "🇨🇴" },
    "Croatia":             { uz: "Xorvatiya",       flag: "🇭🇷" },
    "DR Congo":            { uz: "Kongo DR",        flag: "🇨🇩" },
    "Egypt":               { uz: "Misr",            flag: "🇪🇬" },
    "England":             { uz: "Angliya",         flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    "France":              { uz: "Fransiya",        flag: "🇫🇷" },
    "Ghana":               { uz: "Gana",            flag: "🇬🇭" },
    "Iran":                { uz: "Eron",            flag: "🇮🇷" },
    "Iraq":                { uz: "Iroq",            flag: "🇮🇶" },
    "Jordan":              { uz: "Iordaniya",       flag: "🇯🇴" },
    "New Zealand":         { uz: "Yangi Zelandiya", flag: "🇳🇿" },
    "Norway":              { uz: "Norvegiya",       flag: "🇳🇴" },
    "Panama":              { uz: "Panama",          flag: "🇵🇦" },
    "Portugal":            { uz: "Portugaliya",     flag: "🇵🇹" },
    "Saudi Arabia":        { uz: "Saudiya Arabistoni", flag: "🇸🇦" },
    "Senegal":             { uz: "Senegal",         flag: "🇸🇳" },
    "Spain":               { uz: "Ispaniya",        flag: "🇪🇸" },
    "Uruguay":             { uz: "Urugvay",         flag: "🇺🇾" },
    "Uzbekistan":          { uz: "O'zbekiston",     flag: "🇺🇿" },
  };
  const teamUz = (name) => (TEAM_MAP[name]?.uz) || name || "—";
  const teamFlag = (name) => (TEAM_MAP[name]?.flag) || "🏳️";

  // Windows/Telegram desktop emoji bayroqlarni rangli ko'rsatmaydi —
  // Twemoji (Twitter SVG, iOS uslubiga juda yaqin) ishlatamiz.
  // Emoji'dagi har codepoint hex'ga: "1f1fa-1f1ff.svg" formatida.
  function emojiToTwemojiName(emoji) {
    return Array.from(emoji)
      .map((ch) => ch.codePointAt(0).toString(16))
      .filter((cp) => cp !== "fe0f")
      .join("-");
  }
  function teamFlagHtml(name) {
    const flag = teamFlag(name);
    const fileName = emojiToTwemojiName(flag);
    const alt = (TEAM_MAP[name]?.uz) || name || "";
    const altSafe = String(alt).replace(/"/g, "&quot;");
    if (!fileName) return `<span class="fifa-flag fifa-flag--emoji">${flag}</span>`;
    const url = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${fileName}.svg`;
    return `<img class="fifa-flag fifa-flag--img" loading="lazy" decoding="async" src="${url}" alt="${altSafe}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fifa-flag fifa-flag--emoji',textContent:'${flag}'}))">`;
  }

  // O'zbek hafta kunlari va oylari
  const WD = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
  const MO = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

  // Match vaqtini Toshkent (UTC+5) ga o'tkazish
  // openfootball format: "13:00 UTC-6"
  function parseKickoff(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})$/i);
    if (!m) return null;
    const [, hh, mm, off] = m;
    // Local kickoff ISO with offset
    const offNum = Number(off);
    const sign = offNum >= 0 ? "+" : "-";
    const absOff = String(Math.abs(offNum)).padStart(2, "0");
    const iso = `${dateStr}T${hh.padStart(2, "0")}:${mm}:00${sign}${absOff}:00`;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  function fmtTashkentTime(d) {
    if (!d) return "";
    return new Intl.DateTimeFormat("uz-UZ", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  }
  function fmtTashkentDayKey(d) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }
  function fmtDayLabel(d) {
    // "11-iyun, payshanba"
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" }).formatToParts(d);
    const day = Number(parts.find((p) => p.type === "day").value);
    const month = Number(parts.find((p) => p.type === "month").value) - 1;
    const dt = new Date(`${fmtTashkentDayKey(d)}T00:00:00Z`);
    const wd = WD[dt.getUTCDay()];
    return `${day}-${MO[month]}, ${wd}`;
  }

  let FIFA_DATA = { matches: [], groups: [] };
  let loadState = "idle"; // idle | loading | ready | error

  function normalizeFromPayload(payload) {
    const schedule = payload?.schedule?.matches || [];
    const liveMap = payload?.liveMap || {};
    const standings = payload?.standings || [];

    // Match'larni Toshkent kuniga guruhlash
    const byDay = new Map();
    for (const m of schedule) {
      const kickoff = parseKickoff(m.date, m.time);
      if (!kickoff) continue;
      // 00:00 (Toshkent) da boshlanadigan o'yinlarni 23:55 (oldingi kun) sifatida ko'rsatamiz —
      // obunachi sanani chalkashtirmasligi uchun.
      const displayKickoff = fmtTashkentTime(kickoff) === "00:00"
        ? new Date(kickoff.getTime() - 5 * 60 * 1000)
        : kickoff;
      const dayKey = fmtTashkentDayKey(displayKickoff);
      const live = liveMap[`${m.team1}|${m.team2}`.toLowerCase()] || null;
      // Openfootball jadvali tugagan o'yinlar uchun score1/score2 ni saqlaydi —
      // bu live API tushib qolsa ham tarixiy hisobni ushlab turishga yordam beradi.
      const schedHome = m?.score?.ht?.[0] ?? m?.score1 ?? m?.home_score ?? null;
      const schedAway = m?.score?.ht?.[1] ?? m?.score2 ?? m?.away_score ?? null;
      const schedFt = m?.score?.ft || null;
      const hasSchedScore = Array.isArray(schedFt)
        ? (schedFt[0] != null && schedFt[1] != null)
        : (schedHome != null && schedAway != null);
      const liveStatus = String(live?.status || "").toLowerCase();
      let status;
      if (liveStatus === "live" || liveStatus === "inprogress" || liveStatus === "playing") status = "live";
      else if (liveStatus === "finished" || liveStatus === "ft" || liveStatus === "ended") status = "finished";
      else if (hasSchedScore) status = "finished";
      else status = "upcoming";

      let score = null;
      if (live && live.score_home != null && live.score_away != null) {
        score = `${live.score_home} : ${live.score_away}`;
      } else if (Array.isArray(schedFt) && schedFt[0] != null && schedFt[1] != null) {
        score = `${schedFt[0]} : ${schedFt[1]}`;
      } else if (schedHome != null && schedAway != null) {
        score = `${schedHome} : ${schedAway}`;
      }
      const item = {
        home: teamUz(m.team1),
        away: teamUz(m.team2),
        homeEn: m.team1,
        awayEn: m.team2,
        homeFlag: teamFlagHtml(m.team1),
        awayFlag: teamFlagHtml(m.team2),
        time: fmtTashkentTime(displayKickoff),
        kickoff: displayKickoff.toISOString(),
        group: m.group || "",
        ground: m.ground || "",
        status,
        score,
        minute: live?.minute ? String(live.minute) + (String(live.minute).includes("'") ? "" : "'") : null,
      };
      if (!byDay.has(dayKey)) byDay.set(dayKey, { date: displayKickoff, items: [] });
      byDay.get(dayKey).items.push(item);
    }

    const matches = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, val]) => ({
        day: fmtDayLabel(val.date),
        items: val.items.sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
      }));

    // Guruhlarni openfootball jadvalidan quramiz — kanonik A→L tartibi,
    // jamoa nomlari ham shu yerdan (worldcup26.ir teams endpointi to'liq emas).
    const groupTeams = new Map();
    for (const m of schedule) {
      const gname = String(m.group || "").trim();
      if (!/^Group\s+[A-L]$/i.test(gname)) continue;
      if (!groupTeams.has(gname)) groupTeams.set(gname, new Map());
      const gt = groupTeams.get(gname);
      for (const name of [m.team1, m.team2]) {
        if (name && !gt.has(name)) gt.set(name, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
      }
      const live = liveMap[`${m.team1}|${m.team2}`.toLowerCase()];
      const liveFinished = live && (live.status === "finished" || live.status === "ft" || live.status === "ended");
      // Live manba'dan tugagan natija; aks holda openfootball jadvalining
      // o'zidagi yakuniy hisob (score.ft / score1+score2) — manba tushib
      // qolsa ham jadval to'g'ri qoladi.
      const schedFt = Array.isArray(m?.score?.ft) ? m.score.ft : null;
      const schedH = m?.score1 ?? m?.home_score ?? null;
      const schedA = m?.score2 ?? m?.away_score ?? null;
      let h = null, a = null;
      if (liveFinished && live.score_home != null && live.score_away != null) {
        h = Number(live.score_home); a = Number(live.score_away);
      } else if (schedFt && schedFt[0] != null && schedFt[1] != null) {
        h = Number(schedFt[0]); a = Number(schedFt[1]);
      } else if (schedH != null && schedA != null) {
        h = Number(schedH); a = Number(schedA);
      }
      if (h != null && a != null && Number.isFinite(h) && Number.isFinite(a)) {
        const t1 = gt.get(m.team1), t2 = gt.get(m.team2);
        if (t1 && t2) {
          t1.p++; t2.p++;
          t1.gf += h; t1.ga += a; t2.gf += a; t2.ga += h;
          if (h > a) { t1.w++; t2.l++; t1.pts += 3; }
          else if (h < a) { t2.w++; t1.l++; t2.pts += 3; }
          else { t1.d++; t2.d++; t1.pts++; t2.pts++; }
        }
      }
    }

    const groups = [...groupTeams.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, gt]) => {
        const letter = name.replace(/^Group\s+/i, "");
        const rows = [...gt.entries()]
          .map(([team, s]) => ({ team: teamUz(team), flag: teamFlagHtml(team), ...s }))
          .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.team.localeCompare(b.team));
        return { name: `Guruh ${letter}`, rows };
      });

    return { matches, groups };
  }

  async function loadFifaData(force = false) {
    // force=true bo'lsa, ready holatda ham qayta yuklaymiz (live skorni
    // yangilash uchun). Lekin "loading" oqimini bir vaqtning o'zida
    // ikki marta boshlamaymiz.
    if (loadState === "loading") return;
    if (!force && loadState === "ready") return;
    const wasReady = loadState === "ready";
    loadState = "loading";
    try {
      const url = force ? `/api/categories?type=fifa&_=${Date.now()}` : "/api/categories?type=fifa";
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const payload = await res.json();
      FIFA_DATA = normalizeFromPayload(payload);
      loadState = "ready";
    } catch (err) {
      console.warn("FIFA fetch xato:", err.message);
      loadState = wasReady ? "ready" : "error";
    }
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // --- Empty/loading helpers ---
  function emptyHtml(title, sub) {
    return `<div class="fifa-live-empty">
              <div class="fifa-live-empty__icon">⚽</div>
              <div class="fifa-live-empty__title">${title}</div>
              <div>${sub || ""}</div>
            </div>`;
  }
  function loadingHtml(title, sub) {
    return `<div class="fifa-live-empty fifa-live-empty--loading">
              <div class="fifa-spinner" aria-hidden="true"></div>
              <div class="fifa-live-empty__title">${title}</div>
              <div>${sub || ""}</div>
            </div>`;
  }
  const isLoading = () => loadState === "loading" || loadState === "idle";

  // --- Render: Matchlar ---
  function renderMatches() {
    const panel = document.getElementById("fifaPanelMatches");
    if (!panel) return;
    if (isLoading()) { panel.innerHTML = loadingHtml("Matchlar jadvali yuklanmoqda…", "Iltimos, biroz kuting."); return; }
    if (!FIFA_DATA.matches.length) { panel.innerHTML = emptyHtml("Jadval topilmadi", "Manba vaqtincha javob bermayapti."); return; }
    panel.innerHTML = FIFA_DATA.matches.map((day) => `
      <div class="fifa-day">${esc(day.day)}</div>
      ${day.items.map((m) => {
        const isLive = m.status === "live";
        const isFinished = m.status === "finished" && m.score;
        let center;
        if (isLive) {
          center = `<div class="fifa-match__score">${esc(m.score || "-")}</div>
             <div class="fifa-match__status"><span class="fifa-match__status-dot"></span>${esc(m.minute || "LIVE")}</div>`;
        } else if (isFinished) {
          center = `<div class="fifa-match__score">${esc(m.score)}</div>
             <div class="fifa-match__time">Tugadi</div>`;
        } else {
          center = `<div class="fifa-match__score">vs</div>
             <div class="fifa-match__time">${esc(m.time)}</div>`;
        }
        const clickable = isFinished;
        const dateIso = m.kickoff ? String(m.kickoff).slice(0, 10) : "";
        const dataAttr = clickable
          ? ` data-fifa-open-lineup="1" data-home-en="${esc(m.homeEn)}" data-away-en="${esc(m.awayEn)}" data-home-uz="${esc(m.home)}" data-away-uz="${esc(m.away)}" data-score="${esc(m.score || "")}" data-date="${esc(dateIso)}" role="button" tabindex="0"`
          : "";
        return `
          <div class="fifa-match${isLive ? " fifa-match--live" : isFinished ? " fifa-match--finished" : ""}${clickable ? " fifa-match--clickable" : ""}"${dataAttr}>
            <div class="fifa-match__team fifa-match__team--home">
              <span class="fifa-match__name">${esc(m.home)}</span>
              <span class="fifa-match__flag">${m.homeFlag}</span>
            </div>
            <div class="fifa-match__center">${center}</div>
            <div class="fifa-match__team fifa-match__team--away">
              <span class="fifa-match__flag">${m.awayFlag}</span>
              <span class="fifa-match__name">${esc(m.away)}</span>
            </div>
          </div>
        `;
      }).join("")}
    `).join("");
  }

  // --- Render: Jonli efir ---
  function renderLive() {
    const panel = document.getElementById("fifaPanelLive");
    if (!panel) return;
    const live = FIFA_DATA.matches.flatMap((d) => d.items).filter((m) => m.status === "live");
    const upcoming = FIFA_DATA.matches.flatMap((d) => d.items).filter((m) => m.status === "upcoming").slice(0, 3);
    const liveHtml = live.length
      ? live.map((m) => `
          <div class="fifa-live-card">
            <span class="fifa-live-card__label"><span class="fifa-banner__live-dot"></span>HOZIR LIVE</span>
            <div class="fifa-live-card__teams">${m.homeFlag} ${esc(m.home)} ${esc(m.score || "-")} ${esc(m.away)} ${m.awayFlag}</div>
            <div class="fifa-live-card__meta">${esc(m.minute || "")} · ${esc(m.time)}</div>
            <button class="fifa-live-card__cta" type="button" data-fifa-watch>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="m8 5 12 7-12 7z"></path></svg>
              Tomosha qilish
            </button>
          </div>
        `).join("")
      : `<div class="fifa-live-empty">
           <div class="fifa-live-empty__icon">📺</div>
           <div class="fifa-live-empty__title">Hozir jonli efir yo'q</div>
           <div>Yaqin matchlar pastda ko'rsatilgan.</div>
         </div>`;
    const upcomingHtml = upcoming.length
      ? `<div class="fifa-upcoming-title">Yaqin matchlar</div>` +
        upcoming.map((m) => `
          <div class="fifa-match">
            <div class="fifa-match__team fifa-match__team--home">
              <span class="fifa-match__name">${esc(m.home)}</span>
              <span class="fifa-match__flag">${m.homeFlag}</span>
            </div>
            <div class="fifa-match__center">
              <div class="fifa-match__score">vs</div>
              <div class="fifa-match__time">${esc(m.time)}</div>
            </div>
            <div class="fifa-match__team fifa-match__team--away">
              <span class="fifa-match__flag">${m.awayFlag}</span>
              <span class="fifa-match__name">${esc(m.away)}</span>
            </div>
          </div>
        `).join("")
      : "";
    panel.innerHTML = liveHtml + upcomingHtml;
    panel.querySelectorAll("[data-fifa-watch]").forEach((b) => {
      b.addEventListener("click", () => {
        try { window.Telegram?.WebApp?.showAlert?.("Jonli efir tez orada ulanadi"); }
        catch (_) { alert("Jonli efir tez orada ulanadi"); }
      });
    });
  }

  // --- Render: Guruhlar ---
  function renderGroups() {
    const panel = document.getElementById("fifaPanelGroups");
    if (!panel) return;
    if (isLoading()) { panel.innerHTML = loadingHtml("Guruhlar yuklanmoqda…", "Iltimos, biroz kuting."); return; }
    if (!FIFA_DATA.groups.length) { panel.innerHTML = emptyHtml("Hali jadval yo'q", "Birinchi turlar tugagandan keyin ko'rinadi."); return; }
    panel.innerHTML = FIFA_DATA.groups.map((g) => `
      <div class="fifa-group">
        <div class="fifa-group__head"><span>${esc(g.name)}</span></div>
        <table class="fifa-group__table">
          <thead>
            <tr>
              <th style="text-align:left">Jamoa</th>
              <th>O</th><th>G</th><th>D</th><th>M</th><th>+/-</th><th>O</th>
            </tr>
          </thead>
          <tbody>
            ${g.rows.map((r) => `
              <tr>
                <td class="fifa-cell--team">${r.flag} ${esc(r.team)}</td>
                <td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>
                <td>${r.gf}:${r.ga}</td>
                <td class="fifa-cell--pts">${r.pts}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `).join("");
  }

  // --- Tab switching ---
  function setActiveTab(tab) {
    fifaView.querySelectorAll(".fifa-tab").forEach((b) => {
      const isOn = b.dataset.fifaTab === tab;
      b.classList.toggle("is-active", isOn);
      b.setAttribute("aria-selected", isOn ? "true" : "false");
    });
    fifaView.querySelectorAll(".fifa-panel").forEach((p) => {
      const isOn = p.id === "fifaPanel" + tab.charAt(0).toUpperCase() + tab.slice(1);
      p.classList.toggle("is-active", isOn);
      p.hidden = !isOn;
    });
  }

  fifaView.querySelectorAll(".fifa-tab").forEach((b) => {
    b.addEventListener("click", () => setActiveTab(b.dataset.fifaTab));
  });

  // --- Jonli efir promo kartasi (Telegram jonli efir / translatsiya havolasi) ---
  function renderFifaLivePromo() {
    const promo = fifaView.querySelector(".fifa-view__promo");
    if (!promo) return;
    const cfg = (typeof fifaLiveConfig !== "undefined" && fifaLiveConfig) || null;
    if (!cfg || !cfg.channelUrl) {
      // Config yo'q — bo'sh placeholder holatiga qaytamiz
      promo.hidden = true;
      promo.classList.remove("fifa-view__promo--live");
      promo.innerHTML = "";
      promo.removeAttribute("role");
      promo.removeAttribute("tabindex");
      return;
    }
    const title = esc(cfg.title || "Jonli efir");
    const subtitle = esc(cfg.subtitle || "JCH 2026 o'yinlarini jonli tomosha qiling");
    const buttonText = esc(cfg.buttonText || "Kanalga kirish");
    const bg = cfg.imageUrl
      ? `style="background-image:linear-gradient(180deg,rgba(8,12,22,.25),rgba(8,12,22,.85)),url('${esc(cfg.imageUrl)}')"`
      : "";
    promo.hidden = false;
    promo.classList.add("fifa-view__promo--live");
    promo.setAttribute("role", "button");
    promo.setAttribute("tabindex", "0");
    promo.removeAttribute("aria-hidden");
    promo.innerHTML = `
      <div class="fifa-view__promo-bg" ${bg} aria-hidden="true"></div>
      <div class="fifa-view__promo-inner">
        <span class="fifa-view__promo-badge"><span class="fifa-view__promo-dot"></span>LIVE</span>
        <div class="fifa-view__promo-title">${title}</div>
        <div class="fifa-view__promo-sub">${subtitle}</div>
        <span class="fifa-view__promo-cta">
          ${buttonText}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
        </span>
      </div>`;
    const open = () => openFifaLiveChannel(cfg.channelUrl);
    promo.onclick = open;
    promo.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    };
  }

  function openFifaLiveChannel(url) {
    const target = String(url || "").trim();
    if (!target) return;
    // Cloudflare WHEP (WebRTC) playback URL — past kechikishli WebRTC pleyer
    if (/\/webRTC\/play(\?|$)/i.test(target)) {
      openLivePlayerModal(target, "whep");
      return;
    }
    // HLS oqim (.m3u8) — hls.js / native HLS pleyer
    if (/\.m3u8(\?|$)/i.test(target)) {
      openLivePlayerModal(target, "hls");
      return;
    }
    try {
      const tg = window.Telegram?.WebApp;
      if (/^(https?:\/\/(t|telegram)\.me\/|tg:\/\/)/i.test(target) && tg?.openTelegramLink) {
        tg.openTelegramLink(target);
        return;
      }
      if (tg?.openLink) { tg.openLink(target); return; }
      window.open(target, "_blank", "noopener");
    } catch (_) {
      window.open(target, "_blank", "noopener");
    }
  }

  // --- HLS pleyer modali (jonli efirni app ichida ko'rsatish) ---
  let hlsLibLoading = null;
  function loadHlsLib() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsLibLoading) return hlsLibLoading;
    hlsLibLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
      s.async = true;
      s.onload = () => resolve(window.Hls);
      s.onerror = () => reject(new Error("hls.js yuklanmadi"));
      document.head.appendChild(s);
    });
    return hlsLibLoading;
  }

  let activeHlsInstance = null;
  let activeWhepPc = null;
  let activeStream = null;
  let controlsAutoHideTimer = null;

  function scheduleControlsAutoHide(modal, delay = 4500) {
    if (controlsAutoHideTimer) { clearTimeout(controlsAutoHideTimer); controlsAutoHideTimer = null; }
    const video = modal?.querySelector("#fifaHlsVideo");
    if (!video || video.paused) return; // pauzada tugmalarni doim ko'rsatamiz
    controlsAutoHideTimer = setTimeout(() => {
      controlsAutoHideTimer = null;
      const v = modal.querySelector("#fifaHlsVideo");
      if (v && !v.paused) modal.classList.add("controls-hidden");
    }, delay);
  }
  function cancelControlsAutoHide() {
    if (controlsAutoHideTimer) { clearTimeout(controlsAutoHideTimer); controlsAutoHideTimer = null; }
  }

  function injectPlayerStylesOnce() {
    if (document.getElementById("fifaPlayerStyles")) return;
    const css = `
      #fifaHlsModal { position:fixed; inset:0; z-index:9999; background:#000; display:flex; align-items:center; justify-content:center; overflow:hidden; }
      #fifaHlsModal[hidden] { display:none !important; }
      #fifaHlsModal #fifaHlsVideo { width:100%; height:100%; object-fit:contain; background:#000; display:block; }
      #fifaHlsModal .fifa-player__top { position:absolute; top:0; left:0; right:0; display:flex; align-items:center; justify-content:space-between; padding:14px 16px calc(14px + env(safe-area-inset-top, 0px)); padding-top:calc(14px + env(safe-area-inset-top, 0px)); background:linear-gradient(180deg, rgba(0,0,0,.65), rgba(0,0,0,0)); transition:opacity .2s; }
      #fifaHlsModal .fifa-player__bottom { position:absolute; bottom:0; left:0; right:0; display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:14px 16px calc(14px + env(safe-area-inset-bottom, 0px)); background:linear-gradient(0deg, rgba(0,0,0,.6), rgba(0,0,0,0)); transition:opacity .2s; }
      #fifaHlsModal.controls-hidden .fifa-player__top,
      #fifaHlsModal.controls-hidden .fifa-player__bottom { opacity:0; pointer-events:none; }
      #fifaHlsModal .fifa-player__icon-btn { width:42px; height:42px; border-radius:50%; border:0; background:rgba(20,20,22,.6); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; touch-action:manipulation; }
      #fifaHlsModal .fifa-player__center-btn { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:78px; height:78px; border-radius:50%; border:0; background:rgba(20,20,22,.72); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; z-index:5; touch-action:manipulation; box-shadow:0 6px 22px rgba(0,0,0,.4); }
      #fifaHlsModal .fifa-player__center-btn[hidden] { display:none; }
      #fifaHlsModal .fifa-player__center-btn:active { transform:translate(-50%,-50%) scale(.94); }
      #fifaHlsModal .fifa-player__icon-btn:active { transform:scale(.94); }
      #fifaHlsModal .fifa-player__badge { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:14px; background:#e53935; color:#fff; font-size:12px; font-weight:700; letter-spacing:.5px; }
      #fifaHlsModal .fifa-player__dot { width:8px; height:8px; border-radius:50%; background:#fff; animation:fifaPlayerPulse 1.4s infinite; }
      @keyframes fifaPlayerPulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
      #fifaHlsModal .fifa-player__status { position:absolute; bottom:calc(72px + env(safe-area-inset-bottom, 0px)); left:50%; transform:translateX(-50%); color:#fff; font-size:14px; background:rgba(0,0,0,.65); padding:8px 14px; border-radius:18px; display:none; max-width:90%; text-align:center; }
      #fifaPlayerOverlay { font-family:inherit; }
      body.fifa-hls-open { overflow:hidden; }
    `;
    const style = document.createElement("style");
    style.id = "fifaPlayerStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function setCenterPlayState(modal, isPlaying) {
    const btn = modal.querySelector("#fifaHlsPlayPause");
    if (!btn) return;
    if (isPlaying) {
      btn.hidden = true;
    } else {
      btn.hidden = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="m8 5 12 7-12 7z"/></svg>`;
    }
  }

  function togglePlayPause(modal) {
    const video = modal.querySelector("#fifaHlsVideo");
    const audio = modal.querySelector("#fifaHlsAudio");
    if (!video) return;
    if (video.paused) {
      // Stream uzilgan bo'lsa srcObject'ni qaytadan biriktiramiz
      if (!video.srcObject && activeStream) {
        try { video.srcObject = activeStream; } catch (_) {}
      }
      video.play().catch((err) => console.warn("[play] video", err.message));
      if (audio && audio.srcObject) {
        audio.muted = false;
        audio.volume = 1.0;
        audio.play().catch((err) => console.warn("[play] audio", err.message));
        updateMuteIcon(modal, false);
      }
      setCenterPlayState(modal, true);
    } else {
      video.pause();
      if (audio) { try { audio.pause(); } catch (_) {} }
      setCenterPlayState(modal, false);
    }
  }

  function attachPlayPauseSync(modal) {
    const video = modal.querySelector("#fifaHlsVideo");
    if (!video || video.dataset.ppSyncBound === "1") return;
    video.dataset.ppSyncBound = "1";
    video.addEventListener("play", () => { setCenterPlayState(modal, true); scheduleControlsAutoHide(modal); });
    video.addEventListener("playing", () => { setCenterPlayState(modal, true); scheduleControlsAutoHide(modal); });
    video.addEventListener("pause", () => {
      // Audio'ni ham pauza qilamiz, agar video pauza bo'lgan bo'lsa
      const audio = modal.querySelector("#fifaHlsAudio");
      if (audio && !audio.paused) { try { audio.pause(); } catch (_) {} }
      setCenterPlayState(modal, false);
      cancelControlsAutoHide();
      modal.classList.remove("controls-hidden");
    });
    video.addEventListener("ended", () => { setCenterPlayState(modal, false); cancelControlsAutoHide(); modal.classList.remove("controls-hidden"); });
  }

  function updateMuteIcon(modal, muted) {
    const btn = modal.querySelector("#fifaHlsMute");
    if (!btn) return;
    btn.innerHTML = muted
      ? `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.42.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.17v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>`
      : `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
  }

  function toggleFullscreen(modal) {
    const doc = document;
    const tg = window.Telegram?.WebApp;
    const video = modal.querySelector("#fifaHlsVideo");
    const inStdFs = doc.fullscreenElement || doc.webkitFullscreenElement;
    const inTgFs = !!tg?.isFullscreen;
    const inIosFs = !!video?.webkitDisplayingFullscreen;

    // CHIQISH
    if (inIosFs && typeof video.webkitExitFullscreen === "function") {
      try { video.webkitExitFullscreen(); } catch (_) {}
      return;
    }
    if (inStdFs) {
      try { (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc); } catch (_) {}
      return;
    }
    if (inTgFs && typeof tg?.exitFullscreen === "function") {
      try { tg.exitFullscreen(); } catch (_) {}
      try { tg.BackButton?.show?.(); } catch (_) {}
      return;
    }

    // KIRISH — qurilmaga qarab eng tabiiy fullscreen yo'lini tanlaymiz.
    // 1) iOS Safari / iOS Telegram WebView: video.webkitEnterFullscreen() —
    //    Telegram chat'dagi videodek toza native player, hech qanday TG chrome
    //    yo'q. Chiqishda attachFullscreenRecovery srcObject'ni qayta biriktiradi.
    if (video && typeof video.webkitEnterFullscreen === "function") {
      try { video.webkitEnterFullscreen(); return; } catch (err) {
        console.warn("[fs] webkitEnterFullscreen threw", err?.message);
      }
    }
    // 2) Telegram WebView (Android va boshqalar) — Bot API 8.0+ requestFullscreen.
    //    Kino pleyer bilan bir xil pattern: standart Element.requestFullscreen'ni
    //    URINMAYMIZ chunki u Telegram WebView'da silently reject bo'lib, ayni
    //    paytda user gesture'ni iste'mol qilib qo'yadi — keyin tg.requestFullscreen
    //    ham ishlamay qoladi. Va BackButton'ni yashiramiz, aks holda Telegram
    //    yuqorida sahifa header'ini saqlaydi.
    if (tg && typeof tg.requestFullscreen === "function") {
      try {
        tg.requestFullscreen();
        try { tg.BackButton?.hide?.(); } catch (_) {}
        return;
      } catch (err) {
        console.warn("[fs] tg.requestFullscreen threw", err?.message);
      }
    }
    // 3) Standalone brauzer (Telegram tashqarisida) — standart Fullscreen API
    const req = modal.requestFullscreen || modal.webkitRequestFullscreen;
    if (req) {
      try {
        const p = req.call(modal);
        if (p && typeof p.then === "function") {
          p.catch((err) => console.warn("[fs] std reject", err?.message));
        }
      } catch (err) {
        console.warn("[fs] std threw", err?.message);
      }
    }
  }

  // iOS native fullscreen'dan chiqqach video element ba'zan toza qora qotib
  // qoladi — MediaStream uziladi yoki rendering pipeline buziladi. Qaytadan
  // play() chaqirib va srcObject'ni yangidan biriktirib kadrlarni tiklaymiz.
  function attachFullscreenRecovery(modal) {
    const video = modal.querySelector("#fifaHlsVideo");
    if (!video || video.dataset.fsRecoveryBound === "1") return;
    video.dataset.fsRecoveryBound = "1";
    const recover = () => {
      const inFs = document.fullscreenElement || document.webkitFullscreenElement || video.webkitDisplayingFullscreen;
      if (inFs) return;
      // Fullscreen yopildi — kadrlarni qaytaramiz. iOS srcObject'ni
      // tozalashi mumkin, shuning uchun saqlangan activeStream'dan tiklaymiz.
      // Kichik kechikish: iOS chiqish animatsiyasi tugab DOM barqarorlashsin.
      // Avtomatik play() qilmaymiz — markazdagi tugma chiqadi va foydalanuvchi
      // bosib davom etadi (audio'ni ham vaqtincha pauza qilamiz).
      setTimeout(() => {
        const stream = video.srcObject || activeStream;
        if (stream) {
          try {
            video.srcObject = null;
            video.srcObject = stream;
          } catch (_) {}
        }
        try { video.pause(); } catch (_) {}
        const audio = document.getElementById("fifaHlsAudio");
        if (audio) { try { audio.pause(); } catch (_) {} }
        const modal = document.getElementById("fifaHlsModal");
        if (modal) {
          setCenterPlayState(modal, false);
          // Fullscreen'dan qaytganda panellar yashirilib qolmasligi uchun
          cancelControlsAutoHide();
          modal.classList.remove("controls-hidden");
        }
      }, 150);
    };
    document.addEventListener("fullscreenchange", recover);
    document.addEventListener("webkitfullscreenchange", recover);
    video.addEventListener("webkitendfullscreen", recover);
  }

  function removePlayerOverlay() {
    document.getElementById("fifaPlayerOverlay")?.remove();
  }
  function showUnmuteHint(video) {
    removePlayerOverlay();
    const modal = document.getElementById("fifaHlsModal");
    if (!modal) return;
    const btn = document.createElement("button");
    btn.id = "fifaPlayerOverlay";
    btn.type = "button";
    btn.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:20;padding:14px 22px;border-radius:32px;border:0;background:rgba(229,57,53,.96);color:#fff;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:10px;box-shadow:0 8px 28px rgba(0,0,0,.5);animation:fifaPlayerPulse 1.6s infinite;";
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>Ovozni yoqish`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      enableLiveAudio(modal, video);
      removePlayerOverlay();
    }, { once: true });
    modal.appendChild(btn);
  }

  // iOS WebKit'da WebRTC audio'ni "unlock" qilish uchun AudioContext kerak —
  // gesture ichida bir marta resume qilinsa, keyingi audio play()'lar ishlaydi
  let audioUnlockCtx = null;
  function unlockAudioContext() {
    try {
      if (!audioUnlockCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioUnlockCtx = new Ctx();
      }
      if (audioUnlockCtx && audioUnlockCtx.state === "suspended") {
        audioUnlockCtx.resume().catch(() => {});
      }
      // Bo'sh buffer chaling — iOS'da audio output rejimini ochadi
      if (audioUnlockCtx) {
        const buf = audioUnlockCtx.createBuffer(1, 1, 22050);
        const src = audioUnlockCtx.createBufferSource();
        src.buffer = buf;
        src.connect(audioUnlockCtx.destination);
        src.start(0);
      }
    } catch (err) {
      console.warn("[audio] unlock ctx", err.message);
    }
  }

  // Ovozni gesture ichida yoqish — alohida <audio> element orqali (iOS uchun)
  function enableLiveAudio(modal, video) {
    unlockAudioContext();
    const a = modal?.querySelector("#fifaHlsAudio");
    let done = false;
    if (a && a.srcObject) {
      a.muted = false;
      a.volume = 1.0;
      a.play().then(() => {
        console.log("[audio] separate element playing");
        done = true;
      }).catch((err) => {
        console.warn("[audio] separate element failed, falling back", err.message);
      });
    }
    // Parallel ravishda video.muted=false ham qilamiz — iOS re-attach trick
    // bilan: srcObject'ni qaytadan biriktirish ba'zan audio pipeline'ni jonlatadi
    try {
      video.muted = false;
      video.volume = 1.0;
      const s = video.srcObject;
      if (s) {
        video.srcObject = null;
        video.srcObject = s;
      }
      video.play().catch(() => {});
    } catch (_) {}
    updateMuteIcon(modal, false);
    // Diagnostika — qaysi yo'l ishlayotganini bilish uchun
    setTimeout(() => {
      console.log("[audio] state video.muted=", video.muted, "audio.paused=", a?.paused, "audio.muted=", a?.muted, "ctx=", audioUnlockCtx?.state);
    }, 500);
  }
  function showTapToPlayHint(video) {
    removePlayerOverlay();
    const modal = document.getElementById("fifaHlsModal");
    if (!modal) return;
    const btn = document.createElement("button");
    btn.id = "fifaPlayerOverlay";
    btn.type = "button";
    btn.style.cssText = "position:absolute;inset:0;z-index:20;background:rgba(0,0,0,.4);border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;";
    btn.innerHTML = `<span style="width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.95);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="36" height="36" fill="#111"><path d="m8 5 12 7-12 7z"/></svg></span>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      video.play().catch(() => {});
      enableLiveAudio(modal, video);
      removePlayerOverlay();
    }, { once: true });
    modal.appendChild(btn);
  }

  async function playWhep(url, video, setStatus) {
    let stage = "init";
    try {
      console.log("[whep] starting", url);
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
        bundlePolicy: "max-bundle",
      });
      activeWhepPc = pc;

      stage = "addTransceiver";
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      let playStarted = false;
      const startPlayback = async (stream) => {
        if (playStarted) return;
        playStarted = true;
        const modal = document.getElementById("fifaHlsModal");
        try {
          // Audio track allaqachon ontrack handler'da alohida <audio>'ga ulangan.
          // Bu yerda faqat video pipeline'ini ishga tushiramiz.
          activeStream = stream;
          video.srcObject = stream;
          // Audio elementni darhol play() qilishga urinish — ko'p hollarda
          // user gesture konteksti hali tirik bo'ladi va ovoz darhol kelaveradi
          const audioEl = modal?.querySelector("#fifaHlsAudio");
          if (audioEl && audioEl.srcObject) {
            audioEl.muted = false;
            audioEl.volume = 1.0;
            audioEl.play().then(() => {
              console.log("[audio] auto-play succeeded — no unmute prompt needed");
              if (modal) updateMuteIcon(modal, false);
            }).catch((err) => {
              console.log("[audio] auto-play blocked, showing unmute prompt:", err.message);
            });
          }
        } catch (err) {
          console.warn("[whep] srcObject assign failed", err.message);
          setStatus(`Video xatosi: ${err.message}`);
          playStarted = false;
          return;
        }
        // Mobil/embed WebView'larda autoplay faqat MUTED bo'lganda kafolatlanadi.
        // Video doim muted qoladi (audio alohida elementdan keladi).
        video.muted = true;
        if (modal) updateMuteIcon(modal, true);
        try {
          await video.play();
          setStatus("");
          // Audio holatini tekshirib qaror qilamiz:
          // - Audio ham o'ynayotgan bo'lsa (iOS): hech narsa ko'rsatmaymiz
          // - Audio o'ynamayotgan bo'lsa (Android/PC): video'ni ham pauza
          //   qilamiz va markazda katta play tugmasi chiqaramiz — foydalanuvchi
          //   bir tap bilan ikkalasini birga ishga tushiradi.
          const audioEl = modal?.querySelector("#fifaHlsAudio");
          await new Promise((r) => setTimeout(r, 200));
          if (audioEl && !audioEl.paused && !audioEl.muted) {
            console.log("[audio] already playing — fully started");
            if (modal) updateMuteIcon(modal, false);
            if (modal) setCenterPlayState(modal, true);
          } else {
            console.log("[audio] not playing — pausing video, awaiting tap");
            try { video.pause(); } catch (_) {}
            if (modal) setCenterPlayState(modal, false);
          }
        } catch (err) {
          console.warn("[whep] muted play blocked", err.message);
          setStatus("");
          if (modal) setCenterPlayState(modal, false);
        }
      };
      pc.ontrack = (e) => {
        console.log("[whep] ontrack", e.track.kind, e.streams?.length, "dim=", e.track.getSettings?.());
        const stream = e.streams && e.streams[0];
        // Audio track alohida elementga — gesture ichida play() qilinadi
        if (e.track.kind === "audio") {
          const modal = document.getElementById("fifaHlsModal");
          const audioEl = modal?.querySelector("#fifaHlsAudio");
          if (audioEl) {
            try {
              e.track.enabled = true;
              audioEl.srcObject = new MediaStream([e.track]);
              console.log("[whep] audio track attached to <audio>");
            } catch (err) {
              console.warn("[whep] audio attach failed", err.message);
            }
          }
        }
        if (stream) startPlayback(stream);
      };
      pc.oniceconnectionstatechange = () => {
        console.log("[whep] iceConnectionState=", pc.iceConnectionState);
        if (pc.iceConnectionState === "failed") setStatus("Ulanish uzildi");
      };
      pc.onconnectionstatechange = () => {
        console.log("[whep] connectionState=", pc.connectionState);
      };

      stage = "createOffer";
      const offer = await pc.createOffer();
      stage = "setLocalDescription";
      await pc.setLocalDescription(offer);

      stage = "iceGathering";
      await new Promise((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const onChange = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", onChange);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", onChange);
        setTimeout(resolve, 3000);
      });

      stage = "fetch";
      console.log("[whep] POSTing SDP, length=", pc.localDescription?.sdp?.length);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription.sdp,
      });
      console.log("[whep] response", res.status, res.headers.get("content-type"));
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`);
      }
      const answerSdp = await res.text();
      console.log("[whep] answer SDP length=", answerSdp.length);

      stage = "setRemoteDescription";
      if (pc.signalingState === "closed") {
        throw new Error("PeerConnection yopilgan");
      }
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      console.log("[whep] setRemoteDescription OK, signalingState=", pc.signalingState);
    } catch (err) {
      console.warn(`[whep error @ ${stage}]`, err);
      throw new Error(`${stage}: ${err.message || err.name || "noma'lum xato"}`);
    }
  }

  function openLivePlayerModal(src, mode) {
    let modal = document.getElementById("fifaHlsModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "fifaHlsModal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.innerHTML = `
        <video id="fifaHlsVideo" playsinline autoplay webkit-playsinline x5-playsinline muted></video>
        <audio id="fifaHlsAudio" playsinline autoplay style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px"></audio>
        <button type="button" id="fifaHlsPlayPause" class="fifa-player__center-btn" aria-label="O'ynatish/Pauza" hidden>
          <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="m8 5 12 7-12 7z"/></svg>
        </button>
        <div class="fifa-player__top">
          <span class="fifa-player__badge"><span class="fifa-player__dot"></span>JONLI</span>
          <button type="button" id="fifaHlsClose" class="fifa-player__icon-btn" aria-label="Yopish">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="fifa-player__bottom">
          <button type="button" id="fifaHlsMute" class="fifa-player__icon-btn" aria-label="Ovoz">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>
          </button>
          <button type="button" id="fifaHlsFs" class="fifa-player__icon-btn" aria-label="To'liq ekran">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
          </button>
        </div>
        <div id="fifaHlsStatus" class="fifa-player__status"></div>
      `;
      document.body.appendChild(modal);
      injectPlayerStylesOnce();
      // Event delegation — agar DOM ichidagi tugmalar qaytadan yaratilsa ham
      // bog'lanish saqlanadi (iOS WebView fullscreen'dan keyin tugma listenerlari
      // ba'zan tushib qoladi)
      const handleTap = (e) => {
        const closeBtn = e.target.closest && e.target.closest("#fifaHlsClose");
        if (closeBtn) {
          e.preventDefault();
          e.stopPropagation();
          closeHlsPlayerModal();
          return;
        }
        const muteBtn = e.target.closest && e.target.closest("#fifaHlsMute");
        if (muteBtn) {
          e.preventDefault();
          e.stopPropagation();
          const a = modal.querySelector("#fifaHlsAudio");
          if (a && a.srcObject) {
            // Audio alohida elementda — uni boshqaramiz
            if (a.muted || a.paused) {
              a.muted = false;
              a.volume = 1.0;
              a.play().catch((err) => console.warn("[audio] play", err.message));
              updateMuteIcon(modal, false);
            } else {
              a.muted = true;
              updateMuteIcon(modal, true);
            }
          } else {
            const v = modal.querySelector("#fifaHlsVideo");
            v.muted = !v.muted;
            if (!v.muted) { v.volume = 1.0; v.play?.().catch(() => {}); }
            updateMuteIcon(modal, v.muted);
          }
          removePlayerOverlay();
          return;
        }
        const fsBtn = e.target.closest && e.target.closest("#fifaHlsFs");
        if (fsBtn) {
          e.preventDefault();
          e.stopPropagation();
          toggleFullscreen(modal);
          return;
        }
        const playBtn = e.target.closest && e.target.closest("#fifaHlsPlayPause");
        if (playBtn) {
          e.preventDefault();
          e.stopPropagation();
          togglePlayPause(modal);
          return;
        }
        // Tugma bosilmagan har qanday joy — UI ni ko'rsatish/yashirish.
        // (Tugmalar yuqorida `return` bilan ushlanadi, bu yerga kelmaydi)
        const onButton = e.target.closest && e.target.closest(".fifa-player__icon-btn, .fifa-player__center-btn, #fifaPlayerOverlay");
        if (!onButton) {
          e.preventDefault();
          modal.classList.toggle("controls-hidden");
          if (!modal.classList.contains("controls-hidden")) scheduleControlsAutoHide(modal);
        }
      };
      // Faqat click — touchend ham qo'shilsa, iOS'da ikkalasi ketma-ket otilib
      // mute toggle ikki marta ishlaydi (ovoz yoqilib darhol qaytib o'chadi)
      modal.addEventListener("click", handleTap);
      // Desktop UX — sichqoncha harakatlansa panellarni ko'rsatib, inaktivlikda yashiramiz
      let lastMoveAt = 0;
      modal.addEventListener("mousemove", () => {
        const now = Date.now();
        if (now - lastMoveAt < 120) return; // throttle
        lastMoveAt = now;
        if (modal.classList.contains("controls-hidden")) modal.classList.remove("controls-hidden");
        scheduleControlsAutoHide(modal);
      });
      modal.addEventListener("mouseleave", () => scheduleControlsAutoHide(modal, 1200));
      attachFullscreenRecovery(modal);
      attachPlayPauseSync(modal);
    }
    modal.hidden = false;
    modal.classList.remove("controls-hidden");
    document.body.classList.add("fifa-hls-open");
    const video = modal.querySelector("#fifaHlsVideo");
    const status = modal.querySelector("#fifaHlsStatus");
    const setStatus = (msg) => {
      if (!status) return;
      status.textContent = msg || "";
      status.style.display = msg ? "block" : "none";
    };
    updateMuteIcon(modal, video.muted);
    // Avvalgi sessiya qoldiqlarini tozalaymiz
    try { video.srcObject = null; } catch (_) {}
    try { video.removeAttribute("src"); video.load?.(); } catch (_) {}
    try { activeHlsInstance?.destroy?.(); } catch (_) {}
    activeHlsInstance = null;
    try { activeWhepPc?.close?.(); } catch (_) {}
    activeWhepPc = null;
    setStatus("Yuklanmoqda…");

    if (mode === "whep") {
      if (typeof RTCPeerConnection === "undefined") {
        setStatus("Brauzer WebRTC qo'llab-quvvatlamaydi");
        return;
      }
      playWhep(src, video, setStatus).catch((err) => {
        console.warn("[whep error]", err);
        setStatus(err.message || "WebRTC ulanishda xato");
      });
      return;
    }

    // Avval hls.js bilan urinamiz (Chromium/Firefox/Telegram WebView), faqat
    // hls.js qo'llamaydigan joyda (asosan iOS Safari) native HLS'ga tushamiz.
    const tryNative = () => {
      const canNative = video.canPlayType("application/vnd.apple.mpegurl");
      if (!canNative) {
        setStatus("Brauzer HLS oqimini qo'llab-quvvatlamaydi");
        return;
      }
      video.src = src;
      const onErr = () => setStatus("Oqimni yuklab bo'lmadi");
      video.addEventListener("loadedmetadata", () => setStatus(""), { once: true });
      video.addEventListener("error", onErr, { once: true });
      video.play().catch(() => {});
    };

    loadHlsLib().then((Hls) => {
      if (!Hls || !Hls.isSupported()) {
        tryNative();
        return;
      }
      try { activeHlsInstance?.destroy?.(); } catch (_) {}
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1500,
        levelLoadingMaxRetry: 6,
      });
      activeHlsInstance = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setStatus(""); video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data || !data.fatal) return;
        console.warn("[hls.js fatal]", data.type, data.details, data.response?.code);
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (data.details === "manifestLoadError" || data.response?.code === 404) {
            setStatus("Oqim hali tayyor emas. 20 sekunddan keyin qayta urinib ko'ring.");
          } else {
            setStatus(`Tarmoq xatosi: ${data.details}`);
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setStatus(`Media xatosi: ${data.details}`);
          try { hls.recoverMediaError(); } catch (_) {}
        } else {
          setStatus(`Pleyer xatosi: ${data.details}`);
        }
      });
    }).catch((err) => {
      console.warn("[hls.js load failed]", err);
      tryNative();
    });
  }

  function closeHlsPlayerModal() {
    // Avval — agar foydalanuvchi to'liq ekran rejimida bo'lsa, undan chiqamiz
    try {
      const inFs = document.fullscreenElement || document.webkitFullscreenElement;
      if (inFs) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } catch (_) {}
    try {
      const tg = window.Telegram?.WebApp;
      if (tg?.isFullscreen && typeof tg.exitFullscreen === "function") tg.exitFullscreen();
      // BackButton fullscreen vaqtida yashirilgan edi — qaytaramiz
      try { tg?.BackButton?.show?.(); } catch (_) {}
    } catch (_) {}

    const modal = document.getElementById("fifaHlsModal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("fifa-hls-open");
    const video = modal.querySelector("#fifaHlsVideo");
    try { video?.pause?.(); } catch (_) {}
    if (video) {
      try { video.srcObject = null; } catch (_) {}
      video.removeAttribute("src");
      video.load?.();
    }
    const audioEl = modal.querySelector("#fifaHlsAudio");
    if (audioEl) {
      try { audioEl.pause?.(); } catch (_) {}
      try { audioEl.srcObject = null; } catch (_) {}
    }
    try { activeHlsInstance?.destroy?.(); } catch (_) {}
    activeHlsInstance = null;
    try { activeWhepPc?.close?.(); } catch (_) {}
    activeWhepPc = null;
    activeStream = null;
    removePlayerOverlay();

    // FIFA ko'rinishi to'liq ekran/iOS o'zgarishlari sabab yashirilib qolgan
    // bo'lishi mumkin — qaytadan ko'rsatamiz, tab holatini saqlaymiz.
    try {
      const fifaView = document.getElementById("fifaView");
      if (fifaView) {
        fifaView.hidden = false;
        fifaView.style.display = "";
      }
      document.body.classList.add("is-fifa");
    } catch (_) {}
  }

  window.renderFifaLivePromo = renderFifaLivePromo;

  // --- Open / close ---
  let fifaPollTimer = null;
  const FIFA_POLL_MS = 30 * 1000;

  async function refreshFifa() {
    await loadFifaData(true);
    renderMatches();
    renderGroups();
    renderLive();
  }
  function startFifaPolling() {
    if (fifaPollTimer) return;
    fifaPollTimer = setInterval(() => {
      if (document.hidden) return;
      if (fifaView?.hidden) return;
      refreshFifa();
    }, FIFA_POLL_MS);
  }
  function stopFifaPolling() {
    if (fifaPollTimer) { clearInterval(fifaPollTimer); fifaPollTimer = null; }
  }

  async function openFifaView() {
    fifaView.hidden = false;
    document.body.classList.add("is-fifa");
    renderFifaLivePromo();
    // Loading placeholder darhol ko'rinsin
    renderMatches();
    renderGroups();
    appShell?.scrollTo({ top: 0, behavior: "smooth" });
    try { tgBackRegister?.("fifa", () => closeFifaView()); } catch (_) {}
    // Real ma'lumotni fetch qilib qayta render
    await loadFifaData();
    renderMatches();
    renderGroups();
    // Live skor real vaqt rejimida yangilanib tursin
    startFifaPolling();
  }
  function closeFifaView() {
    fifaView.hidden = true;
    document.body.classList.remove("is-fifa");
    stopFifaPolling();
    try { tgBackUnregister?.("fifa"); } catch (_) {}
  }
  window.openFifaView = openFifaView;
  window.closeFifaView = closeFifaView;

  // --- Banner click ---
  fifaBanner?.addEventListener("click", () => {
    try { closeMusicView?.(); } catch (_) {}
    try { closePodcastsView?.(); } catch (_) {}
    openFifaView();
  });

  // =========================================================================
  // Lineup modal — tugagan o'yin ustiga bosilganda pastdan ochiladi.
  // Sxema stadion ustida, pastida tarkib + zaxiradan tushganlar + zaxiradagilar.
  // =========================================================================
  const lineupCache = new Map();

  function shortName(p) {
    if (!p.name) return "—";
    const parts = String(p.name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
  }

  function ratingColor(r, motm) {
    if (motm) return "fifa-rating--blue";
    if (r == null) return "";
    if (r >= 7) return "fifa-rating--green";
    if (r >= 6) return "fifa-rating--orange";
    return "fifa-rating--red";
  }

  function playerInlineBadgesHtml(p) {
    const out = [];
    if (p.goals > 0) out.push(`<span class="fifa-badge fifa-badge--goal" title="Gol">⚽${p.goals > 1 ? `<sup>${p.goals}</sup>` : ""}</span>`);
    if (p.redCard) out.push(`<span class="fifa-badge fifa-badge--red" title="Qizil karta"></span>`);
    else if (p.yellowCard) out.push(`<span class="fifa-badge fifa-badge--yellow" title="Sariq karta"></span>`);
    if (p.isCaptain) out.push(`<span class="fifa-badge fifa-badge--cap" title="Kapitan">C</span>`);
    return out.join("");
  }

  function buildPitchPlayerHtml(p, side) {
    // side: 'home' | 'away'. Coords: x (0..1 own goal→opp goal), y (0..1 left→right)
    const x = typeof p.x === "number" ? p.x : 0.5;
    const y = typeof p.y === "number" ? p.y : 0.5;
    const topPct = side === "home" ? x * 50 : 100 - x * 50;
    const leftPct = side === "home" ? y * 100 : (1 - y) * 100;
    const num = p.number != null ? String(p.number) : "";
    const initials = (p.name || "?").split(/\s+/).map((s) => s[0] || "").join("").slice(0, 2).toUpperCase();
    const photo = p.photo
      ? `<img src="${esc(p.photo)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.querySelector('.fifa-pitch-player__initials')?.removeAttribute('hidden'); this.remove()">`
      : "";
    const ratingVal = p.motm ? `${p.rating != null ? p.rating.toFixed(1) : ""}<span class="fifa-rating__star">★</span>` : (p.rating != null ? p.rating.toFixed(1) : "");
    const rating = (p.rating != null || p.motm)
      ? `<span class="fifa-pitch-player__rating ${ratingColor(p.rating, p.motm)}">${ratingVal}</span>`
      : "";
    const subOutLabel = typeof p.subOut === "number" ? `${p.subOut}'` : "";
    const subBubble = p.subOut
      ? `<span class="fifa-pitch-player__sub fifa-pitch-player__sub--out" title="Almashtirildi${subOutLabel ? ` ${subOutLabel}` : ""}">${subOutLabel}<span class="fifa-pitch-player__sub-icon">↓</span></span>`
      : "";
    const nameLine = num ? `${esc(num)} ${esc(shortName(p))}` : esc(shortName(p));
    return `
      <div class="fifa-pitch-player" style="top:${topPct.toFixed(2)}%;left:${leftPct.toFixed(2)}%;">
        ${subBubble}
        <div class="fifa-pitch-player__avatar">
          ${photo}
          <span class="fifa-pitch-player__initials" ${p.photo ? "hidden" : ""}>${esc(initials)}</span>
          ${rating}
        </div>
        <div class="fifa-pitch-player__line">${playerInlineBadgesHtml(p)}<span class="fifa-pitch-player__name">${nameLine}</span></div>
      </div>
    `;
  }

  function buildBenchPlayerHtml(p, opts = {}) {
    const num = p.number != null ? String(p.number) : "";
    const rating = p.rating != null
      ? `<span class="fifa-bench__rating ${ratingColor(p.rating)}">${p.rating.toFixed(1)}</span>`
      : "";
    const initials = (p.name || "?").split(/\s+/).map((s) => s[0] || "").join("").slice(0, 2).toUpperCase();
    const meta = opts.swapLine || "";
    return `
      <div class="fifa-bench__item">
        <div class="fifa-bench__avatar">
          ${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.querySelector('.fifa-bench__initials')?.removeAttribute('hidden'); this.remove()">` : ""}
          <span class="fifa-bench__initials" ${p.photo ? "hidden" : ""}>${esc(initials)}</span>
          ${num ? `<span class="fifa-bench__num">${esc(num)}</span>` : ""}
        </div>
        <div class="fifa-bench__meta">
          <div class="fifa-bench__name">${esc(p.name || "—")} ${playerBadgesHtml(p)}</div>
          <div class="fifa-bench__pos">${esc(meta || p.position || "")}</div>
        </div>
        ${rating}
      </div>
    `;
  }

  async function fetchLineup(homeEn, awayEn, dateIso) {
    const key = `${homeEn}|${awayEn}|${dateIso || ""}`.toLowerCase();
    if (lineupCache.has(key)) return lineupCache.get(key);
    const params = new URLSearchParams({ type: "fifa-lineup", home: homeEn, away: awayEn });
    if (dateIso) params.set("date", dateIso);
    const res = await fetch(buildApiUrl(`/api/categories?${params.toString()}`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lineupCache.set(key, data);
    return data;
  }

  function ensureLineupModal() {
    let modal = document.getElementById("fifaLineupModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "fifaLineupModal";
    modal.className = "fifa-lineup-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="fifa-lineup-modal__backdrop" data-close></div>
      <div class="fifa-lineup-modal__sheet" role="dialog" aria-modal="true" aria-label="O'yin tarkiblari">
        <div class="fifa-lineup-modal__grabber"></div>
        <div class="fifa-lineup-modal__head">
          <div class="fifa-lineup-modal__teams" id="fifaLineupHead"></div>
          <button type="button" class="fifa-lineup-modal__close" data-close aria-label="Yopish">×</button>
        </div>
        <div class="fifa-lineup-modal__body" id="fifaLineupBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) closeLineupModal();
    });
    return modal;
  }

  function lineupLoadingHtml() {
    return `<div class="fifa-lineup-loading"><div class="fifa-spinner"></div><div>Tarkiblar yuklanmoqda…</div></div>`;
  }
  function lineupEmptyHtml(msg) {
    return `<div class="fifa-lineup-empty"><div class="fifa-live-empty__icon">⚽</div><div>${esc(msg)}</div></div>`;
  }

  function renderLineupHead(home, away, homeFlag, awayFlag, score) {
    return `
      <div class="fifa-lineup-team fifa-lineup-team--home">
        <span class="fifa-lineup-team__flag">${homeFlag || ""}</span>
        <span class="fifa-lineup-team__name">${esc(home)}</span>
      </div>
      <div class="fifa-lineup-score">${esc(score || "—")}</div>
      <div class="fifa-lineup-team fifa-lineup-team--away">
        <span class="fifa-lineup-team__name">${esc(away)}</span>
        <span class="fifa-lineup-team__flag">${awayFlag || ""}</span>
      </div>
    `;
  }

  function renderLineupBody(data, homeUz, awayUz, homeFlag, awayFlag) {
    if (!data || !data.found) return lineupEmptyHtml("Bu o'yin uchun tarkib hali mavjud emas.");
    const home = data.home || { starting: [], subs: [] };
    const away = data.away || { starting: [], subs: [] };
    const teamHeader = (team, name, flag) => {
      const rating = team.rating != null
        ? `<span class="fifa-team-strip__rating ${ratingColor(team.rating, false)}">${team.rating.toFixed(1)}</span>`
        : `<span class="fifa-team-strip__rating fifa-rating--muted">—</span>`;
      const formation = team.formation ? `<span class="fifa-team-strip__formation">${esc(team.formation)}</span>` : "";
      return `
        <div class="fifa-team-strip">
          ${rating}
          <span class="fifa-team-strip__flag">${flag || ""}</span>
          <span class="fifa-team-strip__name">${esc(name)}</span>
          ${formation}
        </div>
      `;
    };

    // Zaxiradan tushgan (subIn truthy) — alohida bo'lim
    const isSubbedIn = (p) => p.subIn === true || typeof p.subIn === "number";
    const homeSubbedIn = (home.subs || []).filter(isSubbedIn);
    const homeBench   = (home.subs || []).filter((p) => !isSubbedIn(p));
    const awaySubbedIn = (away.subs || []).filter(isSubbedIn);
    const awayBench   = (away.subs || []).filter((p) => !isSubbedIn(p));

    const benchCol = (teamLabel, subbedIn, bench, coach) => `
      <div class="fifa-bench__col">
        <div class="fifa-bench__team">${esc(teamLabel)}</div>
        ${subbedIn.length ? `
          <div class="fifa-bench__group">
            <div class="fifa-bench__title">Zaxiradan tushganlar</div>
            <div class="fifa-bench__list">
              ${subbedIn.map((p) => buildBenchPlayerHtml(p, { swapLine: typeof p.subIn === "number" ? `${p.subIn}' kirdi` : (p.subIn ? "Kirdi" : p.position) })).join("")}
            </div>
          </div>
        ` : ""}
        ${bench.length ? `
          <div class="fifa-bench__group">
            <div class="fifa-bench__title">Zaxiradagilar</div>
            <div class="fifa-bench__list">
              ${bench.map((p) => buildBenchPlayerHtml(p)).join("")}
            </div>
          </div>
        ` : ""}
        ${coach ? `
          <div class="fifa-bench__group">
            <div class="fifa-bench__title">Bosh murabbiy</div>
            <div class="fifa-bench__list">
              <div class="fifa-bench__item">
                <div class="fifa-bench__avatar">
                  ${coach.photo ? `<img src="${esc(coach.photo)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
                </div>
                <div class="fifa-bench__meta"><div class="fifa-bench__name">${esc(coach.name)}</div></div>
              </div>
            </div>
          </div>
        ` : ""}
      </div>
    `;

    return `
      <div class="fifa-pitch-wrap">
        ${teamHeader(home, homeUz, homeFlag)}
        <div class="fifa-pitch">
          <div class="fifa-pitch__bg" aria-hidden="true">
            <span class="fifa-pitch__circle"></span>
            <span class="fifa-pitch__halfline"></span>
            <span class="fifa-pitch__box fifa-pitch__box--top"></span>
            <span class="fifa-pitch__box fifa-pitch__box--bottom"></span>
            <span class="fifa-pitch__spot fifa-pitch__spot--top"></span>
            <span class="fifa-pitch__spot fifa-pitch__spot--bottom"></span>
          </div>
          <div class="fifa-pitch__players">
            ${(home.starting || []).map((p) => buildPitchPlayerHtml(p, "home")).join("")}
            ${(away.starting || []).map((p) => buildPitchPlayerHtml(p, "away")).join("")}
          </div>
        </div>
        ${teamHeader(away, awayUz, awayFlag)}
      </div>
      <div class="fifa-bench">
        ${benchCol(homeUz, homeSubbedIn, homeBench, home.coach)}
        ${benchCol(awayUz, awaySubbedIn, awayBench, away.coach)}
      </div>
    `;
  }

  async function openLineupModal({ homeEn, awayEn, homeUz, awayUz, homeFlag, awayFlag, score, date }) {
    const modal = ensureLineupModal();
    modal.hidden = false;
    document.body.classList.add("fifa-lineup-open");
    const head = modal.querySelector("#fifaLineupHead");
    const body = modal.querySelector("#fifaLineupBody");
    head.innerHTML = renderLineupHead(homeUz, awayUz, homeFlag, awayFlag, score);
    body.innerHTML = lineupLoadingHtml();
    requestAnimationFrame(() => modal.classList.add("is-open"));
    try { tgBackRegister?.("fifa-lineup", () => closeLineupModal()); } catch (_) {}
    try {
      const data = await fetchLineup(homeEn, awayEn, date);
      body.innerHTML = renderLineupBody(data, homeUz, awayUz, homeFlag, awayFlag);
    } catch (err) {
      body.innerHTML = lineupEmptyHtml("Tarkibni yuklab bo'lmadi.");
    }
  }

  function closeLineupModal() {
    const modal = document.getElementById("fifaLineupModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    document.body.classList.remove("fifa-lineup-open");
    try { tgBackUnregister?.("fifa-lineup"); } catch (_) {}
    setTimeout(() => { modal.hidden = true; }, 260);
  }

  // Delegate click on matches panel
  fifaView.addEventListener("click", (e) => {
    const row = e.target.closest?.("[data-fifa-open-lineup]");
    if (!row) return;
    openLineupModal({
      homeEn: row.dataset.homeEn,
      awayEn: row.dataset.awayEn,
      homeUz: row.dataset.homeUz,
      awayUz: row.dataset.awayUz,
      homeFlag: row.querySelector(".fifa-match__team--home .fifa-match__flag")?.innerHTML || "",
      awayFlag: row.querySelector(".fifa-match__team--away .fifa-match__flag")?.innerHTML || "",
      score: row.dataset.score,
      date: row.dataset.date,
    });
  });
})();

// Modul tashqi interfeysi — lazy-loader uchun
window.__fifa = { openFifaView: window.openFifaView, closeFifaView: window.closeFifaView };

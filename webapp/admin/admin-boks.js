/* ==========================================================================
   Admin → Boks bo'limi (NTV × O'zbekiston Boks Federatsiyasi)
   Uch tab: Efir · Janglar (kanal, arxiv, pin, yashirish) · Terma jamoa (rasm, ism, natija)
   API: /api/boks (api/_lib/boks.js). admin.js dan keyin yuklanadi va uning
   showNotification / escapeHtml / readFileAsDataUrl / compressImageDataUrl
   yordamchilaridan foydalanadi.
   ========================================================================== */
(function initBoksAdmin() {
  'use strict';

  const section = document.getElementById('boksSection');
  if (!section) return;

  const API = '/api/boks';
  const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
  const ICON_PIN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 3a1 1 0 0 1 .7 1.7L15 6.4v4.1l2.6 2.6A1 1 0 0 1 17 15h-4v5.5a1 1 0 0 1-2 0V15H7a1 1 0 0 1-.7-1.7L9 10.5V6.4L7.3 4.7A1 1 0 0 1 8 3h8Z"/></svg>';
  const ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  const ICON_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"></path><path d="m2 2 20 20"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>';
  const ICON_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"></path></svg>';
  const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>';
  const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';
  const ICON_PHOTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path></svg>';

  const state = {
    loaded: false,
    loading: false,
    config: null,
    pinned: [],          // pin qilingan janglar (video obyektlari, admin tartibida)
    videos: [],          // joriy filtr/qidiruv sahifalari
    total: 0,
    nextOffset: null,
    counts: { all: 0, visible: 0, pinned: 0, hidden: 0 },
    archive: { count: 0, done: false, scanned: 0, channelVideos: 0 },
    videosError: '',
    maxPins: 20,
    storage: '',
    filter: 'all',
    query: '',
    listSeq: 0,
    listLoading: false,
    backfilling: false,
    stopBackfill: false,
    editing: null, // terma jamoa a'zosi (tahrirlash oynasi)
  };

  const $ = (sel) => section.querySelector(sel);
  const esc = (v) => escapeHtml(v == null ? '' : String(v));

  /* ---------------- Yordamchilar ---------------- */
  function extractYoutubeId(input) {
    const raw = String(input || '').trim();
    if (/^[\w-]{11}$/.test(raw)) return raw;
    const m = raw.match(/(?:youtu\.be\/|[?&]v=|youtube\.com\/(?:embed|shorts|live)\/)([\w-]{11})/);
    return m ? m[1] : '';
  }
  function formatDuration(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }
  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  function formatCount(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')} mln`;
    if (n >= 1e4) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')} ming`;
    return n.toLocaleString('ru-RU');
  }
  function initials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }
  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="bx-spinner" aria-hidden="true"></span>${label || 'Saqlanmoqda…'}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  async function request(method, body, query = '') {
    const res = await fetch(API + query, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  function listQuery(offset = 0) {
    const p = new URLSearchParams({ view: 'admin', filter: state.filter, offset: String(offset) });
    if (state.query.trim()) p.set('q', state.query.trim());
    return p;
  }

  // Server javobidagi (adminPayload) ro'yxat maydonlarini holatga yozadi.
  function applyList(json, append) {
    state.config = json.config || state.config;
    state.pinned = json.pinned || [];
    state.videos = append ? state.videos.concat(json.videos || []) : (json.videos || []);
    state.total = json.total || 0;
    state.nextOffset = json.nextOffset != null ? json.nextOffset : null;
    state.counts = json.counts || state.counts;
    state.archive = json.archive || state.archive;
    state.videosError = json.videosError || '';
    if (json.maxPins) state.maxPins = json.maxPins;
    if (json.storage) state.storage = json.storage;
  }

  async function savePatch(patch, okMessage) {
    const json = await request('POST', { action: 'update', patch });
    state.config = json.config;
    if (!json.stored) showNotification('Redis ulanmagan — o‘zgarish faqat vaqtincha saqlandi.', 'warning');
    else if (okMessage) showNotification(okMessage);
    renderSummary();
    return json;
  }

  /* ---------------- Yuklash ---------------- */
  async function load(force) {
    if (state.loading || (state.loaded && !force)) return;
    state.loading = true;
    $('#boksAdminSummary').innerHTML = '<div class="bx-skeleton"></div><div class="bx-skeleton"></div><div class="bx-skeleton"></div><div class="bx-skeleton"></div>';
    $('#boksVideosGrid').innerHTML = '<div class="bx-empty"><span class="bx-spinner"></span><b>Janglar yuklanmoqda…</b></div>';
    try {
      const json = await request('GET', null, `?${listQuery(0)}`);
      applyList(json, false);
      state.loaded = true;
      renderAll();
    } catch (err) {
      $('#boksAdminSummary').innerHTML = `<div class="bx-alert bx-alert--error">Yuklashda xato: ${esc(err.message)} <button type="button" class="btn btn-secondary btn-sm" data-bx-reload>Qayta urinish</button></div>`;
    } finally {
      state.loading = false;
    }
  }

  async function loadList(append) {
    const seq = ++state.listSeq;
    state.listLoading = true;
    if (!append) $('#boksVideosGrid').classList.add('is-loading');
    renderMore();
    try {
      const json = await request('GET', null, `?${listQuery(append ? state.nextOffset || 0 : 0)}`);
      if (seq !== state.listSeq) return;
      applyList(json, append);
      renderVideos();
      renderPins();
      renderSummary();
    } catch (err) {
      if (seq === state.listSeq) showNotification(`Ro‘yxatni yuklab bo‘lmadi: ${err.message}`, 'error');
    } finally {
      if (seq === state.listSeq) {
        state.listLoading = false;
        $('#boksVideosGrid').classList.remove('is-loading');
        renderMore();
      }
    }
  }

  function renderAll() {
    renderSummary();
    renderStreamForm();
    renderChannel();
    renderPins();
    renderVideos();
    renderTeam();
  }

  /* ---------------- Umumiy holat kartochkalari ---------------- */
  function renderSummary() {
    const c = state.config;
    if (!c) return;
    const live = c.stream && c.stream.youtubeId;
    const card = (tab, label, value, sub, tone) => `
      <button type="button" class="bx-stat${tone ? ` bx-stat--${tone}` : ''}" data-boks-admin-goto="${tab}">
        <span class="bx-stat__label">${label}</span>
        <span class="bx-stat__value">${value}</span>
        <span class="bx-stat__sub">${sub}</span>
      </button>`;
    $('#boksAdminSummary').innerHTML =
      card('stream', 'Efir', live ? (c.stream.isLive ? '● Jonli' : 'Ulangan') : 'Yo‘q', live ? esc(c.stream.title || 'Sarlavhasiz') : 'YouTube link qo‘shing', live && c.stream.isLive ? 'live' : '') +
      card('fights', 'Janglar', formatCount(state.counts.visible), state.videosError ? 'Kanal yuklanmadi' : (state.archive.done ? 'arxiv to‘liq' : 'mini ilovada ko‘rinadi'), state.videosError ? 'warn' : '') +
      card('fights', 'Pin qilingan', `${(c.pins || []).length}<small>/${state.maxPins}</small>`, 'eng tepada turadi', '') +
      card('team', 'Terma jamoa', (c.team || []).length, 'a’zo', '') +
      (state.storage === 'memory' ? '<div class="bx-alert bx-alert--warn">Redis ulanmagan: o‘zgarishlar server qayta ishga tushganda yo‘qoladi.</div>' : '');
    $('#boksAdminPinBadge').textContent = `${(c.pins || []).length}/${state.maxPins}`;
    $('#boksAdminTeamBadge').textContent = String((c.team || []).length);
  }

  /* ---------------- 1. Efir ---------------- */
  function renderStreamForm() {
    const s = (state.config && state.config.stream) || {};
    $('#boksStreamUrl').value = s.url || '';
    $('#boksStreamTitle').value = s.title || '';
    $('#boksStreamSubtitle').value = s.subtitle || '';
    $('#boksStreamLive').checked = Boolean(s.isLive);
    renderStreamPreview();
  }

  function renderStreamPreview() {
    const id = extractYoutubeId($('#boksStreamUrl').value);
    const title = $('#boksStreamTitle').value.trim();
    const sub = $('#boksStreamSubtitle').value.trim();
    const live = $('#boksStreamLive').checked;
    const urlInput = $('#boksStreamUrl');
    const bad = Boolean(urlInput.value.trim()) && !id;
    urlInput.classList.toggle('is-invalid', bad);
    $('#boksStreamUrlHint').textContent = bad ? 'Bu YouTube havolasiga o‘xshamaydi.' : 'YouTube Live, watch, youtu.be yoki embed havolasi.';
    $('#boksStreamPreview').innerHTML = id
      ? `<div class="bx-preview__frame"><img src="https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg" alt="">
           ${live ? '<span class="bx-live"><i></i>LIVE</span>' : ''}<span class="bx-preview__play">▶</span></div>
         <div class="bx-preview__meta"><b>${esc(title || 'Jonli efir')}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`
      : '<div class="bx-preview__frame bx-preview__frame--empty"><span>Efir ulanmagan</span><small>Mini ilovada «Hozircha efir yo‘q» ko‘rinadi</small></div>';
  }

  async function saveStream(clear) {
    const btn = clear ? $('#boksStreamClearBtn') : $('#boksStreamSaveBtn');
    const url = clear ? '' : $('#boksStreamUrl').value.trim();
    if (!clear && url && !extractYoutubeId(url)) {
      showNotification('YouTube havolasini tekshiring.', 'error');
      return;
    }
    const stream = clear
      ? { url: '', title: '', subtitle: '', isLive: false }
      : { url, title: $('#boksStreamTitle').value.trim(), subtitle: $('#boksStreamSubtitle').value.trim(), isLive: $('#boksStreamLive').checked };
    setBusy(btn, true);
    try {
      await savePatch({ stream }, clear ? 'Efir o‘chirildi.' : 'Efir saqlandi.');
      renderStreamForm();
    } catch (err) {
      showNotification(`Saqlashda xato: ${err.message}`, 'error');
    } finally {
      setBusy(btn, false);
    }
  }

  /* ---------------- 2. Janglar: kanal va arxiv ---------------- */
  function renderChannel() {
    const ch = (state.config && state.config.channel) || {};
    if (document.activeElement !== $('#boksChannelInput')) $('#boksChannelInput').value = ch.input || '';
    const a = state.archive;
    const pct = a.done ? 100 : a.channelVideos ? Math.min(99, Math.round((a.scanned / a.channelVideos) * 100)) : 0;
    const channelHtml = ch.channelId
      ? `${ch.avatar ? `<img src="${esc(ch.avatar)}" alt="">` : '<span class="bx-avatar">YT</span>'}
         <span class="bx-channel-card__name"><b>${esc(ch.title || ch.handle || ch.channelId)}</b><small>${esc(ch.handle || ch.channelId)}${a.channelVideos ? ` · kanalda ${formatCount(a.channelVideos)} ta video` : ''}</small></span>`
      : '<span class="bx-muted">Kanal hali aniqlanmagan — saqlang yoki videolarni yangilang.</span>';
    const archiveHtml = `
      <div class="bx-archive">
        <div class="bx-archive__row">
          <span><b>${formatCount(a.count)}</b> ta jang arxivda${a.done ? ' · <span class="bx-ok">to‘liq ✓</span>' : ''}</span>
          ${a.done ? '' : state.backfilling
            ? '<button type="button" class="btn btn-secondary btn-sm" data-bx-backfill-stop>To‘xtatish</button>'
            : `<button type="button" class="btn btn-primary btn-sm" data-bx-backfill>${a.scanned ? 'Arxivni yuklashni davom ettirish' : 'Butun arxivni yuklash'}</button>`}
        </div>
        <div class="bx-progress${state.backfilling ? ' is-active' : ''}"><span style="width:${pct}%"></span></div>
        <small class="form-hint">${a.done
          ? 'Kanaldagi barcha janglar qidiruvda bor. Yangi janglar avtomatik qo‘shiladi.'
          : `Mini ilova qidiruvi faqat arxivdagi janglar bo‘yicha ishlaydi. Yangi janglar avtomatik qo‘shiladi; eskilarini bir marta yuklang (${pct}% ko‘rib chiqildi). Har bosqich ~5 soniya.`}</small>
      </div>`;
    $('#boksChannelCard').innerHTML = `<div class="bx-channel-card__head">${channelHtml}</div>${archiveHtml}`;
  }

  async function saveChannel() {
    const input = $('#boksChannelInput').value.trim();
    if (!input) { showNotification('Kanal havolasi yoki @handle kiriting.', 'error'); return; }
    const btn = $('#boksChannelSaveBtn');
    setBusy(btn, true, 'Tekshirilmoqda…');
    try {
      const json = await request('POST', { action: 'set-channel', input, list: Object.fromEntries(listQuery(0)) });
      applyList(json, false);
      renderAll();
      showNotification('Kanal saqlandi.');
    } catch (err) {
      showNotification(`Kanal topilmadi: ${err.message}`, 'error');
    } finally {
      setBusy(btn, false);
    }
  }

  async function refreshVideos() {
    const btn = $('#boksVideosRefreshBtn');
    setBusy(btn, true, 'Yangilanmoqda…');
    try {
      const json = await request('POST', { action: 'refresh-videos', list: Object.fromEntries(listQuery(0)) });
      applyList(json, false);
      renderAll();
      showNotification('Kanaldagi yangi janglar olindi.');
    } catch (err) {
      showNotification(`Videolarni yangilab bo‘lmadi: ${err.message}`, 'error');
    } finally {
      setBusy(btn, false);
    }
  }

  async function runBackfill() {
    if (state.backfilling) return;
    state.backfilling = true;
    state.stopBackfill = false;
    renderChannel();
    let added = 0;
    try {
      while (!state.stopBackfill) {
        const json = await request('POST', { action: 'backfill', list: Object.fromEntries(listQuery(0)) });
        applyList(json, false);
        added += Number(json.added) || 0;
        renderChannel();
        renderSummary();
        if (state.archive.done) break;
      }
      renderVideos();
      renderPins();
      showNotification(state.archive.done
        ? `Arxiv to‘liq yuklandi: ${formatCount(state.archive.count)} ta jang.`
        : `To‘xtatildi. ${formatCount(added)} ta jang qo‘shildi.`);
    } catch (err) {
      showNotification(`Arxivni yuklashda xato: ${err.message}`, 'error');
    } finally {
      state.backfilling = false;
      renderChannel();
    }
  }

  /* ---------------- 2. Janglar: pinlar va ro'yxat ---------------- */
  function renderPins() {
    const pins = (state.config && state.config.pins) || [];
    $('#boksPinsTitle').innerHTML = `Pin qilingan janglar <span class="bx-count">${pins.length}/${state.maxPins}</span>`;
    const box = $('#boksPinsList');
    if (!pins.length) {
      box.innerHTML = `<div class="bx-empty">${ICON_PIN}<b>Hali jang pin qilinmagan</b><span>Pastdagi ro‘yxatdan jangning «Pin qilish» tugmasini bosing — u mini ilovada «Tanlangan janglar» bo‘lib eng tepada turadi.</span></div>`;
      return;
    }
    const byId = new Map(state.pinned.map((v) => [v.videoId, v]));
    box.innerHTML = pins.map((id, i) => {
      const v = byId.get(id) || { videoId: id, title: '', thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` };
      return `
        <div class="bx-pin" data-video-id="${esc(id)}">
          <span class="bx-pin__num">${i + 1}</span>
          <img class="bx-pin__thumb" src="${esc(v.thumb)}" alt="" loading="lazy">
          <span class="bx-pin__body"><b>${esc(v.title || 'Video arxivda topilmadi')}</b><small>${v.durationSec ? `${formatDuration(v.durationSec)} · ` : ''}${esc(formatDate(v.publishedAt))}</small></span>
          <span class="bx-pin__actions">
            <button type="button" class="bx-icon-btn" data-bx-pin-move="-1" ${i === 0 ? 'disabled' : ''} title="Yuqoriga">${ICON_UP}</button>
            <button type="button" class="bx-icon-btn" data-bx-pin-move="1" ${i === pins.length - 1 ? 'disabled' : ''} title="Pastga">${ICON_DOWN}</button>
            <button type="button" class="bx-icon-btn bx-icon-btn--danger" data-bx-unpin title="Pindan olish">${ICON_X}</button>
          </span>
        </div>`;
    }).join('');
  }

  function videoCard(v, pinsFull) {
    const pinBlocked = !v.pinned && (pinsFull || v.hidden);
    return `
      <article class="bx-video${v.pinned ? ' is-pinned' : ''}${v.hidden ? ' is-hidden' : ''}" data-video-id="${esc(v.videoId)}">
        <a class="bx-video__thumb" href="https://www.youtube.com/watch?v=${esc(v.videoId)}" target="_blank" rel="noopener" title="YouTube'da ochish">
          <img src="${esc(v.thumb)}" alt="" loading="lazy">
          <span class="bx-video__dur">${formatDuration(v.durationSec)}</span>
          ${v.pinned ? `<span class="bx-video__flag bx-video__flag--pin">${ICON_PIN}Pin</span>` : ''}
          ${v.hidden ? `<span class="bx-video__flag">${ICON_EYE_OFF}Yashirin</span>` : ''}
        </a>
        <div class="bx-video__body">
          <h4 title="${esc(v.title)}">${esc(v.title)}</h4>
          <p>${esc(formatDate(v.publishedAt))}${v.viewCount ? ` · ${formatCount(v.viewCount)} ko‘rish` : ''}</p>
          <div class="bx-video__actions">
            <button type="button" class="bx-chip-btn${v.pinned ? ' is-on' : ''}" data-bx-toggle-pin ${pinBlocked ? 'disabled' : ''}
              title="${v.hidden && !v.pinned ? 'Yashirin videoni pin qilib bo‘lmaydi' : pinsFull && !v.pinned ? `Ko‘pi bilan ${state.maxPins} ta` : ''}">
              ${ICON_PIN}${v.pinned ? 'Pin qilingan' : 'Pin qilish'}
            </button>
            <button type="button" class="bx-chip-btn bx-chip-btn--ghost" data-bx-toggle-hide title="${v.hidden ? 'Mini ilovada qayta ko‘rsatish' : 'Jang emas — mini ilovada ko‘rsatmaslik'}">
              ${v.hidden ? `${ICON_EYE}Ko‘rsatish` : `${ICON_EYE_OFF}Yashirish`}
            </button>
          </div>
        </div>
      </article>`;
  }

  function renderVideos() {
    section.querySelectorAll('[data-bx-filter]').forEach((b) => {
      const key = b.dataset.bxFilter;
      b.classList.toggle('is-active', key === state.filter);
      const n = b.querySelector('.bx-seg__n');
      if (n) n.textContent = formatCount(state.counts[key]);
    });
    $('#boksVideosCount').textContent = state.query.trim() || state.filter !== 'all'
      ? `${formatCount(state.total)} ta natija`
      : '';

    const grid = $('#boksVideosGrid');
    if (state.videosError && !state.videos.length) {
      grid.innerHTML = `<div class="bx-alert bx-alert--error">Kanal videolari yuklanmadi: ${esc(state.videosError)}</div>`;
      renderMore();
      return;
    }
    if (!state.videos.length) {
      grid.innerHTML = `<div class="bx-empty"><b>${state.query ? 'Hech narsa topilmadi' : 'Bu ro‘yxat bo‘sh'}</b><span>${state.query ? (state.archive.done ? 'Boshqa so‘z bilan qidiring.' : 'Boshqa so‘z bilan qidiring yoki butun arxivni yuklang — eski janglar hali arxivda yo‘q.') : 'Filtrni o‘zgartiring yoki videolarni yangilang.'}</span></div>`;
      renderMore();
      return;
    }
    const pinsFull = ((state.config && state.config.pins) || []).length >= state.maxPins;
    grid.innerHTML = state.videos.map((v) => videoCard(v, pinsFull)).join('');
    renderMore();
  }

  function renderMore() {
    const box = $('#boksVideosMore');
    if (!box) return;
    if (state.nextOffset == null) { box.innerHTML = ''; return; }
    box.innerHTML = `<button type="button" class="btn btn-secondary" data-bx-more ${state.listLoading ? 'disabled' : ''}>${state.listLoading ? '<span class="bx-spinner"></span>Yuklanmoqda…' : `Yana ko‘rsatish (${formatCount(state.total - state.videos.length)} ta qoldi)`}</button>`;
  }

  // Lokal holatni yangilash (sahifa qayta yuklanmaydi, scroll joyida qoladi).
  function updateVideoFlags(id, flags) {
    state.videos.forEach((v) => { if (v.videoId === id) Object.assign(v, flags); });
    const el = $(`#boksVideosGrid [data-video-id="${CSS.escape(id)}"]`);
    if (el) {
      const v = state.videos.find((x) => x.videoId === id);
      const pinsFull = (state.config.pins || []).length >= state.maxPins;
      el.outerHTML = videoCard(v, pinsFull);
    }
  }

  function videoFromState(id) {
    return state.videos.find((v) => v.videoId === id) || state.pinned.find((v) => v.videoId === id);
  }

  async function togglePin(id) {
    const pins = [...(state.config.pins || [])];
    const idx = pins.indexOf(id);
    const adding = idx < 0;
    if (adding) {
      if (pins.length >= state.maxPins) { showNotification(`Ko‘pi bilan ${state.maxPins} ta jang pin qilinadi.`, 'warning'); return; }
      pins.push(id);
    } else {
      pins.splice(idx, 1);
    }
    try {
      await savePatch({ pins }, adding ? `Pin qilindi (${pins.length}/${state.maxPins}).` : 'Pindan olindi.');
      const v = videoFromState(id);
      if (adding && v && !state.pinned.some((p) => p.videoId === id)) state.pinned.push({ ...v, pinned: true });
      if (!adding) state.pinned = state.pinned.filter((p) => p.videoId !== id);
      state.counts.pinned = pins.length;
      const wasFull = adding ? pins.length === state.maxPins : pins.length === state.maxPins - 1;
      if (wasFull) {
        state.videos.forEach((x) => { if (x.videoId === id) x.pinned = adding; });
        renderVideos();
      } else {
        updateVideoFlags(id, { pinned: adding });
      }
      renderPins();
      renderVideoCounts();
    } catch (err) {
      showNotification(`Saqlashda xato: ${err.message}`, 'error');
    }
  }

  async function movePin(id, delta) {
    const pins = [...(state.config.pins || [])];
    const i = pins.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= pins.length) return;
    [pins[i], pins[j]] = [pins[j], pins[i]];
    try {
      await savePatch({ pins });
      renderPins();
    } catch (err) {
      showNotification(`Saqlashda xato: ${err.message}`, 'error');
    }
  }

  async function toggleHide(id) {
    const hidden = [...(state.config.hidden || [])];
    const idx = hidden.indexOf(id);
    const hiding = idx < 0;
    const patch = {};
    if (hiding) {
      hidden.push(id);
      // Yashirilgan jang pin ro'yxatida qolmaydi
      const pins = (state.config.pins || []).filter((p) => p !== id);
      if (pins.length !== (state.config.pins || []).length) patch.pins = pins;
    } else {
      hidden.splice(idx, 1);
    }
    patch.hidden = hidden;
    try {
      await savePatch(patch, hiding ? 'Video mini ilovada yashirildi.' : 'Video yana ko‘rinadi.');
      state.counts.hidden += hiding ? 1 : -1;
      state.counts.visible += hiding ? -1 : 1;
      if (patch.pins) {
        state.pinned = state.pinned.filter((p) => p.videoId !== id);
        state.counts.pinned = patch.pins.length;
        renderPins();
      }
      updateVideoFlags(id, { hidden: hiding, ...(patch.pins ? { pinned: false } : {}) });
      renderVideoCounts();
    } catch (err) {
      showNotification(`Saqlashda xato: ${err.message}`, 'error');
    }
  }

  function renderVideoCounts() {
    section.querySelectorAll('[data-bx-filter]').forEach((b) => {
      const n = b.querySelector('.bx-seg__n');
      if (n) n.textContent = formatCount(state.counts[b.dataset.bxFilter]);
    });
    renderSummary();
  }

  /* ---------------- 3. Terma jamoa ---------------- */
  function renderTeam() {
    const team = (state.config && state.config.team) || [];
    $('#boksTeamTitle').innerHTML = `Terma jamoa a’zolari <span class="bx-count">${team.length}</span>`;
    const grid = $('#boksTeamGrid');
    if (!team.length) {
      grid.innerHTML = '<div class="bx-empty"><b>Hali a’zo qo‘shilmagan</b><span>«A’zo qo‘shish» tugmasini bosing: rasm, ism va natijasini kiriting.</span></div>';
      return;
    }
    grid.innerHTML = team.map((m, i) => `
      <article class="bx-member" data-member-id="${esc(m.id)}">
        <div class="bx-member__photo">
          ${m.photo ? `<img src="${esc(m.photo)}" alt="" loading="lazy">` : `<span>${esc(initials(m.name))}</span>`}
          ${m.weight ? `<em>${esc(m.weight)}</em>` : ''}
          <span class="bx-member__order">
            <button type="button" class="bx-icon-btn bx-icon-btn--glass" data-bx-member-move="-1" ${i === 0 ? 'disabled' : ''} title="Oldinga">${ICON_UP}</button>
            <button type="button" class="bx-icon-btn bx-icon-btn--glass" data-bx-member-move="1" ${i === team.length - 1 ? 'disabled' : ''} title="Orqaga">${ICON_DOWN}</button>
          </span>
        </div>
        <div class="bx-member__body">
          <h4>${esc(m.name)}</h4>
          <p>${m.result ? esc(m.result) : '<span class="bx-muted">Natija kiritilmagan</span>'}</p>
        </div>
        <div class="bx-member__actions">
          <button type="button" class="btn btn-secondary btn-sm" data-bx-member-edit>${ICON_EDIT}Tahrirlash</button>
          <button type="button" class="bx-icon-btn bx-icon-btn--danger" data-bx-member-delete title="O‘chirish">${ICON_TRASH}</button>
        </div>
      </article>`).join('');
  }

  function openEditor(member) {
    state.editing = member ? { ...member } : { id: '', name: '', weight: '', result: '', photo: '' };
    const modal = $('#boksMemberModal');
    $('#boksMemberModalTitle').textContent = member ? 'A’zoni tahrirlash' : 'Yangi a’zo';
    $('#boksMemberName').value = state.editing.name;
    $('#boksMemberName').classList.remove('is-invalid');
    $('#boksMemberWeight').value = state.editing.weight;
    $('#boksMemberResult').value = state.editing.result;
    renderEditorPhoto();
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
    setTimeout(() => $('#boksMemberName').focus(), 60);
  }

  function closeEditor() {
    const modal = $('#boksMemberModal');
    modal.classList.remove('is-open');
    state.editing = null;
    setTimeout(() => { modal.hidden = true; }, 180);
  }

  function renderEditorPhoto(uploading) {
    const photo = state.editing && state.editing.photo;
    const drop = $('#boksMemberPhotoDrop');
    drop.classList.toggle('has-photo', Boolean(photo));
    drop.classList.toggle('is-uploading', Boolean(uploading));
    drop.querySelector('.bx-drop__preview').innerHTML = photo
      ? `<img src="${esc(photo)}" alt="">`
      : `${ICON_PHOTO}<b>Rasm yuklash</b><small>Bosing yoki rasmni shu yerga tashlang · JPG, PNG, WEBP</small>`;
    $('#boksMemberPhotoRemove').hidden = !photo;
  }

  async function uploadPhoto(file) {
    if (!file || !state.editing) return;
    if (!/^image\//.test(file.type)) { showNotification('Faqat rasm fayl tanlang.', 'error'); return; }
    renderEditorPhoto(true);
    try {
      const raw = await readFileAsDataUrl(file);
      const dataUrl = await compressImageDataUrl(raw, 900, 1125, 0.86);
      const name = $('#boksMemberName').value.trim().replace(/[^a-z0-9]/gi, '').slice(0, 30) || 'member';
      const json = await request('POST', { action: 'upload', dataUrl, name });
      if (state.editing) state.editing.photo = json.url;
      showNotification('Rasm yuklandi.');
    } catch (err) {
      showNotification(`Rasm yuklashda xato: ${err.message}`, 'error');
    } finally {
      renderEditorPhoto(false);
    }
  }

  async function saveMember() {
    const name = $('#boksMemberName').value.trim();
    if (!name) {
      $('#boksMemberName').classList.add('is-invalid');
      $('#boksMemberName').focus();
      showNotification('Ismni kiriting.', 'error');
      return;
    }
    const member = {
      ...state.editing,
      name,
      weight: $('#boksMemberWeight').value.trim(),
      result: $('#boksMemberResult').value.trim(),
    };
    const team = [...(state.config.team || [])];
    if (member.id) {
      const i = team.findIndex((m) => m.id === member.id);
      if (i >= 0) team[i] = member; else team.push(member);
    } else {
      member.id = `m${Date.now().toString(36)}`;
      team.push(member);
    }
    const btn = $('#boksMemberSaveBtn');
    setBusy(btn, true);
    try {
      await savePatch({ team }, 'A’zo saqlandi.');
      renderTeam();
      closeEditor();
    } catch (err) {
      showNotification(`Saqlashda xato: ${err.message}`, 'error');
    } finally {
      setBusy(btn, false);
    }
  }

  async function deleteMember(id) {
    const member = (state.config.team || []).find((m) => m.id === id);
    if (!member || !window.confirm(`«${member.name}» terma jamoadan o‘chirilsinmi?`)) return;
    try {
      await savePatch({ team: state.config.team.filter((m) => m.id !== id) }, 'A’zo o‘chirildi.');
      renderTeam();
    } catch (err) {
      showNotification(`O‘chirishda xato: ${err.message}`, 'error');
    }
  }

  async function moveMember(id, delta) {
    const team = [...(state.config.team || [])];
    const i = team.findIndex((m) => m.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= team.length) return;
    [team[i], team[j]] = [team[j], team[i]];
    try {
      await savePatch({ team });
      renderTeam();
    } catch (err) {
      showNotification(`Saqlashda xato: ${err.message}`, 'error');
    }
  }

  /* ---------------- Tablar va hodisalar ---------------- */
  function setTab(key) {
    section.querySelectorAll('[data-boks-admin-tab]').forEach((t) => {
      const active = t.dataset.boksAdminTab === key;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    });
    section.querySelectorAll('[data-boks-admin-panel]').forEach((p) => {
      p.hidden = p.dataset.boksAdminPanel !== key;
    });
    try { localStorage.setItem('admin-boks-tab', key); } catch (_) {}
  }

  section.addEventListener('click', (e) => {
    const t = e.target;
    const tab = t.closest('[data-boks-admin-tab], [data-boks-admin-goto]');
    if (tab) { setTab(tab.dataset.boksAdminTab || tab.dataset.boksAdminGoto); return; }
    if (t.closest('[data-bx-reload]')) { load(true); return; }
    if (t.closest('#boksStreamSaveBtn')) { saveStream(false); return; }
    if (t.closest('#boksStreamClearBtn')) {
      if (window.confirm('Efir o‘chirilsinmi? Mini ilovada «Hozircha efir yo‘q» ko‘rinadi.')) saveStream(true);
      return;
    }
    if (t.closest('#boksChannelSaveBtn')) { saveChannel(); return; }
    if (t.closest('#boksVideosRefreshBtn')) { refreshVideos(); return; }
    if (t.closest('[data-bx-backfill]')) { runBackfill(); return; }
    if (t.closest('[data-bx-backfill-stop]')) { state.stopBackfill = true; t.closest('button').disabled = true; return; }
    if (t.closest('[data-bx-more]')) { loadList(true); return; }
    const filter = t.closest('[data-bx-filter]');
    if (filter) {
      if (state.filter === filter.dataset.bxFilter) return;
      state.filter = filter.dataset.bxFilter;
      renderVideos();
      loadList(false);
      return;
    }

    const videoEl = t.closest('[data-video-id]');
    if (videoEl) {
      const id = videoEl.dataset.videoId;
      if (t.closest('[data-bx-toggle-pin]') || t.closest('[data-bx-unpin]')) { togglePin(id); return; }
      if (t.closest('[data-bx-toggle-hide]')) { toggleHide(id); return; }
      const move = t.closest('[data-bx-pin-move]');
      if (move) { movePin(id, Number(move.dataset.bxPinMove)); return; }
    }

    if (t.closest('#boksMemberAddBtn')) { openEditor(null); return; }
    const memberEl = t.closest('[data-member-id]');
    if (memberEl) {
      const id = memberEl.dataset.memberId;
      if (t.closest('[data-bx-member-edit]')) { openEditor((state.config.team || []).find((m) => m.id === id)); return; }
      if (t.closest('[data-bx-member-delete]')) { deleteMember(id); return; }
      const move = t.closest('[data-bx-member-move]');
      if (move) { moveMember(id, Number(move.dataset.bxMemberMove)); return; }
    }

    if (t.closest('[data-bx-modal-close]')) { closeEditor(); return; }
    if (t.closest('#boksMemberSaveBtn')) { saveMember(); return; }
    if (t.closest('#boksMemberPhotoRemove')) {
      if (state.editing) state.editing.photo = '';
      renderEditorPhoto();
      return;
    }
    if (t.closest('#boksMemberPhotoDrop')) $('#boksMemberPhotoFile').click();
  });

  let searchTimer = null;
  section.addEventListener('input', (e) => {
    if (e.target.closest('#boksStreamForm')) renderStreamPreview();
    if (e.target.id === 'boksVideosSearch') {
      state.query = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => loadList(false), 300);
    }
    if (e.target.id === 'boksMemberName') e.target.classList.remove('is-invalid');
  });
  section.addEventListener('change', (e) => {
    if (e.target.id === 'boksStreamLive') renderStreamPreview();
    if (e.target.id === 'boksMemberPhotoFile') {
      uploadPhoto(e.target.files && e.target.files[0]);
      e.target.value = '';
    }
  });
  section.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.editing) closeEditor();
    if (e.key === 'Enter' && e.target.id === 'boksChannelInput') saveChannel();
  });

  const drop = $('#boksMemberPhotoDrop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-drag'); }));
  drop.addEventListener('drop', (e) => uploadPhoto(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]));

  try { setTab(localStorage.getItem('admin-boks-tab') || 'stream'); } catch (_) { setTab('stream'); }

  window.boksAdmin = { load };
})();

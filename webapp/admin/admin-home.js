/* ==========================================================================
   Admin → Bosh sahifa (mini ilova bosh ekrani)
   Bo'limlar tartibi (sudrab tashlash), o'lcham, yoqish/o'chirish, asosiy kino
   (Hero) va salomlashish matni + o'ng tomonda jonli telefon ko'rinishi.
   API: /api/home (api/_lib/home-layout.js). admin.js dan keyin yuklanadi va uning
   movies / showNotification / escapeHtml / proxiedPoster yordamchilaridan foydalanadi.
   ========================================================================== */
(function initHomeLayoutAdmin() {
  'use strict';

  const section = document.getElementById('homeLayoutSection');
  if (!section) return;

  const API = '/api/home';
  const SIZES = [['s', 'Kichik'], ['m', "O'rta"], ['l', 'Katta']];
  const ICON_HANDLE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"></circle><circle cx="15" cy="6" r="1.6"></circle><circle cx="9" cy="12" r="1.6"></circle><circle cx="15" cy="12" r="1.6"></circle><circle cx="9" cy="18" r="1.6"></circle><circle cx="15" cy="18" r="1.6"></circle></svg>';
  const META = {
    kino: { label: 'Kino', note: 'Kinolar va seriallar', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3"></rect><path d="m10 9 5 3-5 3z"></path></svg>' },
    fifa: { label: 'Futbol', note: 'Jonli o\'yinlar', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20M12 2a14.5 14.5 0 0 1 0 20M2 12h20"></path></svg>' },
    boks: { label: 'Boks', note: 'Efir va janglar', icon: '<svg viewBox="0 0 544 544" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M174 530C155 528 132 523 116 517C101 512 73 499 64 492C44 479 28 458 20 436C15 420 13 413 14 394C14 366 14 364 38 309C56 267 61 259 74 247C86 235 97 228 114 223L122 220 L134 191C140 175 145 162 145 161C145 156 149 151 155 148C160 146 161 146 176 146C190 146 204 147 210 150C212 150 216 142 228 118C237 100 244 86 244 86C243 86 239 89 234 92C221 101 211 103 197 101C183 99 171 91 165 78C163 73 162 72 162 57C162 43 163 42 166 36C168 31 171 27 175 24C183 16 189 14 202 13C216 13 222 14 239 26L253 35 L258 33C262 30 264 30 272 30C280 30 282 30 286 33L291 35 L306 26C314 20 322 15 324 15C327 14 333 14 340 14C349 14 353 14 357 16C365 19 374 27 378 36C381 42 382 43 382 57C382 72 381 73 379 78C375 86 367 94 360 98C353 101 341 102 334 102C325 101 320 98 310 92C305 89 301 86 300 86C300 86 307 100 316 118C328 142 332 150 334 150C340 147 354 146 368 146C383 146 384 146 389 148C395 151 399 156 399 161C399 162 404 175 410 191L422 220 L432 224C439 226 447 230 452 233C463 239 479 254 485 265C490 273 522 344 525 356C530 368 531 375 530 395C530 411 530 415 528 423C521 447 512 463 496 480C485 490 475 496 455 506C426 519 411 524 386 528C369 531 336 531 328 529C304 522 287 504 280 482C277 472 276 456 278 446L280 438 L276 434L272 431 L268 434L264 438 L266 446C268 456 267 472 264 482C257 504 240 521 217 529C212 530 184 531 174 530ZM206 507C214 504 223 499 229 493C240 482 246 464 243 452L242 448 L230 448C221 448 217 448 212 446C204 443 198 439 192 433C187 428 180 415 180 412C180 410 180 410 178 410C168 414 161 415 154 415L145 415 L145 404L145 393 L151 393C159 392 167 389 173 385L178 382 L178 374C177 368 177 365 174 360C172 356 171 351 171 350C171 347 172 347 178 344C182 342 186 340 188 340C192 340 192 340 195 348C197 352 199 357 199 358C200 359 200 370 201 382C202 401 202 403 204 408C209 418 221 425 230 425C241 425 253 417 258 406L260 400 L261 367C261 346 261 330 260 325C258 311 253 299 245 288L241 283 L230 283C199 281 166 270 139 251L128 244 L121 246C106 251 88 265 79 278C75 285 46 350 41 365C33 386 35 409 44 432C50 445 64 461 77 471C83 475 104 486 120 493C136 499 160 506 176 507C185 508 201 508 206 507ZM385 505C399 502 411 498 424 493C441 486 461 475 468 470C503 444 516 401 503 364C497 349 468 284 465 278C456 265 438 251 423 246L416 244 L405 251C378 270 345 281 314 283L303 283 L299 288C291 300 286 311 284 325C283 330 283 347 283 367C283 399 284 401 286 405C291 417 303 426 313 425C323 425 335 418 340 408C342 403 342 401 343 382C344 370 344 359 345 358C345 357 347 352 349 348C352 340 352 340 356 340C358 340 362 342 366 344C372 347 373 347 373 350C373 351 372 356 370 360C367 365 367 368 366 374L366 382 L371 385C377 389 385 392 393 393L399 393 L399 404L399 415 L390 415C383 415 376 414 366 410C364 410 364 410 364 412C364 415 357 428 352 433C346 439 340 443 332 446C327 448 323 448 314 448L302 448 L301 452C298 464 304 482 315 493C321 499 330 504 338 507C345 509 370 508 385 505ZM278 276L283 268 L278 253C275 244 272 237 272 237C272 237 269 244 266 253L261 268 L266 276C269 280 272 284 272 284C272 284 275 280 278 276ZM246 239L253 217 L243 217C232 216 214 212 200 207C189 204 169 194 164 191C161 189 161 189 160 192C159 193 162 195 181 205C194 211 205 217 207 219C209 221 212 225 214 227C216 232 216 233 216 245L216 258 L222 259C226 259 231 260 234 260L239 260 L246 239ZM320 259L328 258 L328 245C328 234 328 232 330 228C331 225 334 221 336 219C338 218 350 211 363 205C382 195 385 193 384 192C383 189 383 189 380 191C375 194 355 204 344 207C330 212 312 216 301 217L291 217 L298 239L305 260 L309 260C311 260 316 260 320 259ZM194 244C194 239 190 237 171 227C160 221 151 217 150 217C150 218 149 220 148 222C147 226 147 226 150 229C155 233 174 244 183 247L192 251 L193 248C193 247 194 245 194 244ZM372 242C377 240 385 235 390 232L398 227 L396 222C395 220 394 217 393 217C393 217 384 222 373 227C350 239 349 240 351 247L352 251 L357 249C359 248 366 245 372 242ZM252 193C247 189 231 181 220 178C206 173 192 169 182 168L174 168 L178 171C185 175 204 184 216 187C229 191 241 194 253 195C254 195 254 194 252 193ZM306 193C324 190 353 179 366 170L370 168 L363 168C353 169 342 172 328 176C316 180 297 189 292 193L290 195 L294 194C296 194 302 193 306 193ZM278 172C286 168 297 162 303 160C306 159 308 158 308 157C308 156 272 86 272 86C272 86 236 156 236 157C236 158 238 159 241 160C247 162 259 168 266 172C269 174 272 176 272 176C272 176 275 174 278 172ZM212 76C215 75 239 59 240 58C242 57 212 37 208 36C195 34 182 49 185 61C187 69 193 76 201 78C204 79 208 78 212 76ZM349 75C356 71 361 61 359 53C358 48 355 43 350 40C341 34 337 34 318 47C310 53 303 57 303 57C303 58 331 76 335 78C339 79 343 79 349 75ZM275 60C277 58 277 57 275 55C275 54 273 53 272 53C271 53 269 54 269 55C267 57 267 58 269 60C270 61 272 62 272 62C272 62 274 61 275 60Z"></path></svg>' },
    music: { label: 'Musiqa', note: 'Qo\'shiqlar', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>' },
    podcasts: { label: 'Potkastlar', note: 'Yangi epizodlar', icon: '<svg class="podcast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="12" rx="4"></rect><circle cx="12" cy="5.2" r="0.9" fill="currentColor" stroke="none"></circle><path d="M10.2 8h3.6" stroke-width="1.8"></path><circle cx="12" cy="10.8" r="0.9" fill="currentColor" stroke="none"></circle><path d="M5 10v1.5a7 7 0 0 0 14 0V10"></path><line x1="12" y1="18.5" x2="12" y2="22"></line></svg>' },
    favorites: { label: 'Sevimlilar', note: 'Saqlangan kinolar', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"></path></svg>' },
    esports: { label: 'Kibersport', note: 'Translatsiyalar', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8h8a4 4 0 0 1 4 4v3a3 3 0 0 1-5.1 2.1L13 15h-2l-1.9 2.1A3 3 0 0 1 4 15v-3a4 4 0 0 1 4-4Z"></path><path d="M8 11v4M6 13h4M16 12h.01M18 14h.01"></path></svg>' },
    tv: { label: 'TV', note: 'Hozir efirda', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="3"></rect><path d="m8 2 4 4 4-4"></path></svg>' },
  };

  const state = {
    loaded: false,
    loading: false,
    saving: false,
    saved: null,   // serverdagi holat
    draft: null,   // admin tahrirlayotgan nusxa
    stored: true,  // Redis ulanganmi
  };

  const $ = (sel) => section.querySelector(sel);
  const esc = (v) => escapeHtml(v == null ? '' : String(v));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const isDirty = () => Boolean(state.saved && state.draft) && JSON.stringify(state.saved) !== JSON.stringify(state.draft);
  const adminMovies = () => (typeof movies !== 'undefined' && Array.isArray(movies) ? movies : []);

  // Server faqat tartib/sozlamani qaytaradi; updatedAt'ni solishtirishdan chiqaramiz.
  function editable(layout) {
    return { sections: layout.sections, hero: layout.hero, greeting: layout.greeting };
  }

  function heroMovie() {
    const list = adminMovies();
    const hero = state.draft.hero;
    if (hero.mode === 'manual') return list.find((m) => m.id === hero.movieId) || null;
    // Drive ro'yxati eng yangi o'zgartirilgan fayldan boshlanadi.
    return list[0] || null;
  }

  function posterSrc(movie) {
    return movie && movie.poster ? proxiedPoster(movie.poster) : POSTER_PLACEHOLDER;
  }

  /* ---------------- Holat va saqlash ---------------- */
  function renderStatus() {
    const status = $('#homeLayoutStatus');
    const dirty = isDirty();
    let key = 'live';
    let text = 'Jonli';
    if (state.loading) { key = 'loading'; text = 'Yuklanmoqda…'; }
    else if (state.saving) { key = 'loading'; text = 'Saqlanmoqda…'; }
    else if (dirty) { key = 'dirty'; text = 'Saqlanmagan o\'zgarishlar'; }
    else if (!state.stored) { key = 'warn'; text = 'Vaqtincha (Redis yo\'q)'; }
    status.dataset.state = key;
    status.textContent = text;
    $('#homeLayoutSave').disabled = !dirty || state.saving;
    $('#homeLayoutReset').disabled = !dirty || state.saving;
  }

  function changed() {
    renderPreview();
    renderStatus();
  }

  async function request(method, body) {
    const res = await fetch(API, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  function apply(layout) {
    state.saved = editable(layout);
    state.draft = clone(state.saved);
    renderAll();
  }

  async function load(force) {
    if (state.loading || (state.loaded && !force)) return;
    state.loading = true;
    renderStatus();
    try {
      const json = await request('GET');
      state.loaded = true;
      state.loading = false;
      apply(json.layout);
    } catch (err) {
      state.loading = false;
      renderStatus();
      showNotification('Bosh sahifa sozlamasini yuklab bo\'lmadi: ' + err.message, 'error');
    }
  }

  async function save() {
    if (!isDirty() || state.saving) return;
    state.saving = true;
    renderStatus();
    try {
      const json = await request('POST', { action: 'update', layout: state.draft });
      state.stored = json.stored !== false;
      state.saving = false;
      apply(json.layout);
      if (!state.stored) showNotification('Redis ulanmagan — o\'zgarish faqat vaqtincha saqlandi.', 'warning');
      else showNotification('Bosh sahifa saqlandi.');
    } catch (err) {
      state.saving = false;
      renderStatus();
      showNotification('Saqlashda xatolik: ' + err.message, 'error');
    }
  }

  function reset() {
    if (!state.saved) return;
    state.draft = clone(state.saved);
    renderAll();
  }

  /* ---------------- Bo'limlar ro'yxati ---------------- */
  function renderList() {
    const list = $('#homeLayoutList');
    list.innerHTML = state.draft.sections.map((item) => {
      const meta = META[item.id];
      return `
        <li class="hl-item${item.enabled ? '' : ' is-off'}" data-id="${esc(item.id)}">
          <button type="button" class="hl-item__handle" data-hl-handle aria-label="${esc(meta.label)}: tartibini o'zgartirish">${ICON_HANDLE}</button>
          <span class="hl-item__icon">${meta.icon}</span>
          <span class="hl-item__name">${esc(meta.label)}</span>
          <div class="segmented hl-item__size" role="group" aria-label="${esc(meta.label)} o'lchami">
            ${SIZES.map(([value, label]) => `<button type="button" class="segmented__btn${item.size === value ? ' is-active' : ''}" data-hl-size="${value}" aria-pressed="${item.size === value}">${label}</button>`).join('')}
          </div>
          <label class="fifa-tv-switch" title="${item.enabled ? 'Ko\'rinadi' : 'Yashirin'}">
            <input type="checkbox" data-hl-toggle ${item.enabled ? 'checked' : ''} aria-label="${esc(meta.label)} bosh sahifada ko'rinsin">
            <span></span>
          </label>
        </li>`;
    }).join('');
  }

  function sectionById(id) {
    return state.draft.sections.find((s) => s.id === id);
  }

  function readOrderFromDom() {
    const ids = [...$('#homeLayoutList').children].map((li) => li.dataset.id);
    state.draft.sections = ids.map(sectionById).filter(Boolean);
  }

  function moveItem(id, delta) {
    const list = state.draft.sections;
    const from = list.findIndex((s) => s.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    renderList();
    changed();
    $(`.hl-item[data-id="${id}"] [data-hl-handle]`)?.focus();
  }

  // Sichqoncha va barmoq uchun bitta yo'l: Pointer Events + ushlagichda touch-action: none.
  // Qator DOM ichida ko'chirilganda pointer capture yo'qolishi mumkin, shuning uchun
  // harakatni window darajasida tinglaymiz.
  function startDrag(handle, event) {
    const list = $('#homeLayoutList');
    const row = handle.closest('.hl-item');
    if (!row || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    row.classList.add('is-dragging');
    list.classList.add('is-sorting');
    const before = row.nextElementSibling;

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const y = ev.clientY;
      const next = [...list.children].find((li) => {
        if (li === row) return false;
        const box = li.getBoundingClientRect();
        return y < box.top + box.height / 2;
      });
      if (next) { if (next !== row.nextElementSibling) list.insertBefore(row, next); }
      else if (list.lastElementChild !== row) list.appendChild(row);
    };
    const onEnd = (ev) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      row.classList.remove('is-dragging');
      list.classList.remove('is-sorting');
      if (row.nextElementSibling !== before) {
        readOrderFromDom();
        tgHaptic('selection');
        changed();
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }

  /* ---------------- Hero va salom ---------------- */
  function renderHero() {
    const hero = state.draft.hero;
    const movie = heroMovie();
    $('#homeLayoutHeroMode').value = hero.mode;
    $('#homeLayoutPicker').hidden = hero.mode !== 'manual';
    const poster = $('#homeLayoutHeroPoster');
    poster.src = posterSrc(movie);
    poster.onerror = () => retryPoster(poster);
    $('#homeLayoutHeroName').textContent = movie
      ? movie.name
      : (hero.mode === 'manual' ? 'Kino tanlanmagan — qidiruvdan tanlang' : 'Kinolar hali yuklanmagan');
  }

  function renderPicker() {
    const box = $('#homeLayoutHeroResults');
    const q = $('#homeLayoutHeroSearch').value.trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }
    const found = adminMovies()
      .filter((m) => m.name.toLowerCase().includes(q) || String(m.code || '').toLowerCase().includes(q))
      .slice(0, 8);
    box.innerHTML = found.length
      ? found.map((m) => `
          <button type="button" class="hl-picker__item" data-hl-movie="${esc(m.id)}">
            <img src="${esc(posterSrc(m))}" alt="" onerror="retryPoster(this)">
            <span><b>${esc(m.name)}</b><small>${esc(m.code || m.year || '')}</small></span>
          </button>`).join('')
      : '<div class="hl-picker__empty">Hech narsa topilmadi</div>';
  }

  function greetingText() {
    return state.draft.greeting.replace(/\{ism\}/g, 'Jamshid');
  }

  /* ---------------- Jonli ko'rinish ---------------- */
  function renderPreview() {
    const box = $('#homeLayoutPreview');
    const greeting = $('#homeLayoutPreviewGreeting');
    greeting.textContent = greetingText();
    greeting.hidden = !state.draft.greeting;
    const visible = state.draft.sections.filter((s) => s.enabled);
    if (!visible.length) {
      box.innerHTML = '<div class="hl-bento__empty">Barcha bo\'limlar o\'chirilgan</div>';
      return;
    }
    const movie = heroMovie();
    box.innerHTML = visible.map((item) => {
      const meta = META[item.id];
      if (item.id === 'kino' && item.size !== 's') {
        return `
          <div class="hl-card hl-card--${item.size} hl-card--kino">
            <img class="hl-card__poster" src="${esc(posterSrc(movie))}" alt="" onerror="retryPoster(this)">
            <div class="hl-card__shade"></div>
            <div class="hl-card__text">
              <span class="hl-card__label">${esc(meta.label)}</span>
              <b>${esc(movie ? movie.name : 'Kino')}</b>
              <span class="hl-card__progress"><i></i></span>
            </div>
          </div>`;
      }
      return `
        <div class="hl-card hl-card--${item.size} hl-card--${esc(item.id)}">
          <span class="hl-card__icon">${meta.icon}</span>
          <span class="hl-card__text">
            <span class="hl-card__label">${esc(meta.label)}</span>
            <small>${esc(meta.note)}</small>
          </span>
          ${item.id === 'fifa' ? '<span class="hl-card__live">LIVE</span>' : ''}
        </div>`;
    }).join('');
  }

  function renderAll() {
    renderList();
    renderHero();
    $('#homeLayoutGreeting').value = state.draft.greeting;
    renderPreview();
    renderStatus();
  }

  /* ---------------- Hodisalar ---------------- */
  const list = $('#homeLayoutList');
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-hl-handle]');
    if (handle) startDrag(handle, e);
  });
  list.addEventListener('keydown', (e) => {
    const handle = e.target.closest('[data-hl-handle]');
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    moveItem(handle.closest('.hl-item').dataset.id, e.key === 'ArrowUp' ? -1 : 1);
  });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-hl-size]');
    if (!btn) return;
    const item = sectionById(btn.closest('.hl-item').dataset.id);
    if (!item || item.size === btn.dataset.hlSize) return;
    item.size = btn.dataset.hlSize;
    renderList();
    changed();
  });
  list.addEventListener('change', (e) => {
    if (!e.target.matches('[data-hl-toggle]')) return;
    const item = sectionById(e.target.closest('.hl-item').dataset.id);
    if (!item) return;
    item.enabled = e.target.checked;
    renderList();
    changed();
  });

  $('#homeLayoutHeroMode').addEventListener('change', (e) => {
    const mode = e.target.value;
    state.draft.hero = mode === 'manual'
      ? { mode, movieId: state.draft.hero.movieId || (heroMovie() || {}).id || '' }
      : { mode: 'auto', movieId: '' };
    renderHero();
    changed();
    if (mode === 'manual') $('#homeLayoutHeroSearch').focus();
  });
  $('#homeLayoutHeroSearch').addEventListener('input', debounce(renderPicker, 150));
  $('#homeLayoutHeroResults').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-hl-movie]');
    if (!btn) return;
    state.draft.hero = { mode: 'manual', movieId: btn.dataset.hlMovie };
    $('#homeLayoutHeroSearch').value = '';
    renderPicker();
    renderHero();
    changed();
  });
  $('#homeLayoutGreeting').addEventListener('input', (e) => {
    state.draft.greeting = e.target.value.slice(0, 80);
    changed();
  });

  section.querySelectorAll('[data-hl-scheme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('#homeLayoutPhone').dataset.scheme = btn.dataset.hlScheme;
      section.querySelectorAll('[data-hl-scheme]').forEach((b) => b.classList.toggle('is-active', b === btn));
    });
  });

  $('#homeLayoutSave').addEventListener('click', save);
  $('#homeLayoutReset').addEventListener('click', reset);
  window.addEventListener('beforeunload', (e) => {
    if (!isDirty()) return;
    e.preventDefault();
    e.returnValue = '';
  });

  window.homeLayoutAdmin = { load, isDirty };
})();

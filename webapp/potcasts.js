// Potkastlar moduli — lazy-load (app.js ichidagi ensurePotcastsModule orqali).
// Hozircha beta-placeholder: kontent qo'shilgani sari shu fayl ichida kengaytiriladi.
//
// Tashqariga: window.__potcasts = { openPodcastsView, closePodcastsView }
(function () {
  "use strict";

  const podcastsView = document.getElementById("podcastsView");
  const podcastsRoot = document.getElementById("podcastsRoot");

  let rendered = false;

  function renderPlaceholder() {
    if (rendered || !podcastsRoot) return;
    rendered = true;
    podcastsRoot.innerHTML = `
      <div class="podcasts-beta-notice">
        <span class="podcasts-beta-notice__text">Potkastlar bo'limi beta versiyada — tez orada audio epizodlar qo'shiladi</span>
      </div>
      <div class="podcasts-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="2" width="6" height="13" rx="3"></rect>
          <path d="M5 10v2a7 7 0 0 0 14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
        <h3>Potkastlar tayyorlanmoqda</h3>
        <p>Tez orada bu yerda eng sara potkastlar paydo bo'ladi.</p>
      </div>
    `;
  }

  function openPodcastsView() {
    if (!podcastsView) return;
    renderPlaceholder();
    podcastsView.hidden = false;
    document.body.classList.add("is-podcasts");
    document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closePodcastsView() {
    if (!podcastsView) return;
    podcastsView.hidden = true;
    document.body.classList.remove("is-podcasts");
  }

  window.__potcasts = { openPodcastsView, closePodcastsView };
})();

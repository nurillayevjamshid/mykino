// Podcast Bottom Sheet Player — YouTube IFrame API bilan
// Mini player + Full player + Speed control + Background audio
// Tashqariga: window.__podcastPlayer
(function () {
  "use strict";

  const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const SEEK_STEP = 15; // soniya

  // ===== DOM refs =====
  const podMini = document.getElementById("podMini");
  const podMiniArt = document.getElementById("podMiniArt");
  const podMiniTitle = document.getElementById("podMiniTitle");
  const podMiniChannel = document.getElementById("podMiniChannel");
  const podMiniToggle = document.getElementById("podMiniToggle");
  const podMiniExpand = document.getElementById("podMiniExpand");
  const podMiniClose = document.getElementById("podMiniClose");
  const podMiniBarFill = document.getElementById("podMiniBarFill");

  const podFull = document.getElementById("podFull");
  const podFullBackdrop = document.getElementById("podFullBackdrop");
  const podFullSheet = document.getElementById("podFullSheet");
  const podFullClose = document.getElementById("podFullClose");
  const podFullChannel = document.getElementById("podFullChannel");
  const podFullArtImg = document.getElementById("podFullArtImg");
  const podFullTitle = document.getElementById("podFullTitle");
  const podFullMeta = document.getElementById("podFullMeta");
  const podFullCur = document.getElementById("podFullCur");
  const podFullDur = document.getElementById("podFullDur");
  const podFullBar = document.getElementById("podFullBar");
  const podFullBarFill = document.getElementById("podFullBarFill");
  const podFullBarThumb = document.getElementById("podFullBarThumb");
  const podFullToggle = document.getElementById("podFullToggle");
  const podSpeedBtn = document.getElementById("podSpeedBtn");
  const podSpeedSheet = document.getElementById("podSpeedSheet");
  const podSpeedBackdrop = document.getElementById("podSpeedBackdrop");
  const podSpeedOpts = document.getElementById("podSpeedOpts");
  const podRewindBtn = document.getElementById("podRewindBtn");
  const podForwardBtn = document.getElementById("podForwardBtn");

  // ===== State =====
  let ytPlayer = null;
  let ytReady = false;
  let ytPendingId = null;
  let isPlaying = false;
  let currentSpeed = 1;
  let currentVideoId = "";
  let currentTitle = "";
  let currentChannel = "";
  let currentThumb = "";
  let duration = 0;
  let progressTimer = null;
  let isFullOpen = false;
  let seekDragging = false;

  // ===== YouTube IFrame API =====
  function ensureYtApi() {
    if (window.YT?.Player) return Promise.resolve();
    return new Promise((resolve) => {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = resolve;
    });
  }

  function initYtPlayer() {
    if (ytPlayer || !window.YT?.Player) return;
    ytPlayer = new YT.Player("podYtPlayer", {
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        origin: location.origin,
      },
      events: {
        onReady: () => {
          ytReady = true;
          if (ytPendingId) {
            ytPlayer.loadVideoById(ytPendingId);
            ytPendingId = null;
          }
        },
        onStateChange: (e) => {
          const S = YT.PlayerState;
          if (e.data === S.PLAYING) {
            isPlaying = true;
            updatePlayButtons();
            startProgress();
          } else if (e.data === S.PAUSED) {
            isPlaying = false;
            updatePlayButtons();
            stopProgress();
          } else if (e.data === S.ENDED) {
            isPlaying = false;
            updatePlayButtons();
            stopProgress();
          }
        },
        onPlaybackRateChange: (e) => {
          const rate = Number(e.data || 1);
          if (SPEED_OPTIONS.includes(rate)) {
            currentSpeed = rate;
            updateSpeedUI();
          }
        },
      },
    });
  }

  // ===== Format helpers =====
  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(Number(sec || 0)));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    return `${m}:${String(ss).padStart(2, "0")}`;
  }

  // ===== UI updates =====
  function updatePlayButtons() {
    const state = isPlaying ? "pause" : "play";
    if (podMiniToggle) podMiniToggle.dataset.state = state;
    if (podFullToggle) podFullToggle.dataset.state = state;
  }

  function updateSpeedUI() {
    if (podSpeedBtn) podSpeedBtn.textContent = currentSpeed === 1 ? "1x" : currentSpeed + "x";
    if (podSpeedOpts) {
      podSpeedOpts.querySelectorAll(".pod-speed-opt").forEach((btn) => {
        btn.classList.toggle("is-active", Number(btn.dataset.speed) === currentSpeed);
      });
    }
  }

  function updateProgress() {
    if (!ytReady || seekDragging) return;
    try {
      const cur = Number(ytPlayer.getCurrentTime?.() || 0);
      const dur = Number(ytPlayer.getDuration?.() || 0);
      duration = dur;
      const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
      if (podMiniBarFill) podMiniBarFill.style.width = pct + "%";
      if (podFullBarFill) podFullBarFill.style.width = pct + "%";
      if (podFullBarThumb) podFullBarThumb.style.left = pct + "%";
      if (podFullCur) podFullCur.textContent = fmtTime(cur);
      if (podFullDur) podFullDur.textContent = fmtTime(dur);
    } catch (_) {}
  }

  function startProgress() {
    stopProgress();
    progressTimer = setInterval(updateProgress, 250);
  }

  function stopProgress() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  // ===== Mini player =====
  function showMini() {
    if (!podMini) return;
    podMini.setAttribute("aria-hidden", "false");
  }

  function hideMini() {
    if (!podMini) return;
    podMini.setAttribute("aria-hidden", "true");
  }

  // ===== Full player =====
  function openFull() {
    if (!podFull) return;
    isFullOpen = true;
    podFull.setAttribute("aria-hidden", "false");
    // Videoni ko'rsatish
    if (podFullArtImg && currentThumb) {
      podFullArtImg.src = currentThumb;
      podFullArtImg.classList.add("is-visible");
    }
  }

  function closeFull() {
    if (!podFull) return;
    isFullOpen = false;
    podFull.setAttribute("aria-hidden", "true");
  }

  // ===== Speed sheet =====
  function openSpeedSheet() {
    if (!podSpeedSheet) return;
    podSpeedSheet.setAttribute("aria-hidden", "false");
  }

  function closeSpeedSheet() {
    if (!podSpeedSheet) return;
    podSpeedSheet.setAttribute("aria-hidden", "true");
  }

  function setSpeed(rate) {
    currentSpeed = rate;
    try {
      if (ytReady && ytPlayer?.setPlaybackRate) ytPlayer.setPlaybackRate(rate);
    } catch (_) {}
    updateSpeedUI();
    closeSpeedSheet();
  }

  // ===== Core play =====
  function playVideo(videoId, opts = {}) {
    if (!videoId) return;
    currentVideoId = videoId;
    currentTitle = opts.title || "";
    currentChannel = opts.channel || "";
    currentThumb = opts.thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // UI yangilash
    if (podMiniTitle) podMiniTitle.textContent = currentTitle;
    if (podMiniChannel) podMiniChannel.textContent = currentChannel;
    if (podMiniArt) podMiniArt.src = currentThumb;
    if (podFullTitle) podFullTitle.textContent = currentTitle;
    if (podFullChannel) podFullChannel.textContent = currentChannel;
    if (podFullMeta) podFullMeta.textContent = currentChannel;

    // Progress reset
    if (podMiniBarFill) podMiniBarFill.style.width = "0%";
    if (podFullBarFill) podFullBarFill.style.width = "0%";
    if (podFullCur) podFullCur.textContent = "0:00";
    if (podFullDur) podFullDur.textContent = "0:00";

    showMini();
    updatePlayButtons();

    // YouTube player
    if (ytReady && ytPlayer?.loadVideoById) {
      try {
        ytPlayer.loadVideoById(videoId);
        ytPlayer.playVideo();
      } catch (_) {}
    } else {
      ytPendingId = videoId;
      ensureYtApi().then(() => initYtPlayer()).catch(() => {});
    }
  }

  function togglePlay() {
    if (!ytReady) return;
    try {
      if (isPlaying) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    } catch (_) {}
  }

  function seekBy(seconds) {
    if (!ytReady) return;
    try {
      const cur = Number(ytPlayer.getCurrentTime?.() || 0);
      ytPlayer.seekTo(Math.max(0, cur + seconds), true);
      updateProgress();
    } catch (_) {}
  }

  function seekToPercent(pct) {
    if (!ytReady || !duration) return;
    try {
      ytPlayer.seekTo((pct / 100) * duration, true);
      updateProgress();
    } catch (_) {}
  }

  function stop() {
    try {
      if (ytReady && ytPlayer?.stopVideo) ytPlayer.stopVideo();
    } catch (_) {}
    stopProgress();
    isPlaying = false;
    updatePlayButtons();
    hideMini();
    closeFull();
    currentVideoId = "";
  }

  // ===== Event wiring =====
  // Mini player
  podMiniExpand?.addEventListener("click", openFull);
  podMiniToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePlay();
  });
  podMiniClose?.addEventListener("click", (e) => {
    e.stopPropagation();
    stop();
  });

  // Full player
  podFullClose?.addEventListener("click", closeFull);
  podFullBackdrop?.addEventListener("click", closeFull);
  podFullToggle?.addEventListener("click", togglePlay);
  podRewindBtn?.addEventListener("click", () => seekBy(-SEEK_STEP));
  podForwardBtn?.addEventListener("click", () => seekBy(SEEK_STEP));

  // Speed
  podSpeedBtn?.addEventListener("click", openSpeedSheet);
  podSpeedBackdrop?.addEventListener("click", closeSpeedSheet);
  podSpeedOpts?.addEventListener("click", (e) => {
    const btn = e.target.closest(".pod-speed-opt");
    if (btn) setSpeed(Number(btn.dataset.speed));
  });

  // Progress bar seek
  function handleBarSeek(e) {
    if (!podFullBar) return;
    const rect = podFullBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    seekToPercent(pct);
  }

  podFullBar?.addEventListener("mousedown", (e) => {
    seekDragging = true;
    handleBarSeek(e);
  });
  podFullBar?.addEventListener("touchstart", (e) => {
    seekDragging = true;
    handleBarSeek(e.touches[0]);
  }, { passive: true });
  document.addEventListener("mousemove", (e) => {
    if (seekDragging) handleBarSeek(e);
  });
  document.addEventListener("touchmove", (e) => {
    if (seekDragging) handleBarSeek(e.touches[0]);
  }, { passive: true });
  document.addEventListener("mouseup", () => { seekDragging = false; });
  document.addEventListener("touchend", () => { seekDragging = false; });

  // Swipe down to close full player
  let sheetStartY = 0;
  let sheetDeltaY = 0;
  let sheetDragging = false;
  podFullSheet?.addEventListener("touchstart", (e) => {
    if (e.target.closest("input[type=range]") || e.target.closest(".pod-full__bar")) return;
    sheetStartY = e.touches[0].clientY;
    sheetDeltaY = 0;
    sheetDragging = true;
  }, { passive: true });
  podFullSheet?.addEventListener("touchmove", (e) => {
    if (!sheetDragging) return;
    sheetDeltaY = e.touches[0].clientY - sheetStartY;
    if (sheetDeltaY > 0) {
      podFullSheet.style.transform = `translateY(${sheetDeltaY}px)`;
    }
  }, { passive: true });
  podFullSheet?.addEventListener("touchend", () => {
    if (!sheetDragging) return;
    sheetDragging = false;
    if (sheetDeltaY > 120) {
      closeFull();
    }
    podFullSheet.style.transform = "";
  });

  // Keyboard (desktop)
  document.addEventListener("keydown", (e) => {
    if (!isFullOpen) return;
    if (e.key === " ") { e.preventDefault(); togglePlay(); }
    if (e.key === "ArrowLeft") seekBy(-SEEK_STEP);
    if (e.key === "ArrowRight") seekBy(SEEK_STEP);
    if (e.key === "Escape") closeFull();
  });

  // ===== Public API =====
  window.__podcastPlayer = {
    play: playVideo,
    stop,
    togglePlay,
    isOpen: () => !!currentVideoId,
    isPlaying: () => isPlaying,
  };
})();

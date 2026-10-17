// YouTube Queue & Fault-Tolerance Helper
// Prevents Node.js event loop / main thread blocking when importing large channels (50+ videos)
// Provides retry, backoff, and graceful skipping of blocked/restricted videos without crashing.

/**
 * Asosiy server oqimi (Event Loop) qotib qolmasligi uchun boshqaruvni beradi.
 * @param {number} ms - Kutish vaqti millisekundlarda (0 = setImmediate)
 */
function yieldToEventLoop(ms = 0) {
  return new Promise((resolve) => {
    if (ms > 0) {
      setTimeout(resolve, ms);
    } else if (typeof setImmediate === "function") {
      setImmediate(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Xatoliklarga chidamli (retry + backoff) so'rov ijrochisi.
 */
async function fetchWithRetry(fn, options = {}) {
  const {
    maxRetries = 2,
    delayMs = 500,
    backoff = 2,
    shouldRetry = (err) => {
      const code = err.statusCode || (err.status ? Number(err.status) : 0);
      return code === 429 || code >= 500 || /fetch failed|timeout|econnreset|etimedout/i.test(err.message || "");
    },
  } = options;

  let attempt = 0;
  let currentDelay = delayMs;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries || !shouldRetry(err)) {
        throw err;
      }
      await yieldToEventLoop(currentDelay);
      currentDelay *= backoff;
    }
  }
}

/**
 * YouTube playlist items (videolar ro'yxati)ni navbat bilan sahifalab olish.
 */
async function fetchPlaylistItemsQueue({ uploadsPlaylistId, ytFetch, maxResults = 200, pageSize = 50 }) {
  if (!uploadsPlaylistId) return [];
  const allItems = [];
  let pageToken = "";

  while (allItems.length < maxResults) {
    const batchSize = Math.min(pageSize, maxResults - allItems.length);
    const params = {
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: batchSize,
    };
    if (pageToken) params.pageToken = pageToken;

    let pl = null;
    try {
      pl = await fetchWithRetry(() => ytFetch("playlistItems", params), { maxRetries: 2, delayMs: 400 });
    } catch (err) {
      console.warn(`[YouTube Queue] playlistItems sahifasini olishda xatolik: ${err.message}. Mavjud ${allItems.length} ta element bilan davom etiladi.`);
      break;
    }

    const items = pl?.items || [];
    allItems.push(...items);
    pageToken = pl?.nextPageToken || "";
    if (!pageToken || !items.length) break;

    // Asosiy oqim boshqa HTTP so'rovlarga zudlik bilan javob berishi uchun pauza
    await yieldToEventLoop(15);
  }

  return allItems;
}

/**
 * Video ID'larini 50 talik partiyalarga bo'lib navbat bilan yuklash.
 * Agar biror partiyada yoki bitta videoda xatolik / blok chiqsa,
 * butun dastur to'xtab qolmaydi, faqat o'sha video o'tkazib yuboriladi.
 */
async function hydrateVideosQueue({
  videoIds,
  ytFetch,
  batchSize = 50,
  itemFormatter,
  onProgress,
  parts = "contentDetails,snippet,statistics,status",
}) {
  if (!Array.isArray(videoIds) || !videoIds.length) return [];
  const validVideos = [];
  const total = videoIds.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);

    // Event loop'ga navbat berish
    await yieldToEventLoop(20);

    let batchItems = [];
    try {
      // 1. Avval butun partiyani bir so'rovda olishga urinib ko'ramiz
      const vresp = await fetchWithRetry(
        () => ytFetch("videos", { part: parts, id: batch.join(","), maxResults: batch.length }),
        { maxRetries: 2, delayMs: 500 }
      );
      batchItems = vresp?.items || [];
    } catch (batchErr) {
      console.warn(`[YouTube Queue] Partiyada xatolik (${batchErr.message}). ${batch.length} ta video alohida izolyatsiyada tekshirilmoqda...`);
      // 2. Agar butun partiya xato bersa (masalan, bloklangan video yoki 400/403 bo'lsa),
      // har bir videoni alohida try-catch bilan o'tkazamiz!
      for (const singleId of batch) {
        await yieldToEventLoop(10);
        try {
          const singleResp = await fetchWithRetry(
            () => ytFetch("videos", { part: parts, id: singleId, maxResults: 1 }),
            { maxRetries: 1, delayMs: 300 }
          );
          if (singleResp?.items?.[0]) {
            batchItems.push(singleResp.items[0]);
          }
        } catch (singleErr) {
          // Bloklangan, o'chirilgan yoki xato video o'tkazib yuboriladi, dastur qotmaydi va to'xtamaydi
          console.warn(`[YouTube Queue] Video o'tkazib yuborildi (ID: ${singleId}): ${singleErr.message}`);
        }
      }
    }

    // Videolarni formatlash va filtrdan o'tkazish
    for (const v of batchItems) {
      try {
        if (!v || !v.id) continue;
        const st = v.status || {};
        if (st.privacyStatus === "private" || st.uploadStatus === "rejected") {
          continue;
        }
        if (typeof itemFormatter === "function") {
          const formatted = itemFormatter(v);
          if (formatted) validVideos.push(formatted);
        } else {
          validVideos.push(v);
        }
      } catch (itemErr) {
        console.warn(`[YouTube Queue] Video formatlashda xatolik (${v?.id}): ${itemErr.message}`);
      }
    }

    if (typeof onProgress === "function") {
      try {
        await onProgress(validVideos.length, total);
      } catch (_) {}
    }
  }

  return validVideos;
}

module.exports = {
  yieldToEventLoop,
  fetchWithRetry,
  fetchPlaylistItemsQueue,
  hydrateVideosQueue,
};

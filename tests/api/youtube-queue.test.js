const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  yieldToEventLoop,
  fetchWithRetry,
  fetchPlaylistItemsQueue,
  hydrateVideosQueue,
} = require("../../api/_lib/youtube-queue");

describe("YouTube Queue & Fault Tolerance", () => {
  test("yieldToEventLoop unblocks event loop and resolves", async () => {
    let resolved = false;
    const promise = yieldToEventLoop(5).then(() => {
      resolved = true;
    });
    assert.equal(resolved, false);
    await promise;
    assert.equal(resolved, true);
  });

  test("fetchWithRetry retries transient errors (500, 429) and succeeds", async () => {
    let attempts = 0;
    const result = await fetchWithRetry(async () => {
      attempts++;
      if (attempts < 3) {
        const err = new Error("YouTube API 503: Backend Error");
        err.statusCode = 503;
        throw err;
      }
      return { ok: true, data: "success" };
    }, { maxRetries: 3, delayMs: 10, backoff: 1 });

    assert.equal(attempts, 3);
    assert.equal(result.data, "success");
  });

  test("fetchWithRetry throws when maxRetries is exceeded", async () => {
    let attempts = 0;
    await assert.rejects(async () => {
      await fetchWithRetry(async () => {
        attempts++;
        const err = new Error("YouTube API 500: Internal Server Error");
        err.statusCode = 500;
        throw err;
      }, { maxRetries: 2, delayMs: 10, backoff: 1 });
    }, /YouTube API 500/);

    assert.equal(attempts, 3); // initial attempt + 2 retries
  });

  test("hydrateVideosQueue handles 50 tracks smoothly in batches", async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `vid_${i + 1}`);
    let batchCallCount = 0;

    const mockYtFetch = async (endpoint, params) => {
      if (endpoint === "videos") {
        batchCallCount++;
        const requestedIds = params.id.split(",");
        return {
          items: requestedIds.map((id) => ({
            id,
            snippet: { title: `Track ${id}`, thumbnails: {} },
            contentDetails: { duration: "PT3M30S" },
            status: { privacyStatus: "public", uploadStatus: "processed" },
          })),
        };
      }
      return { items: [] };
    };

    const progressUpdates = [];
    const videos = await hydrateVideosQueue({
      videoIds: ids,
      ytFetch: mockYtFetch,
      batchSize: 50,
      itemFormatter: (v) => ({ videoId: v.id, title: v.snippet.title }),
      onProgress: (count, total) => progressUpdates.push({ count, total }),
    });

    assert.equal(videos.length, 50);
    assert.equal(batchCallCount, 1); // 1 single batch call for 50 tracks
    assert.equal(progressUpdates.length, 1);
    assert.equal(progressUpdates[0].count, 50);
    assert.equal(progressUpdates[0].total, 50);
  });

  test("Fault tolerance: if a batch fails (e.g., blocked/restricted video), it skips the bad video and imports remaining 49 tracks", async () => {
    // 50 ta video ID: vid_1 dan vid_50 gacha
    // vid_13 bloklangan / xato chiqaradigan video
    const ids = Array.from({ length: 50 }, (_, i) => `vid_${i + 1}`);
    const blockedId = "vid_13";

    const mockYtFetch = async (endpoint, params) => {
      if (endpoint === "videos") {
        const requestedIds = params.id.split(",");
        // Agar partiyada bloklangan video bo'lsa yoki partiya so'rovi bo'lsa, YouTube 400/403 xato beradi
        if (requestedIds.length > 1 && requestedIds.includes(blockedId)) {
          const err = new Error(`YouTube API 400: Bad Request or Restricted Video`);
          err.statusCode = 400;
          throw err;
        }

        // Alohida so'ralganda
        if (requestedIds.length === 1) {
          const singleId = requestedIds[0];
          if (singleId === blockedId) {
            const err = new Error(`YouTube API 403: Video ${singleId} is blocked by copyright / geo-restricted`);
            err.statusCode = 403;
            throw err;
          }
          return {
            items: [{
              id: singleId,
              snippet: { title: `Track ${singleId}`, thumbnails: {} },
              contentDetails: { duration: "PT3M15S" },
              status: { privacyStatus: "public", uploadStatus: "processed" },
            }],
          };
        }

        return {
          items: requestedIds.map((id) => ({
            id,
            snippet: { title: `Track ${id}`, thumbnails: {} },
            contentDetails: { duration: "PT3M15S" },
            status: { privacyStatus: "public", uploadStatus: "processed" },
          })),
        };
      }
      return { items: [] };
    };

    // hydrateVideosQueue dasturni crash qilmasdan, xato videoni o'tkazib yuborishi kerak
    const videos = await hydrateVideosQueue({
      videoIds: ids,
      ytFetch: mockYtFetch,
      batchSize: 50,
      itemFormatter: (v) => ({ videoId: v.id, title: v.snippet.title }),
    });

    // 50 tadan bitta bloklangani tashlandi, 49 tasi muvaffaqiyatli saqlandi!
    assert.equal(videos.length, 49);
    assert.equal(videos.some((v) => v.videoId === blockedId), false);
    assert.equal(videos.some((v) => v.videoId === "vid_1"), true);
    assert.equal(videos.some((v) => v.videoId === "vid_50"), true);
  });

  test("Skips private, rejected, and invalid duration tracks", async () => {
    const ids = ["vid_normal", "vid_private", "vid_rejected", "vid_too_short", "vid_too_long"];

    const mockYtFetch = async (endpoint, params) => {
      return {
        items: [
          {
            id: "vid_normal",
            snippet: { title: "Good Track" },
            contentDetails: { duration: "PT3M00S" }, // 180s (valid)
            status: { privacyStatus: "public", uploadStatus: "processed" },
          },
          {
            id: "vid_private",
            snippet: { title: "Private Track" },
            contentDetails: { duration: "PT3M00S" },
            status: { privacyStatus: "private", uploadStatus: "processed" },
          },
          {
            id: "vid_rejected",
            snippet: { title: "Rejected Track" },
            contentDetails: { duration: "PT3M00S" },
            status: { privacyStatus: "public", uploadStatus: "rejected" },
          },
          {
            id: "vid_too_short",
            snippet: { title: "Short Track" },
            contentDetails: { duration: "PT0M30S" }, // 30s (too short)
            status: { privacyStatus: "public", uploadStatus: "processed" },
          },
        ],
      };
    };

    const videos = await hydrateVideosQueue({
      videoIds: ids,
      ytFetch: mockYtFetch,
      batchSize: 50,
      itemFormatter: (v) => {
        // Musiqa filtri
        const m = /^PT(?:(\d+)M)?(?:(\d+)S)?$/.exec(v.contentDetails?.duration || "");
        const dur = (Number(m?.[1] || 0) * 60) + Number(m?.[2] || 0);
        if (dur < 90 || dur > 300) return null;
        return { videoId: v.id, title: v.snippet.title };
      },
    });

    assert.equal(videos.length, 1);
    assert.equal(videos[0].videoId, "vid_normal");
  });
});

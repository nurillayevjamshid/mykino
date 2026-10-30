// API endpoint: /api/news
// Serves parsed and cached news feed from Telegram channel @tezkorofficial_uz.

const { setCorsHeaders, isAdminAuthorized } = require("./_lib/auth");
const { getNews, ingestWebhookPost, CHANNEL_USERNAME } = require("./_lib/news-service");

module.exports = async function handler(request, response) {
  setCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  const query = request.query || {};

  // POST endpoint: ingest webhook post or refresh cache
  if (request.method === "POST") {
    // Lentaga post qo'shish va keshni majburan yangilash faqat admin uchun —
    // aks holda har kim yangiliklarga soxta post (va zararli HTML) qo'sha olardi.
    if (!isAdminAuthorized(request)) {
      response.status(401).json({ ok: false, error: "Avtorizatsiya talab qilinadi." });
      return;
    }
    try {
      let body = {};
      if (request.body && typeof request.body === "object") {
        body = request.body;
      } else {
        let raw = "";
        for await (const chunk of request) raw += chunk;
        body = raw ? JSON.parse(raw) : {};
      }

      if (body.channelPost) {
        const post = ingestWebhookPost(body.channelPost);
        response.status(200).json({ ok: true, post });
        return;
      }

      if (body.refresh) {
        const result = await getNews({ force: true, limit: 20 });
        response.status(200).json({ ok: true, message: "Yangiliklar yangilandi", count: result.posts.length });
        return;
      }

      response.status(400).json({ ok: false, error: "Noma'lum harakat" });
      return;
    } catch (err) {
      console.error("POST /api/news error:", err);
      response.status(500).json({ ok: false, error: err.message });
      return;
    }
  }

  // GET endpoint
  if (request.method === "GET") {
    try {
      const before = query.before ? parseInt(query.before, 10) : null;
      const limit = query.limit ? parseInt(query.limit, 10) : 15;
      const q = String(query.q || "").trim();
      const category = String(query.category || "").trim();
      const id = query.id ? parseInt(query.id, 10) : null;
      const force = query.force === "1" || query.refresh === "1" || query.force === "true";

      const data = await getNews({
        before,
        limit,
        q,
        category,
        id,
        force,
      });

      // HTTP Cache headers
      response.setHeader(
        "Cache-Control",
        before
          ? "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400"
          : "public, max-age=30, s-maxage=60, stale-while-revalidate=180"
      );
      if (data.totalCount !== undefined) {
        response.setHeader("X-Total-Count", String(data.totalCount));
      }

      response.status(200).json(data);
      return;
    } catch (err) {
      console.error("GET /api/news error:", err);
      response.status(500).json({
        ok: false,
        error: "Yangiliklarni yuklab bo'lmadi. Qayta urinib ko'ring.",
        details: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
      return;
    }
  }

  response.status(405).json({ ok: false, error: "Faqat GET yoki POST so'rovlari qabul qilinadi" });
};

const { setCors, trackUserVisit } = require("../_lib/google-drive");

async function readJsonBody(request) {
  if (typeof request.body === "object" && request.body !== null) {
    return request.body;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

module.exports = async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat POST ishlaydi." });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const user = payload?.user || payload;
    const result = await trackUserVisit(user);
    response.status(200).json({ ok: true, ...result });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "TRACK_USER_FAILED",
      error: error.message || "Foydalanuvchini kuzatib bo'lmadi.",
    });
  }
};

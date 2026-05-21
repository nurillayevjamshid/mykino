const { listDriveSeries, setCors } = require("./_lib/google-drive");

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET ishlaydi." });
    return;
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    const series = await listDriveSeries();
    response.status(200).json(series);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "SERIES_LOAD_FAILED",
      error: error.message || "Seriallar yuklanmadi.",
    });
  }
};

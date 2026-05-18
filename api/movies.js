const { listDriveMovies, setCors } = require("./_lib/google-drive");
const crypto = require("crypto");





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
    let movies = [];
    try {
      movies = await listDriveMovies();
    } catch (driveError) {
      console.error("Google Drive error, falling back to local JSON:", driveError.message);
      const fs = require("fs");
      const path = require("path");
      const localPath = path.join(process.cwd(), "data", "movies.json");
      if (fs.existsSync(localPath)) {
        const rawData = fs.readFileSync(localPath, "utf8");
        movies = JSON.parse(rawData);
      } else {
        throw driveError;
      }
    }
    response.status(200).json(movies);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "MOVIES_LOAD_FAILED",
      error: error.message || "Katalog yuklanmadi.",
    });
  }
};

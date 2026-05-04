const { setCors } = require("./_lib/google-drive");
const fs = require("fs");
const path = require("path");

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
    // Path to users.json file
    const usersPath = path.join(process.cwd(), "data", "users.json");

    // Check if file exists
    if (!fs.existsSync(usersPath)) {
      response.status(200).json([]);
      return;
    }

    // Read and parse users.json
    const data = fs.readFileSync(usersPath, "utf-8");
    let users = [];

    try {
      const parsed = JSON.parse(data);
      // Handle both array and object formats
      if (Array.isArray(parsed)) {
        users = parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        users = Object.values(parsed);
      }
    } catch (parseError) {
      console.error("Error parsing users.json:", parseError);
      response.status(200).json([]);
      return;
    }

    // Normalize user data for the admin panel
    const normalizedUsers = users.map(user => ({
      id: user.telegram_id || user.id || user.user_id || 0,
      telegram_id: user.telegram_id || user.id || user.user_id || 0,
      username: user.username || "",
      firstName: user.first_name || user.firstName || "",
      lastName: user.last_name || user.lastName || "",
      phone: user.phone || "",
      firstSeenAt: user.started_at || user.firstSeenAt || user.first_seen_at || null,
      started_at: user.started_at || null,
      watchedMovies: user.watchedMovies || user.watched_movies || [],
    }));

    response.status(200).json(normalizedUsers);
  } catch (error) {
    console.error("Error reading users:", error);
    response.status(500).json({
      ok: false,
      code: "USERS_READ_FAILED",
      error: error.message || "Foydalanuvchilarni o'qishda xatolik.",
    });
  }
};

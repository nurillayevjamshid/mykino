const { ensureAdmin } = require("../_lib/admin-auth");
const { listDriveMovies, readCatalogMetadata, readUserStats, setCors } = require("../_lib/google-drive");

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

  if (!ensureAdmin(request, response)) {
    return;
  }

  try {
    const [movies, metadataState, statsState] = await Promise.all([
      listDriveMovies(),
      readCatalogMetadata(),
      readUserStats(),
    ]);

    const users = statsState.data?.users && typeof statsState.data.users === "object" ? statsState.data.users : {};
    const metadataMovies =
      metadataState.data?.movies && typeof metadataState.data.movies === "object" ? metadataState.data.movies : {};
    const editedMovieCount = Math.max(
      Object.keys(metadataMovies).length,
      movies.filter((movie) => movie?.hasCustomMetadata).length,
    );

    response.status(200).json({
      ok: true,
      stats: {
        botUsers: Object.keys(users).length,
        movies: movies.length,
        editedMovies: editedMovieCount,
        updatedAt: statsState.data?.updatedAt || metadataState.data?.updatedAt || "",
      },
      movies,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "ADMIN_DASHBOARD_FAILED",
      error: error.message || "Admin dashboard yuklanmadi.",
    });
  }
};

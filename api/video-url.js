const { getFileId, getTelegramFile, setCors } = require("./telegram-file");

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  try {
    const fileId = getFileId(request, "video-url");
    const telegramFile = await getTelegramFile(fileId);
    response.status(200).json({
      ok: true,
      videoUrl: `/api/video-stream/${encodeURIComponent(fileId)}`,
      filePath: telegramFile.filePath,
      fileSize: telegramFile.fileSize,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "VIDEO_URL_FAILED",
      error: error.message || "Video URL olishda xatolik.",
    });
  }
};

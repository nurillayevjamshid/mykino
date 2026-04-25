function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
}

function getBotToken() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    const error = new Error("BOT_TOKEN serverda sozlanmagan.");
    error.statusCode = 500;
    throw error;
  }
  return token;
}

function getFileId(request, routeName) {
  const url = new URL(request.url || "/", "http://localhost");
  const fromQuery = url.searchParams.get("fileId");
  if (fromQuery) return decodeURIComponent(fromQuery);

  const marker = `/api/${routeName}/`;
  const index = url.pathname.indexOf(marker);
  if (index === -1) return "";
  return decodeURIComponent(url.pathname.slice(index + marker.length));
}

async function getTelegramFile(fileId) {
  if (!fileId) {
    const error = new Error("fileId berilmagan.");
    error.statusCode = 400;
    throw error;
  }

  const token = getBotToken();
  const apiUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`;
  const apiResponse = await fetch(apiUrl);
  const payload = await apiResponse.json().catch(() => null);

  if (!apiResponse.ok || !payload?.ok || !payload.result?.file_path) {
    const description = payload?.description || "Telegram getFile xatolik qaytardi.";
    const isTooBig = /file is too big/i.test(description);
    const error = new Error(
      isTooBig
        ? "Telegram Bot API katta fayl uchun browser video URL bermadi."
        : description,
    );
    error.statusCode = isTooBig ? 413 : apiResponse.ok ? 502 : apiResponse.status;
    error.code = isTooBig ? "TELEGRAM_FILE_TOO_BIG" : "TELEGRAM_GET_FILE_FAILED";
    throw error;
  }

  return {
    filePath: payload.result.file_path,
    fileSize: payload.result.file_size || null,
    downloadUrl: `https://api.telegram.org/file/bot${token}/${payload.result.file_path}`,
  };
}

module.exports = {
  getFileId,
  getTelegramFile,
  setCors,
};

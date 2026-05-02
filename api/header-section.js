/**
 * Header Section - Alohida storage bilan ishlash
 * Rasmlar Google Drive'ga fayl sifatida yuklanadi, DB'da faqat file ID saqlanadi
 */

const crypto = require("crypto");
const { setCors } = require("./_lib/google-drive");

const HEADER_METADATA_FILE_NAME = ".my-kino-headers.json";
const HEADER_IMAGES_FOLDER_NAME = "header-images";

let accessTokenCache = {
  value: "",
  expiresAt: 0,
};

function getEnv(name) {
  return String(process.env[name] || "").trim();
}

function readServiceAccountCredentials() {
  const rawBase64 = getEnv("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64");
  const rawJson = getEnv("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON");

  if (rawBase64) {
    return JSON.parse(Buffer.from(rawBase64, "base64").toString("utf8"));
  }

  if (rawJson) {
    return JSON.parse(rawJson);
  }

  return {
    client_email: getEnv("GOOGLE_DRIVE_CLIENT_EMAIL"),
    private_key: getEnv("GOOGLE_DRIVE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    token_uri: getEnv("GOOGLE_DRIVE_TOKEN_URI") || "https://oauth2.googleapis.com/token",
  };
}

async function getAccessToken() {
  const now = Date.now();
  if (accessTokenCache.value && accessTokenCache.expiresAt > now + 60000) {
    return accessTokenCache.value;
  }

  const credentials = readServiceAccountCredentials();
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + 3600;
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
    exp: expiresAt,
    iat: issuedAt,
  };

  const base64UrlEncode = (input) => {
    return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(credentials.private_key, "base64");
  const jwt = `${unsigned}.${signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;

  const tokenResponse = await fetch(credentials.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json().catch(() => null);
  if (!tokenData?.access_token) {
    throw new Error("Failed to get access token");
  }

  accessTokenCache = {
    value: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600) * 1000,
  };

  return tokenData.access_token;
}

async function authorizedFetch(url, options = {}) {
  const token = await getAccessToken();
  return fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body,
  });
}

// Header rasmlari uchun alohida folder yaratish yoki topish
async function getOrCreateHeaderImagesFolder(parentFolderId) {
  // Avval mavjud folder ni qidirish
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${parentFolderId}'+in+parents+and+name='${HEADER_IMAGES_FOLDER_NAME}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const searchResponse = await authorizedFetch(searchUrl);
  const searchData = await searchResponse.json().catch(() => ({ files: [] }));

  if (searchData.files?.[0]) {
    return searchData.files[0].id;
  }

  // Folder yaratish
  const createUrl = "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true";
  const createResponse = await authorizedFetch(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: HEADER_IMAGES_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    }),
  });

  const folder = await createResponse.json().catch(() => null);
  if (!folder?.id) {
    throw new Error("Failed to create header images folder");
  }

  return folder.id;
}

// Base64 rasmni Vercel Blob'ga yuklash
async function uploadHeaderImage(base64Data, movieId) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Vercel Blob Storage tokeni (BLOB_READ_WRITE_TOKEN) topilmadi.");
  }

  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Content, "base64");
  const mimeMatch = base64Data.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const extension = mimeType === "image/png" ? "png" : "jpg";

  const fileName = `header-${movieId.slice(0, 8)}-${Date.now()}.${extension}`;

  const uploadResponse = await fetch(`https://blob.vercel-storage.com/${fileName}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "x-api-version": "7",
      "Content-Type": mimeType,
    },
    body: buffer,
  });

  const result = await uploadResponse.json().catch(() => null);
  if (!uploadResponse.ok || !result?.url) {
    throw new Error(result?.error?.message || "Header rasm Vercel Blob'ga yuklanmadi.");
  }

  return {
    fileId: result.url, // URL ni fileId sifatida ishlatamiz
    thumbnailUrl: result.url,
    webContentUrl: result.url,
    directUrl: result.url,
  };
}

// Metadata file bilan ishlash
async function findMetadataFile(folderId) {
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+name='${HEADER_METADATA_FILE_NAME}'+and+trashed=false&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,modifiedTime)`;
  const response = await authorizedFetch(url);
  const data = await response.json().catch(() => ({ files: [] }));
  return data.files?.[0] || null;
}

async function readMetadataFile(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await authorizedFetch(url);
  if (!response.ok) return { headers: [] };
  const text = await response.text().catch(() => "{\"headers\":[]}");
  try {
    const parsed = JSON.parse(text);
    return { headers: parsed.headers || [] };
  } catch {
    return { headers: [] };
  }
}

async function writeMetadataFile(folderId, data, existingFileId = null) {
  const metadata = {
    name: HEADER_METADATA_FILE_NAME,
    mimeType: "application/json",
    ...(existingFileId ? {} : { parents: [folderId] }),
  };

  const boundary = `----MetadataBoundary${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(data, null, 2) +
    `\r\n--${boundary}--\r\n`;

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&supportsAllDrives=true`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`;

  const response = await authorizedFetch(url, {
    method: existingFileId ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });

  return response.json().catch(() => null);
}

// Barcha headerlarni olish
async function getAllHeaders() {
  try {
    const folderId = getEnv("GOOGLE_DRIVE_FOLDER_ID");
    if (!folderId) return [];

    const file = await findMetadataFile(folderId);
    if (!file) return [];

    const data = await readMetadataFile(file.id);
    return data.headers || [];
  } catch (error) {
    console.error("[header-section] Error reading headers:", error);
    return [];
  }
}

// Header saqlash (create yoki update)
async function saveHeader(headerData) {
  const folderId = getEnv("GOOGLE_DRIVE_FOLDER_ID");
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID not configured");

  const file = await findMetadataFile(folderId);
  const data = file ? await readMetadataFile(file.id) : { headers: [] };
  data.headers = data.headers || [];

  // Mavjud header ni topish
  const existingIndex = data.headers.findIndex(h => h.movieId === headerData.movieId);

  const headerRecord = {
    id: existingIndex >= 0 ? data.headers[existingIndex].id : `header-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    movieId: headerData.movieId,
    title: headerData.title || "",
    year: headerData.year || "",
    category: headerData.category || "",
    rating: headerData.rating || "",
    headerImageFileId: headerData.headerImageFileId,
    headerImageUrl: headerData.headerImageUrl,
    cropSettings: headerData.cropSettings || null,
    order: headerData.order ?? (existingIndex >= 0 ? data.headers[existingIndex].order : data.headers.length),
    isActive: headerData.isActive !== false,
    createdAt: existingIndex >= 0 ? data.headers[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    data.headers[existingIndex] = headerRecord;
  } else {
    data.headers.push(headerRecord);
  }

  await writeMetadataFile(folderId, data, file?.id);
  return headerRecord;
}

// Header ni o'chirish (soft delete - isActive=false)
async function deleteHeader(movieId) {
  const folderId = getEnv("GOOGLE_DRIVE_FOLDER_ID");
  if (!folderId) return false;

  const file = await findMetadataFile(folderId);
  if (!file) return false;

  const data = await readMetadataFile(file.id);
  data.headers = data.headers || [];

  const index = data.headers.findIndex(h => h.movieId === movieId);
  if (index === -1) return false;

  // Soft delete
  data.headers[index].isActive = false;
  data.headers[index].updatedAt = new Date().toISOString();

  await writeMetadataFile(folderId, data, file.id);
  return true;
}

// Handler
module.exports = async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    // GET - Barcha headerlarni olish
    if (request.method === "GET") {
      const headers = await getAllHeaders();
      const activeHeaders = headers.filter(h => h.isActive !== false);
      response.status(200).json({
        ok: true,
        headers: activeHeaders,
      });
      return;
    }

    // POST - Header yaratish/yangilash
    if (request.method === "POST") {
      let body = {};
      if (request.body && Buffer.isBuffer(request.body)) {
        body = JSON.parse(request.body.toString("utf8"));
      } else if (request.body && typeof request.body === "object") {
        body = request.body;
      } else {
        let raw = "";
        for await (const chunk of request) {
          raw += chunk;
        }
        body = raw ? JSON.parse(raw) : {};
      }

      const movieId = String(body.movieId || "").trim();
      if (!movieId) {
        response.status(400).json({
          ok: false,
          code: "MISSING_MOVIE_ID",
          error: "Kino ID si kerak.",
        });
        return;
      }

      // Base64 rasm yuklangan bo'lsa, uni Google Drive'ga yuklash
      let headerImageFileId = body.headerImageFileId;
      let headerImageUrl = body.headerImageUrl;

      if (body.headerImage && body.headerImage.startsWith("data:image")) {
        try {
          const uploadResult = await uploadHeaderImage(body.headerImage, movieId, body.title);
          headerImageFileId = uploadResult.fileId;
          headerImageUrl = uploadResult.directUrl;
        } catch (uploadError) {
          console.error("[header-section] Upload error:", uploadError);
          response.status(500).json({
            ok: false,
            code: "UPLOAD_FAILED",
            error: "Rasm yuklashda xatolik: " + uploadError.message,
          });
          return;
        }
      }

      const saved = await saveHeader({
        movieId,
        title: body.title || "",
        year: body.year || "",
        category: body.category || "",
        rating: body.rating || "",
        headerImageFileId,
        headerImageUrl,
        cropSettings: body.cropSettings || body.headerCrop || null,
        order: body.order,
        isActive: body.isActive !== false,
      });

      response.status(200).json({
        ok: true,
        message: "Header saqlandi (alohida storage).",
        header: saved,
      });
      return;
    }

    // DELETE - Header ni o'chirish
    if (request.method === "DELETE") {
      let body = {};
      if (request.body && Buffer.isBuffer(request.body)) {
        body = JSON.parse(request.body.toString("utf8"));
      } else {
        let raw = "";
        for await (const chunk of request) {
          raw += chunk;
        }
        body = raw ? JSON.parse(raw) : {};
      }

      const movieId = String(body.movieId || "").trim();
      if (!movieId) {
        response.status(400).json({
          ok: false,
          code: "MISSING_MOVIE_ID",
          error: "Kino ID si kerak.",
        });
        return;
      }

      await deleteHeader(movieId);
      response.status(200).json({
        ok: true,
        message: "Header o'chirildi (isActive=false).",
        movieId,
      });
      return;
    }

    response.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      error: "Faqat GET/POST/DELETE ishlaydi.",
    });
  } catch (error) {
    console.error("[header-section] Error:", error);
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "HEADER_SECTION_ERROR",
      error: error.message || "Header section bilan ishlayotganda xatolik.",
    });
  }
};

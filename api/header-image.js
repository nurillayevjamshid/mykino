const {
  getDriveConfig,
  setCors,
} = require("./_lib/google-drive");

const crypto = require("crypto");

const HEADER_METADATA_FILE_NAME = ".my-kino-headers.json";

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function trimString(value) {
  return String(value || "").trim();
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

async function getAccessToken() {
  const { credentials } = getDriveConfig();
  const tokenResponse = await fetch(credentials.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createJwtAssertion(credentials),
    }),
  });
  const payload = await tokenResponse.json().catch(() => null);
  return payload?.access_token;
}

function createJwtAssertion(credentials) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
    exp: expiresAt,
    iat: issuedAt,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(credentials.private_key, "base64");
  return `${unsigned}.${signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

async function findMetadataFile(folderId) {
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+name='${HEADER_METADATA_FILE_NAME}'+and+trashed=false&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,modifiedTime)`;
  const response = await authorizedFetch(url);
  const data = await response.json().catch(() => ({ files: [] }));
  return data.files?.[0] || null;
}

async function readMetadataFile(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await authorizedFetch(url);
  if (!response.ok) return { headers: {} };
  const text = await response.text().catch(() => "{}");
  try {
    const parsed = JSON.parse(text);
    return { headers: parsed.headers || {} };
  } catch {
    return { headers: {} };
  }
}

async function writeMetadataFile(folderId, data, existingFileId = null) {
  const metadata = {
    name: HEADER_METADATA_FILE_NAME,
    mimeType: "application/json",
    ...(existingFileId ? {} : { parents: [folderId] }),
  };

  const boundary = `header_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(data, null, 2),
    `--${boundary}--`,
    "",
  ].join("\r\n");

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

async function getAllHeaderImages() {
  try {
    const { folderId } = getDriveConfig();
    const file = await findMetadataFile(folderId);
    if (!file) return {};
    const data = await readMetadataFile(file.id);
    return data.headers || {};
  } catch (error) {
    console.error("[header-image] Error reading headers:", error);
    return {};
  }
}

async function saveHeaderImage(movieId, headerData) {
  const { folderId } = getDriveConfig();
  const file = await findMetadataFile(folderId);

  const headers = file ? await readMetadataFile(file.id) : { headers: {} };
  headers.headers = headers.headers || {};

  // Faqat header ma'lumotlarini saqlash
  headers.headers[movieId] = {
    headerImage: headerData.headerImage,
    showInHeader: headerData.showInHeader !== false,
    headerCrop: headerData.headerCrop || null,
    updatedAt: new Date().toISOString(),
  };

  await writeMetadataFile(folderId, headers, file?.id);
  return headers.headers[movieId];
}

async function deleteHeaderImage(movieId) {
  const { folderId } = getDriveConfig();
  const file = await findMetadataFile(folderId);
  if (!file) return false;

  const headers = await readMetadataFile(file.id);
  headers.headers = headers.headers || {};

  delete headers.headers[movieId];

  await writeMetadataFile(folderId, headers, file.id);
  return true;
}

module.exports = async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    // GET - Barcha header rasmlarini olish
    if (request.method === "GET") {
      const headers = await getAllHeaderImages();
      response.status(200).json({
        ok: true,
        headers,
      });
      return;
    }

    // POST/PUT - Header rasm saqlash
    if (request.method === "POST" || request.method === "PUT") {
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

      const movieId = trimString(body.movieId || body.id);
      if (!movieId) {
        response.status(400).json({
          ok: false,
          code: "MISSING_MOVIE_ID",
          error: "Kino ID si kerak.",
        });
        return;
      }

      if (!hasOwn(body, "headerImage")) {
        response.status(400).json({
          ok: false,
          code: "MISSING_HEADER_IMAGE",
          error: "Header rasmi kerak.",
        });
        return;
      }

      const saved = await saveHeaderImage(movieId, {
        headerImage: body.headerImage,
        showInHeader: body.showInHeader !== false,
        headerCrop: body.headerCrop,
      });

      response.status(200).json({
        ok: true,
        message: "Header rasm alohida saqlandi.",
        movieId,
        header: saved,
      });
      return;
    }

    // DELETE - Header rasmni o'chirish
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

      const movieId = trimString(body.movieId || body.id);
      if (!movieId) {
        response.status(400).json({
          ok: false,
          code: "MISSING_MOVIE_ID",
          error: "Kino ID si kerak.",
        });
        return;
      }

      await deleteHeaderImage(movieId);
      response.status(200).json({
        ok: true,
        message: "Header rasm o'chirildi.",
        movieId,
      });
      return;
    }

    response.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      error: "Faqat GET/POST/PUT/DELETE ishlaydi.",
    });
  } catch (error) {
    console.error("[header-image] Error:", error);
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "HEADER_IMAGE_ERROR",
      error: error.message || "Header rasm bilan ishlayotganda xatolik.",
    });
  }
};

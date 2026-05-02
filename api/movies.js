const { listDriveMovies, setCors } = require("./_lib/google-drive");
const crypto = require("crypto");

const HEADER_METADATA_FILE_NAME = ".my-kino-headers.json";

async function getAccessToken() {
  const credentials = readServiceAccountCredentials();
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

function readServiceAccountCredentials() {
  const rawBase64 = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64;
  const rawJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;

  if (rawBase64) {
    return JSON.parse(Buffer.from(rawBase64, "base64").toString("utf8"));
  }

  if (rawJson) {
    return JSON.parse(rawJson);
  }

  return {
    client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    token_uri: process.env.GOOGLE_DRIVE_TOKEN_URI || "https://oauth2.googleapis.com/token",
  };
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

async function findHeaderMetadataFile(folderId) {
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+name='${HEADER_METADATA_FILE_NAME}'+and+trashed=false&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,modifiedTime)`;
  const response = await authorizedFetch(url);
  const data = await response.json().catch(() => ({ files: [] }));
  return data.files?.[0] || null;
}

async function readHeaderMetadataFile(fileId) {
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

    const data = await readHeaderMetadataFile(file.id);
    const headers = Array.isArray(data.headers) ? data.headers : [];
    const map = {};
    headers.forEach(h => {
      if (h.isActive !== false) {
        map[h.movieId] = h;
      }
    });
    return map;
  } catch (error) {
    console.error("[movies] Error reading header images:", error);
    return {};
  }
}

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
    const [movies, headerImagesMap] = await Promise.all([
      listDriveMovies(),
      getHeaderImagesMap(),
    ]);

    // Header rasmlarini alohida saqlash bilan birlashtirish
    const moviesWithHeaders = movies.map((movie) => {
      const headerData = headerImagesMap[movie.id];
      if (headerData) {
        const hImage = headerData.headerImageUrl || headerData.headerImage || movie.headerImage;
        return {
          ...movie,
          headerImage: hImage,
          showInHeader: headerData.isActive !== false,
          headerCrop: headerData.cropSettings || headerData.headerCrop || movie.headerCrop,
          heroPoster: hImage || movie.heroPoster,
          heroFeatured: headerData.isActive !== false,
        };
      }
      return movie;
    });

    response.status(200).json(moviesWithHeaders);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "GOOGLE_DRIVE_MOVIES_FAILED",
      error: error.message || "Katalog yuklanmadi.",
    });
  }
};

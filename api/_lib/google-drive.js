const crypto = require("crypto");

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const LOGO_POSTER_URL = "/static/assets/my-kino-logo.png";
const METADATA_FILE_NAME = ".my-kino-metadata.json";
const EMBEDDED_META_START = "[MY_KINO_META]";
const EMBEDDED_META_END = "[/MY_KINO_META]";

let accessTokenCache = {
  value: "",
  expiresAt: 0,
};

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
}

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
    token_uri: getEnv("GOOGLE_DRIVE_TOKEN_URI") || DEFAULT_TOKEN_URI,
  };
}

function getDriveConfig() {
  const folderId = getEnv("GOOGLE_DRIVE_FOLDER_ID");
  if (!folderId) {
    const error = new Error("GOOGLE_DRIVE_FOLDER_ID serverda sozlanmagan.");
    error.statusCode = 500;
    error.code = "GOOGLE_DRIVE_FOLDER_ID_MISSING";
    throw error;
  }

  const credentials = readServiceAccountCredentials();
  if (!credentials.client_email || !credentials.private_key) {
    const error = new Error("Google Drive service account credential topilmadi.");
    error.statusCode = 500;
    error.code = "GOOGLE_DRIVE_CREDENTIALS_MISSING";
    throw error;
  }

  return {
    folderId,
    credentials,
  };
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createJwtAssertion(credentials) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope: DRIVE_SCOPE,
    aud: credentials.token_uri || DEFAULT_TOKEN_URI,
    exp: expiresAt,
    iat: issuedAt,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(credentials.private_key, "base64");
  return `${unsigned}.${signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

async function getAccessToken() {
  if (accessTokenCache.value && Date.now() < accessTokenCache.expiresAt) {
    return accessTokenCache.value;
  }

  const { credentials } = getDriveConfig();
  const tokenResponse = await fetch(credentials.token_uri || DEFAULT_TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createJwtAssertion(credentials),
    }),
  });
  const payload = await tokenResponse.json().catch(() => null);

  if (!tokenResponse.ok || !payload?.access_token) {
    const error = new Error(payload?.error_description || payload?.error || "Google Drive access token olinmadi.");
    error.statusCode = tokenResponse.status || 502;
    error.code = "GOOGLE_DRIVE_TOKEN_FAILED";
    throw error;
  }

  accessTokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(240, Number(payload.expires_in || 3600) - 120) * 1000,
  };

  return accessTokenCache.value;
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

async function driveFetch(pathname, options = {}) {
  const normalizedPath = pathname ? `/${String(pathname).replace(/^\/+/, "")}` : "";
  const url = new URL(`${DRIVE_API_BASE}${normalizedPath}`);
  const query = options.query || {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return authorizedFetch(url, options);
}

async function driveFetchJson(pathname, options = {}) {
  const response = await driveFetch(pathname, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const error = new Error(payload?.error?.message || "Google Drive so'rovi bajarilmadi.");
    error.statusCode = response.status || 502;
    error.code = payload?.error?.status || "GOOGLE_DRIVE_REQUEST_FAILED";
    throw error;
  }
  return payload;
}

async function driveUploadFetch(pathname, options = {}) {
  const normalizedPath = pathname ? `/${String(pathname).replace(/^\/+/, "")}` : "";
  const url = new URL(`${DRIVE_UPLOAD_BASE}${normalizedPath}`);
  const query = {
    uploadType: "multipart",
    supportsAllDrives: "true",
    ...(options.query || {}),
  };
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return authorizedFetch(url, options);
}

async function driveUploadJson(pathname, options = {}) {
  const response = await driveUploadFetch(pathname, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const error = new Error(payload?.error?.message || "Google Drive fayli saqlanmadi.");
    error.statusCode = response.status || 502;
    error.code = payload?.error?.status || "GOOGLE_DRIVE_UPLOAD_FAILED";
    throw error;
  }
  return payload;
}

function stripExtension(name) {
  return String(name || "").replace(/\.[a-z0-9]{2,5}$/i, "");
}

function inferYear(name, fallbackDate = "") {
  const match = String(name || "").match(/(?:19|20)\d{2}/);
  if (match) return Number(match[0]);
  const date = new Date(fallbackDate);
  return Number.isFinite(date.getTime()) ? date.getFullYear() : "";
}

function inferQuality(name, width = 0) {
  const normalized = String(name || "").toLowerCase();
  if (/\b2160p\b|\b4k\b/.test(normalized)) return "4K";
  if (/\b1080p\b|\bfhd\b/.test(normalized) || width >= 1920) return "1080P";
  if (/\b720p\b|\bhd\b/.test(normalized) || width >= 1280) return "720P";
  if (/\b480p\b/.test(normalized)) return "480P";
  return "HD";
}

function inferFlag(name, description, needle) {
  const haystack = `${name} ${description}`.toLowerCase();
  return haystack.includes(`#${needle}`) || haystack.includes(`[${needle}]`) || haystack.includes(` ${needle} `);
}

function defaultMetadataPayload() {
  return {
    version: 1,
    updatedAt: "",
    movies: {},
  };
}

function normalizeCatalogMetadata(payload) {
  const fallback = defaultMetadataPayload();
  if (!payload || typeof payload !== "object") return fallback;
  return {
    version: Number(payload.version || 1) || 1,
    updatedAt: trimString(payload.updatedAt),
    movies: payload.movies && typeof payload.movies === "object" ? payload.movies : {},
  };
}

function safeRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(10, Number(numeric.toFixed(1))));
}

function trimString(value) {
  return String(value || "").trim();
}

function safeBooleanFlag(value, fallback = false) {
  if (value === undefined || value === null) return Boolean(fallback);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const normalized = trimString(value).toLowerCase();
  if (!normalized) return false;
  if (["false", "0", "no", "off", "yoq", "yo'q"].includes(normalized)) return false;
  return ["true", "1", "yes", "on", "ha"].includes(normalized);
}

function sanitizePublicGenre(value) {
  const normalized = trimString(value);
  return /^google drive$/i.test(normalized) ? "Kino" : normalized;
}

function sanitizePublicDescription(value) {
  const normalized = trimString(value);
  return /google drive/i.test(normalized) ? "Tomosha uchun tayyor kino." : normalized;
}

function getMetadataOverride(metadataMap, fileId) {
  if (!metadataMap || typeof metadataMap !== "object") return null;
  const entry = metadataMap[String(fileId)];
  return entry && typeof entry === "object" ? entry : null;
}

function isDataImageValue(value) {
  return trimString(value).startsWith("data:image/");
}

function resolveStoredHeaderImage(value) {
  const normalized = trimString(value);
  return !normalized || isDataImageValue(normalized) ? normalized : "";
}

function cleanupStoredMovieOverride(current = {}) {
  const posterImage = trimString(current.posterImage || current.poster);
  const rawHeaderImage = trimString(current.headerImage || current.heroPoster || current.headerPoster || current.heroImage);
  const headerImage = resolveStoredHeaderImage(rawHeaderImage);
  const showInHeader = safeBooleanFlag(current.showInHeader) && (!rawHeaderImage || Boolean(headerImage));
  const next = {
    ...current,
    posterImage,
    headerImage,
    showInHeader,
  };

  delete next.poster;
  delete next.heroPoster;
  delete next.headerPoster;
  delete next.heroImage;
  delete next.heroFeatured;
  delete next.isHero;

  return next;
}

function extractEmbeddedMovieMetadata(description) {
  const rawDescription = String(description || "");
  const startIndex = rawDescription.indexOf(EMBEDDED_META_START);
  const endIndex = rawDescription.indexOf(EMBEDDED_META_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return {
      override: null,
      visibleDescription: rawDescription.trim(),
    };
  }

  const jsonText = rawDescription
    .slice(startIndex + EMBEDDED_META_START.length, endIndex)
    .trim();
  const visibleDescription = rawDescription
    .slice(endIndex + EMBEDDED_META_END.length)
    .trim();

  try {
    const parsed = JSON.parse(jsonText);
    return {
      override: parsed && typeof parsed === "object" ? parsed : null,
      visibleDescription,
    };
  } catch {
    return {
      override: null,
      visibleDescription: rawDescription.trim(),
    };
  }
}

function toDriveMovie(file, index, metadataMap = {}) {
  const title = stripExtension(file.name).replace(/[._]+/g, " ").trim() || `Kino ${index + 1}`;
  const embedded = extractEmbeddedMovieMetadata(file.description || "");
  const description = sanitizePublicDescription(embedded.visibleDescription || "Tomosha uchun tayyor kino.");
  const width = Number(file.videoMediaMetadata?.width || 0);
  const quality = inferQuality(file.name, width);
  const year = inferYear(file.name, file.createdTime || file.modifiedTime);
  const jsonOverride = getMetadataOverride(metadataMap, file.id) || {};
  const embeddedOverride = embedded.override && typeof embedded.override === "object" ? embedded.override : {};
  const override = { ...embeddedOverride, ...jsonOverride };
  const genre = sanitizePublicGenre(override?.genre || override?.category) || "Kino";
  const posterImage = trimString(override?.posterImage || override?.poster);
  const rawHeaderImage = trimString(override?.headerImage || override?.heroPoster || override?.headerPoster || override?.heroImage);
  const headerImage = resolveStoredHeaderImage(rawHeaderImage);
  const fallbackPosterImage = file.thumbnailLink ? `/api/drive-thumbnail/${encodeURIComponent(file.id)}` : LOGO_POSTER_URL;
  const finalPosterImage = posterImage || fallbackPosterImage;
  const showInHeader = safeBooleanFlag(override?.showInHeader) && (!rawHeaderImage || Boolean(headerImage));
  const finalDescription = sanitizePublicDescription(override?.description) || description;
  const finalTitle = trimString(override?.title) || title;
  const finalQuality = trimString(override?.quality) || quality;
  const rating = override?.rating !== undefined ? safeRating(override.rating) : 0;
  const hasCustomMetadata = Boolean(
    trimString(override?.title)
    || trimString(override?.genre)
    || trimString(override?.posterImage)
    || trimString(override?.poster)
    || trimString(override?.headerImage)
    || trimString(override?.heroPoster)
    || trimString(override?.description)
    || trimString(override?.quality)
    || override?.showInHeader !== undefined
    || override?.heroFeatured !== undefined
    || override?.rating !== undefined,
  );

  return {
    id: file.id,
    code: String(file.id).slice(0, 10).toUpperCase(),
    fileId: file.id,
    driveFileId: file.id,
    fileName: file.name || "",
    sourceType: "google_drive",
    title: finalTitle,
    description: finalDescription,
    year,
    genre,
    rating,
    quality: finalQuality,
    hasCustomMetadata,
    isTop: inferFlag(file.name, description, "top"),
    isPremium: inferFlag(file.name, description, "premium"),
    posterImage: finalPosterImage,
    headerImage,
    showInHeader,
    poster: finalPosterImage,
    heroPoster: headerImage,
    heroFeatured: showInHeader,
    thumbnail: finalPosterImage,
    streamUrl: `/api/drive-stream/${encodeURIComponent(file.id)}`,
    videoUrl: `/api/drive-stream/${encodeURIComponent(file.id)}`,
    sourceUrl: file.webViewLink || "",
    webViewLink: file.webViewLink || "",
    mimeType: file.mimeType || "video/mp4",
    size: Number(file.size || 0) || 0,
    createdTime: file.createdTime || "",
    modifiedTime: file.modifiedTime || "",
  };
}

async function findFolderFileByName(folderId, fileName) {
  const payload = await driveFetchJson("", {
    query: {
      q: `'${folderId}' in parents and trashed=false and name='${fileName}'`,
      pageSize: 1,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      fields: "files(id,name,mimeType,modifiedTime)",
    },
  });
  return payload.files?.[0] || null;
}

async function findServiceAccountJsonByName(fileName) {
  const payload = await driveFetchJson("", {
    query: {
      q: `name='${fileName}' and mimeType='application/json' and trashed=false and 'me' in owners`,
      pageSize: 1,
      spaces: "drive",
      fields: "files(id,name,mimeType,modifiedTime)",
    },
  });
  return payload.files?.[0] || null;
}

async function readDriveTextFile(fileId) {
  const response = await driveFetch(encodeURIComponent(fileId), {
    query: {
      alt: "media",
      supportsAllDrives: "true",
    },
  });

  if (!response.ok) {
    const error = new Error("Google Drive fayli o'qilmadi.");
    error.statusCode = response.status || 502;
    error.code = "GOOGLE_DRIVE_FILE_READ_FAILED";
    throw error;
  }

  return response.text();
}

async function readAppJsonByName(fileName, fallbackFactory) {
  const { folderId } = getDriveConfig();
  const existing = (await findFolderFileByName(folderId, fileName)) || (await findServiceAccountJsonByName(fileName));
  if (!existing) {
    return {
      file: null,
      data: fallbackFactory(),
    };
  }

  try {
    const text = await readDriveTextFile(existing.id);
    return {
      file: existing,
      data: JSON.parse(text),
    };
  } catch {
    return {
      file: existing,
      data: fallbackFactory(),
    };
  }
}

function buildJsonMultipartBody(metadata, data) {
  const boundary = `mykino_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
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

  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

async function writeAppJsonByName(fileName, data, existingFile = null) {
  const { folderId } = getDriveConfig();
  const existing = existingFile || (await findFolderFileByName(folderId, fileName)) || (await findServiceAccountJsonByName(fileName));
  const metadata = {
    name: fileName,
    mimeType: "application/json",
    ...(existing ? {} : { parents: [folderId] }),
  };
  const multipart = buildJsonMultipartBody(metadata, data);
  const pathname = existing ? encodeURIComponent(existing.id) : "";
  const savedFile = await driveUploadJson(pathname, {
    method: existing ? "PATCH" : "POST",
    headers: {
      "Content-Type": multipart.contentType,
    },
    body: multipart.body,
    query: {
      fields: "id,name,mimeType,modifiedTime",
    },
  });

  return savedFile;
}

async function readCatalogMetadata() {
  return readAppJsonByName(METADATA_FILE_NAME, defaultMetadataPayload);
}

async function writeCatalogMetadata(data, existingFile = null) {
  const normalized = normalizeCatalogMetadata(data);
  normalized.updatedAt = new Date().toISOString();
  const file = await writeAppJsonByName(METADATA_FILE_NAME, normalized, existingFile);
  return {
    file,
    data: normalized,
  };
}

async function updateCatalogMovieMetadata(fileId, updates = {}) {
  const normalizedFileId = trimString(fileId);
  if (!normalizedFileId) {
    const error = new Error("Kino ID si kerak.");
    error.statusCode = 400;
    error.code = "MOVIE_ID_MISSING";
    throw error;
  }

  await getDriveFileMetadata(normalizedFileId, "id,name,mimeType");

  const metadataState = await readCatalogMetadata();
  const metadata = normalizeCatalogMetadata(metadataState.data);
  const current = metadata.movies[normalizedFileId] && typeof metadata.movies[normalizedFileId] === "object"
    ? metadata.movies[normalizedFileId]
    : {};
  const next = { ...current };

  if (updates.title !== undefined) next.title = trimString(updates.title);
  if (updates.genre !== undefined || updates.category !== undefined) {
    next.genre = sanitizePublicGenre(updates.genre !== undefined ? updates.genre : updates.category);
  }
  if (updates.rating !== undefined) next.rating = safeRating(updates.rating);
  if (updates.quality !== undefined) next.quality = trimString(updates.quality).toUpperCase();
  if (updates.posterImage !== undefined || updates.poster !== undefined) {
    next.posterImage = trimString(updates.posterImage !== undefined ? updates.posterImage : updates.poster);
  }
  if (updates.description !== undefined) next.description = trimString(updates.description);
  if (updates.year !== undefined) {
    const numericYear = Number(updates.year);
    next.year = Number.isFinite(numericYear) && numericYear > 0 ? numericYear : "";
  }
  if (updates.showInHeader !== undefined) next.showInHeader = safeBooleanFlag(updates.showInHeader);

  const cleaned = cleanupStoredMovieOverride(next);
  metadata.movies[normalizedFileId] = cleaned;

  await writeCatalogMetadata(metadata, metadataState.file);

  return {
    id: normalizedFileId,
    override: cleaned,
  };
}

async function listDriveMovies() {
  const { folderId } = getDriveConfig();
  try {
    await getDriveFileMetadata(folderId, "id,name,mimeType");
  } catch (error) {
    if (error.statusCode === 404) {
      error.code = "GOOGLE_DRIVE_FOLDER_NOT_SHARED";
      error.message = "Google Drive papkasi service account uchun ochilmagan. Papkani share qilib bering.";
    }
    throw error;
  }
  const files = [];
  let pageToken = "";
  const metadataState = await readCatalogMetadata();
  const metadataMap = metadataState.data?.movies && typeof metadataState.data.movies === "object"
    ? metadataState.data.movies
    : {};

  do {
    const payload = await driveFetchJson("", {
      query: {
        q: `'${folderId}' in parents and trashed=false and mimeType contains 'video/'`,
        orderBy: "createdTime desc",
        pageSize: 100,
        pageToken,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        fields:
          "nextPageToken,files(id,name,description,appProperties,mimeType,createdTime,modifiedTime,size,thumbnailLink,webViewLink,videoMediaMetadata(width,height,durationMillis))",
      },
    });

    files.push(...(payload.files || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return files.map((file, index) => toDriveMovie(file, index, metadataMap));
}

async function getDriveFileMetadata(fileId, fields) {
  return driveFetchJson(encodeURIComponent(fileId), {
    query: {
      supportsAllDrives: "true",
      fields: fields || "id,name,mimeType,size,thumbnailLink,webViewLink",
    },
  });
}

async function getDriveMediaResponse(fileId, requestHeaders = {}) {
  const response = await driveFetch(encodeURIComponent(fileId), {
    query: {
      alt: "media",
      supportsAllDrives: "true",
    },
    headers: requestHeaders,
  });

  if (!response.ok && response.status !== 206) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.error?.message || "Google Drive video stream olinmadi.");
    error.statusCode = response.status || 502;
    error.code = payload?.error?.status || "GOOGLE_DRIVE_STREAM_FAILED";
    throw error;
  }

  return response;
}

module.exports = {
  LOGO_POSTER_URL,
  getAccessToken,
  getDriveConfig,
  getDriveFileMetadata,
  getDriveMediaResponse,
  listDriveMovies,
  readCatalogMetadata,
  setCors,
  updateCatalogMovieMetadata,
};

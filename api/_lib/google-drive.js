const crypto = require("crypto");

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API_BASE = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const LOGO_POSTER_URL = "/static/assets/my-kino-logo.png";
const METADATA_FILE_NAME = ".my-kino-metadata.json";
const USER_STATS_FILE_NAME = ".my-kino-user-stats.json";
const EMBEDDED_META_START = "[MY_KINO_META]";
const EMBEDDED_META_END = "[/MY_KINO_META]";

let accessTokenCache = {
  value: "",
  expiresAt: 0,
};

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, X-Admin-Id");
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

function withFriendlyDriveWriteError(error) {
  const message = String(error?.message || "");
  if (/insufficient permissions for the specified parent/i.test(message)) {
    error.statusCode = 403;
    error.code = "GOOGLE_DRIVE_FOLDER_WRITE_FORBIDDEN";
    error.message = "Admin panelni saqlash uchun Google Drive papkasida service account ruxsatini Viewer emas, Editor qiling.";
  }
  return error;
}

function defaultMetadataPayload() {
  return {
    version: 1,
    updatedAt: "",
    movies: {},
  };
}

function defaultUserStatsPayload() {
  return {
    version: 1,
    updatedAt: "",
    users: {},
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

function buildEmbeddedMovieDescription(override, visibleDescription) {
  return `${EMBEDDED_META_START}${JSON.stringify(override)}${EMBEDDED_META_END}\n${String(visibleDescription || "").trim()}`.trim();
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
  const poster = trimString(override?.poster);
  const finalDescription = sanitizePublicDescription(override?.description) || description;
  const finalTitle = trimString(override?.title) || title;
  const finalQuality = trimString(override?.quality) || quality;
  const rating = override?.rating !== undefined ? safeRating(override.rating) : 0;
  const hasCustomMetadata = Boolean(
    trimString(override?.title)
    || trimString(override?.genre)
    || trimString(override?.poster)
    || trimString(override?.heroPoster)
    || trimString(override?.description)
    || trimString(override?.quality)
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
    heroFeatured: Boolean(override?.heroFeatured || override?.isHero || override?.showInHeader),
    poster: poster || (file.thumbnailLink ? `/api/drive-thumbnail/${encodeURIComponent(file.id)}` : LOGO_POSTER_URL),
    heroPoster: trimString(override?.heroPoster || override?.headerPoster || override?.heroImage),
    thumbnail: poster || (file.thumbnailLink ? `/api/drive-thumbnail/${encodeURIComponent(file.id)}` : LOGO_POSTER_URL),
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

async function createJsonFileInFolder(folderId, fileName, payload) {
  const boundary = `codex-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: "application/json",
  });
  const media = JSON.stringify(payload, null, 2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${media}\r\n` +
    `--${boundary}--`;
  const url = new URL(DRIVE_UPLOAD_API_BASE);
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("supportsAllDrives", "true");
  const response = await authorizedFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.id) {
    const error = new Error(result?.error?.message || "Google Drive JSON fayli yaratilmadi.");
    error.statusCode = response.status || 502;
    error.code = result?.error?.status || "GOOGLE_DRIVE_JSON_CREATE_FAILED";
    throw withFriendlyDriveWriteError(error);
  }
  return result;
}

async function createJsonFile(fileName, payload) {
  const boundary = `codex-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: "application/json",
  });
  const media = JSON.stringify(payload, null, 2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${media}\r\n` +
    `--${boundary}--`;
  const url = new URL(DRIVE_UPLOAD_API_BASE);
  url.searchParams.set("uploadType", "multipart");
  const response = await authorizedFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.id) {
    const error = new Error(result?.error?.message || "Google Drive JSON fayli yaratilmadi.");
    error.statusCode = response.status || 502;
    error.code = result?.error?.status || "GOOGLE_DRIVE_JSON_CREATE_FAILED";
    throw error;
  }
  return result;
}

async function updateJsonFile(fileId, payload) {
  const url = new URL(`${DRIVE_UPLOAD_API_BASE}/${encodeURIComponent(fileId)}`);
  url.searchParams.set("uploadType", "media");
  url.searchParams.set("supportsAllDrives", "true");
  const response = await authorizedFetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(payload, null, 2),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.id) {
    const error = new Error(result?.error?.message || "Google Drive JSON fayli yangilanmadi.");
    error.statusCode = response.status || 502;
    error.code = result?.error?.status || "GOOGLE_DRIVE_JSON_UPDATE_FAILED";
    throw withFriendlyDriveWriteError(error);
  }
  return result;
}

async function updateDriveFileFields(fileId, payload) {
  const url = new URL(`${DRIVE_API_BASE}/${encodeURIComponent(fileId)}`);
  url.searchParams.set("supportsAllDrives", "true");
  const response = await authorizedFetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.id) {
    const error = new Error(result?.error?.message || "Google Drive fayli metadata'si yangilanmadi.");
    error.statusCode = response.status || 502;
    error.code = result?.error?.status || "GOOGLE_DRIVE_FILE_UPDATE_FAILED";
    throw error;
  }
  return result;
}

async function readAppJsonByName(fileName, fallbackFactory) {
  const { folderId } = getDriveConfig();
  const existing = (await findServiceAccountJsonByName(fileName)) || (await findFolderFileByName(folderId, fileName));
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

async function writeAppJsonByName(fileName, payload) {
  const { folderId } = getDriveConfig();
  const existing = (await findServiceAccountJsonByName(fileName)) || (await findFolderFileByName(folderId, fileName));
  if (!existing) {
    return createJsonFileInFolder(folderId, fileName, payload);
  }
  return updateJsonFile(existing.id, payload);
}

async function readCatalogMetadata() {
  return readAppJsonByName(METADATA_FILE_NAME, defaultMetadataPayload);
}

async function saveCatalogMetadata(payload) {
  const nextPayload = {
    ...defaultMetadataPayload(),
    ...(payload || {}),
    updatedAt: new Date().toISOString(),
  };
  await writeAppJsonByName(METADATA_FILE_NAME, nextPayload);
  return nextPayload;
}

function shouldFallbackToEmbeddedMetadata(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "GOOGLE_DRIVE_JSON_CREATE_FAILED"
    || code === "GOOGLE_DRIVE_FOLDER_WRITE_FORBIDDEN"
    || message.includes("service accounts do not have storage quota")
    || message.includes("storage quota")
  );
}

async function writeEmbeddedDriveMovieMetadata(fileId, updates = {}) {
  const file = await getDriveFileMetadata(fileId, "id,description");
  const embedded = extractEmbeddedMovieMetadata(file.description || "");
  const current = embedded.override && typeof embedded.override === "object" ? embedded.override : {};
  const visibleDescription =
    trimString(updates.description)
    || sanitizePublicDescription(current.description)
    || sanitizePublicDescription(embedded.visibleDescription)
    || "Tomosha uchun tayyor kino.";

  const nextOverride = {
    ...current,
    title: trimString(updates.title) || trimString(current.title) || "",
    genre: sanitizePublicGenre(updates.genre || updates.category) || sanitizePublicGenre(current.genre) || "Kino",
    poster: trimString(updates.poster) || trimString(current.poster) || "",
    heroPoster: trimString(updates.heroPoster) || trimString(current.heroPoster) || "",
    description: visibleDescription,
    quality: trimString(updates.quality) || trimString(current.quality) || "HD",
    rating: safeRating(updates.rating ?? current.rating ?? 0),
    heroFeatured: Boolean(updates.heroFeatured ?? current.heroFeatured ?? false),
    updatedAt: new Date().toISOString(),
  };

  await updateDriveFileFields(fileId, {
    description: buildEmbeddedMovieDescription(nextOverride, visibleDescription),
  });
  return nextOverride;
}

async function upsertCatalogMovieMetadata(fileId, updates = {}) {
  try {
    const state = await readCatalogMetadata();
    const metadata = {
      ...defaultMetadataPayload(),
      ...(state.data || {}),
    };
    const movies = metadata.movies && typeof metadata.movies === "object" ? metadata.movies : {};
    const current = getMetadataOverride(movies, fileId) || {};

    movies[String(fileId)] = {
      ...current,
      title: trimString(updates.title) || current.title || "",
      genre: sanitizePublicGenre(updates.genre || updates.category) || sanitizePublicGenre(current.genre) || "Kino",
      poster: trimString(updates.poster) || current.poster || "",
      heroPoster: trimString(updates.heroPoster) || current.heroPoster || "",
      description: sanitizePublicDescription(updates.description) || sanitizePublicDescription(current.description) || "",
      quality: trimString(updates.quality) || current.quality || "HD",
      rating: safeRating(updates.rating ?? current.rating ?? 0),
      heroFeatured: Boolean(updates.heroFeatured ?? current.heroFeatured ?? false),
      updatedAt: new Date().toISOString(),
    };

    metadata.movies = movies;
    return await saveCatalogMetadata(metadata);
  } catch (error) {
    if (!shouldFallbackToEmbeddedMetadata(error)) {
      throw error;
    }
    return writeEmbeddedDriveMovieMetadata(fileId, updates);
  }
}

async function readUserStats() {
  return readAppJsonByName(USER_STATS_FILE_NAME, defaultUserStatsPayload);
}

async function trackUserVisit(user = {}) {
  const userId = Number(user.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    const error = new Error("Foydalanuvchi ID topilmadi.");
    error.statusCode = 400;
    error.code = "TRACK_USER_ID_REQUIRED";
    throw error;
  }

  const state = await readUserStats();
  const payload = {
    ...defaultUserStatsPayload(),
    ...(state.data || {}),
  };
  const users = payload.users && typeof payload.users === "object" ? payload.users : {};
  const now = new Date().toISOString();
  const key = String(userId);
  const existing = users[key] && typeof users[key] === "object" ? users[key] : {};
  users[key] = {
    id: userId,
    firstName: trimString(user.first_name || user.firstName) || existing.firstName || "",
    lastName: trimString(user.last_name || user.lastName) || existing.lastName || "",
    username: trimString(user.username) || existing.username || "",
    photoUrl: trimString(user.photo_url || user.photoUrl) || existing.photoUrl || "",
    firstSeenAt: existing.firstSeenAt || now,
    lastSeenAt: now,
  };
  payload.users = users;
  payload.updatedAt = now;
  await writeAppJsonByName(USER_STATS_FILE_NAME, payload);
  return {
    userCount: Object.keys(users).length,
    updatedAt: now,
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
  readUserStats,
  setCors,
  trackUserVisit,
  upsertCatalogMovieMetadata,
};

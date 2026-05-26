const crypto = require("crypto");
const { uploadImageToR2 } = require("./r2-store");

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const LOGO_POSTER_URL = "/static/assets/my-kino-logo.png";
const METADATA_FILE_NAME = ".my-kino-metadata.json";
const SERIES_FOLDER_NAME = "seriallar";
const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
const EMBEDDED_META_START = "[MY_KINO_META]";
const EMBEDDED_META_END = "[/MY_KINO_META]";
const DRIVE_DESCRIPTION_MAX_LENGTH = 28000;
const MOVIE_DESCRIPTION_MAX_LENGTH = 4000;
const NATURAL_SORT_COLLATOR = new Intl.Collator("uz", { numeric: true, sensitivity: "base" });

let accessTokenCache = {
  value: "",
  expiresAt: 0,
};

// Memory cache (per warm Lambda instance). 60s TTL — Drive API yukini kamaytiradi.
const LIST_CACHE_TTL_MS = 60_000;
const listCache = {
  movies: { value: null, expiresAt: 0, inflight: null },
  series: { value: null, expiresAt: 0, inflight: null },
};

function readListCache(key) {
  const entry = listCache[key];
  if (!entry) return null;
  if (entry.value && Date.now() < entry.expiresAt) return entry.value;
  return null;
}

function writeListCache(key, value) {
  const entry = listCache[key];
  if (!entry) return;
  entry.value = value;
  entry.expiresAt = Date.now() + LIST_CACHE_TTL_MS;
}

function invalidateListCache(key) {
  const entry = key ? listCache[key] : null;
  if (entry) {
    entry.value = null;
    entry.expiresAt = 0;
    entry.inflight = null;
    return;
  }
  for (const k of Object.keys(listCache)) {
    listCache[k].value = null;
    listCache[k].expiresAt = 0;
    listCache[k].inflight = null;
  }
}

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

async function updateDriveFileMetadata(fileId, metadata, fields = "id,name,mimeType,description,modifiedTime") {
  return driveFetchJson(encodeURIComponent(fileId), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(metadata),
    query: {
      supportsAllDrives: "true",
      fields,
    },
  });
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

function normalizeNaturalSortText(value) {
  return stripExtension(value)
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEpisodeSortText(entry) {
  return normalizeNaturalSortText(
    entry?.title
    || entry?.defaultTitle
    || entry?.fileName
    || entry?.name
    || "",
  );
}

function compareSeriesEpisodes(left, right) {
  const byTitle = NATURAL_SORT_COLLATOR.compare(getEpisodeSortText(left), getEpisodeSortText(right));
  if (byTitle) return byTitle;
  return String(left?.id || "").localeCompare(String(right?.id || ""));
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
    settings: {},
    movies: {},
    series: {},
  };
}

function normalizeCatalogMetadata(payload) {
  const fallback = defaultMetadataPayload();
  if (!payload || typeof payload !== "object") return fallback;
  return {
    version: Number(payload.version || 1) || 1,
    updatedAt: trimString(payload.updatedAt),
    settings: payload.settings && typeof payload.settings === "object" ? payload.settings : {},
    movies: payload.movies && typeof payload.movies === "object" ? payload.movies : {},
    series: payload.series && typeof payload.series === "object" ? payload.series : {},
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

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
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
  return trimString(value);
}

function roundedNumber(value, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** digits;
  return Math.round(numeric * factor) / factor;
}

function sanitizeHeaderCrop(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    ratio: trimString(value.ratio) || "16:9",
    source: {
      width: roundedNumber(value.source?.width),
      height: roundedNumber(value.source?.height),
    },
    crop: {
      x: roundedNumber(value.crop?.x),
      y: roundedNumber(value.crop?.y),
      width: roundedNumber(value.crop?.width),
      height: roundedNumber(value.crop?.height),
    },
    transform: {
      zoom: roundedNumber(value.transform?.zoom, 2),
      x: roundedNumber(value.transform?.x),
      y: roundedNumber(value.transform?.y),
    },
  };
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
  const headerCrop = sanitizeHeaderCrop(current.headerCrop);
  if (headerCrop && headerImage) {
    next.headerCrop = headerCrop;
  } else {
    delete next.headerCrop;
  }

  delete next.poster;
  delete next.heroPoster;
  delete next.headerPoster;
  delete next.heroImage;
  delete next.heroFeatured;
  delete next.isHero;

  return next;
}

function isServiceAccountStorageQuotaError(error) {
  const message = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  return message.includes("service accounts do not have storage quota")
    || message.includes("storage quota")
    || message.includes("storagequotaexceeded");
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

function buildEmbeddedMovieDescription(visibleDescription, override, maxLength = 0) {
  const cleaned = cleanupStoredMovieOverride(override);
  const prefix = [
    EMBEDDED_META_START,
    JSON.stringify(cleaned),
    EMBEDDED_META_END,
  ].join("\n");
  const visible = trimString(visibleDescription);
  const description = [prefix, visible].filter((part) => part !== "").join("\n");
  if (!maxLength || description.length <= maxLength) return description;

  const visibleBudget = Math.max(0, maxLength - prefix.length - 1);
  const clippedVisible = visible.slice(0, visibleBudget).trimEnd();
  return [prefix, clippedVisible].filter((part) => part !== "").join("\n");
}

function buildCatalogFallbackDescription(visibleDescription, override, updates = {}) {
  const posterUpdated = hasOwn(updates, "posterImage") || hasOwn(updates, "poster");
  const headerUpdated = hasOwn(updates, "headerImage")
    || hasOwn(updates, "heroPoster")
    || hasOwn(updates, "headerPoster")
    || hasOwn(updates, "heroImage")
    || hasOwn(updates, "showInHeader")
    || hasOwn(updates, "headerCrop");
  const descriptionUpdated = hasOwn(updates, "description") && updates.description !== undefined;
  const candidates = [];
  const seen = new Set();
  const addCandidate = (candidate) => {
    const cleaned = cleanupStoredMovieOverride(candidate);
    const key = JSON.stringify(cleaned);
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(cleaned);
    }
  };

  addCandidate(override);

  const withoutUnchangedLongDescription = { ...override };
  if (!descriptionUpdated && trimString(withoutUnchangedLongDescription.description).length > MOVIE_DESCRIPTION_MAX_LENGTH) {
    delete withoutUnchangedLongDescription.description;
  }
  addCandidate(withoutUnchangedLongDescription);

  const compact = { ...withoutUnchangedLongDescription };
  if (!posterUpdated) delete compact.posterImage;
  if (!headerUpdated) {
    delete compact.headerImage;
    delete compact.showInHeader;
    delete compact.headerCrop;
  }
  addCandidate(compact);

  for (const candidate of candidates) {
    const description = buildEmbeddedMovieDescription(visibleDescription, candidate, DRIVE_DESCRIPTION_MAX_LENGTH);
    if (description.length <= DRIVE_DESCRIPTION_MAX_LENGTH) return description;
  }

  const error = new Error("Saqlanadigan metadata juda katta. Rasm hajmini kichraytiring yoki tavsifni qisqartiring.");
  error.statusCode = 400;
  error.code = "METADATA_TOO_LARGE";
  throw error;
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
  const reactionCounts = countReactions(jsonOverride?.reactions);
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
    || override?.headerCrop !== undefined
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
    headerCrop: sanitizeHeaderCrop(override?.headerCrop),
    likes: reactionCounts.likes,
    dislikes: reactionCounts.dislikes,
    streamUrl: `/api/drive-stream/${encodeURIComponent(file.id)}`,
    videoUrl: `/api/drive-stream/${encodeURIComponent(file.id)}`,
    cdnUrl: trimString(override?.cdnUrl),
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

  const driveFile = await getDriveFileMetadata(normalizedFileId, "id,name,mimeType,description");
  const movieName = driveFile.name || "";
  const embedded = extractEmbeddedMovieMetadata(driveFile.description || "");

  // Base64 rasmlarni Cloudflare R2'ga yuklash
  if (isDataImageValue(updates.posterImage)) {
    const upload = await uploadImageToR2(updates.posterImage, "poster");
    updates.posterImage = upload.directUrl;
  }
  if (isDataImageValue(updates.headerImage)) {
    const upload = await uploadImageToR2(updates.headerImage, "header");
    updates.headerImage = upload.directUrl;
  }
  if (isDataImageValue(updates.poster)) {
    const upload = await uploadImageToR2(updates.poster, "poster");
    updates.poster = upload.directUrl;
  }
  if (isDataImageValue(updates.heroPoster)) {
    const upload = await uploadImageToR2(updates.heroPoster, "header");
    updates.heroPoster = upload.directUrl;
  }

  const metadataState = await readCatalogMetadata();
  const metadata = normalizeCatalogMetadata(metadataState.data);
  const jsonCurrent = metadata.movies[normalizedFileId] && typeof metadata.movies[normalizedFileId] === "object"
    ? metadata.movies[normalizedFileId]
    : {};
  const current = {
    ...(embedded.override && typeof embedded.override === "object" ? embedded.override : {}),
    ...jsonCurrent,
  };
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
  if (updates.headerImage !== undefined || updates.heroPoster !== undefined || updates.headerPoster !== undefined || updates.heroImage !== undefined) {
    next.headerImage = trimString(
      updates.headerImage !== undefined
        ? updates.headerImage
        : updates.heroPoster !== undefined
          ? updates.heroPoster
          : updates.headerPoster !== undefined
            ? updates.headerPoster
            : updates.heroImage
    );
  }
  if (updates.headerCrop !== undefined) {
    const headerCrop = sanitizeHeaderCrop(updates.headerCrop);
    if (headerCrop) {
      next.headerCrop = headerCrop;
    } else {
      delete next.headerCrop;
    }
  }
  if (updates.description !== undefined) {
    const nextDescription = trimString(updates.description);
    if (nextDescription.length > MOVIE_DESCRIPTION_MAX_LENGTH) {
      const error = new Error(`Tavsif juda uzun. Maksimal: ${MOVIE_DESCRIPTION_MAX_LENGTH} ta belgi.`);
      error.statusCode = 400;
      error.code = "DESCRIPTION_TOO_LONG";
      throw error;
    }
    next.description = nextDescription;
  }
  if (updates.year !== undefined) {
    const numericYear = Number(updates.year);
    next.year = Number.isFinite(numericYear) && numericYear > 0 ? numericYear : "";
  }
  if (updates.showInHeader !== undefined) next.showInHeader = safeBooleanFlag(updates.showInHeader);
  if (updates.cdnUrl !== undefined) next.cdnUrl = trimString(updates.cdnUrl);

  const cleaned = cleanupStoredMovieOverride(next);
  metadata.movies[normalizedFileId] = cleaned;

  try {
    await writeCatalogMetadata(metadata, metadataState.file);
  } catch (error) {
    if (!isServiceAccountStorageQuotaError(error)) {
      throw error;
    }

    await updateDriveFileMetadata(normalizedFileId, {
      description: buildCatalogFallbackDescription(embedded.visibleDescription, cleaned, updates),
    });
  }

  invalidateListCache("movies");

  return {
    id: normalizedFileId,
    override: cleaned,
  };
}

function countReactions(reactionsMap) {
  let likes = 0;
  let dislikes = 0;
  if (reactionsMap && typeof reactionsMap === "object") {
    for (const value of Object.values(reactionsMap)) {
      if (value === "like") likes += 1;
      else if (value === "dislike") dislikes += 1;
    }
  }
  return { likes, dislikes };
}

async function readMovieReactionState(fileId) {
  const normalizedFileId = trimString(fileId);
  if (!normalizedFileId) {
    const error = new Error("Kino ID si kerak.");
    error.statusCode = 400;
    error.code = "MOVIE_ID_MISSING";
    throw error;
  }
  const metadataState = await readCatalogMetadata();
  const metadata = normalizeCatalogMetadata(metadataState.data);
  const entry = metadata.movies[normalizedFileId] && typeof metadata.movies[normalizedFileId] === "object"
    ? metadata.movies[normalizedFileId]
    : {};
  const reactions = entry.reactions && typeof entry.reactions === "object" ? entry.reactions : {};
  return { metadataState, metadata, reactions };
}

async function setMovieReaction(fileId, userId, reaction) {
  const normalizedFileId = trimString(fileId);
  const normalizedUserId = trimString(userId);
  if (!normalizedFileId || !normalizedUserId) {
    const error = new Error("Kino ID va foydalanuvchi ID si kerak.");
    error.statusCode = 400;
    error.code = "REACTION_FIELDS_MISSING";
    throw error;
  }
  const allowed = ["like", "dislike", null, ""];
  const normalizedReaction = reaction === "like" || reaction === "dislike" ? reaction : null;
  if (!allowed.includes(reaction) && reaction !== null && reaction !== undefined) {
    const error = new Error("Reaction noto'g'ri.");
    error.statusCode = 400;
    error.code = "REACTION_INVALID";
    throw error;
  }

  const { metadataState, metadata } = await readMovieReactionState(normalizedFileId);
  const entry = metadata.movies[normalizedFileId] && typeof metadata.movies[normalizedFileId] === "object"
    ? metadata.movies[normalizedFileId]
    : {};
  const reactions = entry.reactions && typeof entry.reactions === "object" ? { ...entry.reactions } : {};
  if (normalizedReaction) reactions[normalizedUserId] = normalizedReaction;
  else delete reactions[normalizedUserId];

  const nextEntry = { ...entry, reactions };
  metadata.movies[normalizedFileId] = nextEntry;
  await writeCatalogMetadata(metadata, metadataState.file);
  invalidateListCache("movies");

  const counts = countReactions(reactions);
  return {
    id: normalizedFileId,
    userId: normalizedUserId,
    userReaction: normalizedReaction,
    ...counts,
  };
}

async function getMovieReaction(fileId, userId = "") {
  const normalizedFileId = trimString(fileId);
  const normalizedUserId = trimString(userId);
  const { reactions } = await readMovieReactionState(normalizedFileId);
  const counts = countReactions(reactions);
  return {
    id: normalizedFileId,
    userId: normalizedUserId,
    userReaction: normalizedUserId ? (reactions[normalizedUserId] || null) : null,
    ...counts,
  };
}


async function listDriveMoviesUncached() {
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

async function findSeriesRootFolder() {
  const { folderId } = getDriveConfig();
  const payload = await driveFetchJson("", {
    query: {
      q: `'${folderId}' in parents and trashed=false and mimeType='${DRIVE_FOLDER_MIME}'`,
      pageSize: 100,
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      fields: "files(id,name)",
    },
  });
  const folders = payload.files || [];
  return folders.find((folder) => trimString(folder.name).toLowerCase() === SERIES_FOLDER_NAME) || null;
}

async function listFolderVideosDeep(folderId, depth = 0) {
  const videos = [];
  const subfolders = [];
  let pageToken = "";
  do {
    const payload = await driveFetchJson("", {
      query: {
        q: `'${folderId}' in parents and trashed=false`,
        orderBy: "name",
        pageSize: 200,
        pageToken,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        fields: "nextPageToken,files(id,name,size,mimeType,createdTime,modifiedTime)",
      },
    });
    for (const file of payload.files || []) {
      if (file.mimeType === DRIVE_FOLDER_MIME) {
        subfolders.push(file);
      } else if (String(file.mimeType || "").startsWith("video/")) {
        videos.push(file);
      }
    }
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  if (depth < 2) {
    for (const sub of subfolders) {
      const nested = await listFolderVideosDeep(sub.id, depth + 1);
      videos.push(...nested);
    }
  }

  return videos;
}

function normalizeEpisodeOverrides(value) {
  const result = {};
  if (!value || typeof value !== "object") return result;
  for (const [epId, epTitle] of Object.entries(value)) {
    const key = trimString(epId);
    const title = trimString(epTitle);
    if (key && title) result[key] = title;
  }
  return result;
}

function buildEmbeddedSeriesDescription(override) {
  const clean = {};
  const title = trimString(override.title);
  const description = trimString(override.description);
  const posterImage = trimString(override.posterImage);
  if (title) clean.title = title;
  if (description) clean.description = description;
  if (posterImage) clean.posterImage = posterImage;
  const episodes = normalizeEpisodeOverrides(override.episodes);
  if (Object.keys(episodes).length) clean.episodes = episodes;
  const episodeCdn = normalizeEpisodeOverrides(override.episodeCdn);
  if (Object.keys(episodeCdn).length) clean.episodeCdn = episodeCdn;
  const episodeSeasons = normalizeEpisodeOverrides(override.episodeSeasons);
  if (Object.keys(episodeSeasons).length) clean.episodeSeasons = episodeSeasons;
  return [EMBEDDED_META_START, JSON.stringify(clean), EMBEDDED_META_END].join("\n");
}

function toDriveSeries(folder, episodeFiles) {
  const embedded = extractEmbeddedMovieMetadata(folder.description || "");
  const override = embedded.override && typeof embedded.override === "object" ? embedded.override : {};
  const episodeTitles = normalizeEpisodeOverrides(override.episodes);
  const episodeCdn = normalizeEpisodeOverrides(override.episodeCdn);
  const episodeSeasons = normalizeEpisodeOverrides(override.episodeSeasons);
  const folderName = trimString(folder.name);
  const title = trimString(override.title) || folderName || "Serial";
  const description = trimString(override.description);
  const posterImage = trimString(override.posterImage);
  const orderedEpisodeFiles = [...episodeFiles].sort(compareSeriesEpisodes);
  const episodes = orderedEpisodeFiles.map((file, index) => {
    const defaultTitle = stripExtension(file.name).replace(/[._]+/g, " ").trim() || `Qism ${index + 1}`;
    const customTitle = trimString(episodeTitles[file.id]);
    const rawSeason = Number(trimString(episodeSeasons[file.id]));
    return {
      id: file.id,
      title: customTitle || defaultTitle,
      defaultTitle,
      fileName: file.name || "",
      mimeType: file.mimeType || "video/mp4",
      streamUrl: `/api/drive-stream/${encodeURIComponent(file.id)}`,
      videoUrl: `/api/drive-stream/${encodeURIComponent(file.id)}`,
      cdnUrl: trimString(episodeCdn[file.id]),
      season: Number.isFinite(rawSeason) && rawSeason > 0 ? rawSeason : 1,
      size: Number(file.size || 0) || 0,
      createdTime: file.createdTime || "",
      modifiedTime: file.modifiedTime || "",
    };
  }).sort(compareSeriesEpisodes);
  return {
    id: folder.id,
    folderId: folder.id,
    sourceType: "google_drive_folder",
    title,
    folderName,
    description,
    posterImage: posterImage || LOGO_POSTER_URL,
    poster: posterImage || LOGO_POSTER_URL,
    hasCustomPoster: Boolean(posterImage),
    episodeCount: episodes.length,
    episodes,
    createdTime: folder.createdTime || "",
    modifiedTime: folder.modifiedTime || "",
  };
}

async function listDriveSeriesUncached() {
  const seriesRoot = await findSeriesRootFolder();
  if (!seriesRoot) return [];

  const seriesFolders = [];
  let pageToken = "";
  do {
    const payload = await driveFetchJson("", {
      query: {
        q: `'${seriesRoot.id}' in parents and trashed=false and mimeType='${DRIVE_FOLDER_MIME}'`,
        orderBy: "name",
        pageSize: 100,
        pageToken,
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        fields: "nextPageToken,files(id,name,description,createdTime,modifiedTime)",
      },
    });
    seriesFolders.push(...(payload.files || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  if (seriesFolders.length === 0) return [];

  const series = await Promise.all(
    seriesFolders.map(async (folder) => {
      const episodeFiles = await listFolderVideosDeep(folder.id);
      return toDriveSeries(folder, episodeFiles);
    }),
  );

  return series;
}

async function listDriveMovies() {
  const cached = readListCache("movies");
  if (cached) return cached;
  const entry = listCache.movies;
  if (entry.inflight) return entry.inflight;
  entry.inflight = (async () => {
    try {
      const value = await listDriveMoviesUncached();
      writeListCache("movies", value);
      return value;
    } finally {
      entry.inflight = null;
    }
  })();
  return entry.inflight;
}

async function listDriveSeries() {
  const cached = readListCache("series");
  if (cached) return cached;
  const entry = listCache.series;
  if (entry.inflight) return entry.inflight;
  entry.inflight = (async () => {
    try {
      const value = await listDriveSeriesUncached();
      writeListCache("series", value);
      return value;
    } finally {
      entry.inflight = null;
    }
  })();
  return entry.inflight;
}

async function updateCatalogSeriesMetadata(folderId, updates = {}) {
  const normalizedId = trimString(folderId);
  if (!normalizedId) {
    const error = new Error("Serial ID si kerak.");
    error.statusCode = 400;
    error.code = "SERIES_ID_MISSING";
    throw error;
  }

  if (isDataImageValue(updates.posterImage)) {
    const upload = await uploadImageToR2(updates.posterImage, "series-poster");
    updates.posterImage = upload.directUrl;
  }

  const folder = await getDriveFileMetadata(normalizedId, "id,name,mimeType,description");
  const embedded = extractEmbeddedMovieMetadata(folder.description || "");
  const current = embedded.override && typeof embedded.override === "object" ? embedded.override : {};
  const next = { ...current };

  if (updates.title !== undefined) next.title = trimString(updates.title);
  if (updates.description !== undefined) {
    const nextDescription = trimString(updates.description);
    if (nextDescription.length > MOVIE_DESCRIPTION_MAX_LENGTH) {
      const error = new Error(`Tavsif juda uzun. Maksimal: ${MOVIE_DESCRIPTION_MAX_LENGTH} ta belgi.`);
      error.statusCode = 400;
      error.code = "DESCRIPTION_TOO_LONG";
      throw error;
    }
    next.description = nextDescription;
  }
  if (updates.posterImage !== undefined) next.posterImage = trimString(updates.posterImage);
  if (updates.episodes && typeof updates.episodes === "object" && !Array.isArray(updates.episodes)) {
    const currentEpisodes = current.episodes && typeof current.episodes === "object" ? current.episodes : {};
    const nextEpisodes = { ...currentEpisodes };
    for (const [epId, epTitle] of Object.entries(updates.episodes)) {
      const key = trimString(epId);
      if (!key) continue;
      const value = trimString(epTitle);
      if (value) nextEpisodes[key] = value;
      else delete nextEpisodes[key];
    }
    next.episodes = nextEpisodes;
  }
  if (updates.episodeSeasons && typeof updates.episodeSeasons === "object" && !Array.isArray(updates.episodeSeasons)) {
    const currentSeasons = current.episodeSeasons && typeof current.episodeSeasons === "object" ? current.episodeSeasons : {};
    const nextSeasons = { ...currentSeasons };
    for (const [epId, season] of Object.entries(updates.episodeSeasons)) {
      const key = trimString(epId);
      if (!key) continue;
      const num = Number(season);
      if (Number.isFinite(num) && num > 0) nextSeasons[key] = String(Math.trunc(num));
      else delete nextSeasons[key];
    }
    next.episodeSeasons = nextSeasons;
  }
  if (updates.episodeCdn && typeof updates.episodeCdn === "object" && !Array.isArray(updates.episodeCdn)) {
    const currentCdn = current.episodeCdn && typeof current.episodeCdn === "object" ? current.episodeCdn : {};
    const nextCdn = { ...currentCdn };
    for (const [epId, cdnUrl] of Object.entries(updates.episodeCdn)) {
      const key = trimString(epId);
      if (!key) continue;
      const value = trimString(cdnUrl);
      if (value) nextCdn[key] = value;
      else delete nextCdn[key];
    }
    next.episodeCdn = nextCdn;
  }

  const cleaned = {
    title: trimString(next.title),
    description: trimString(next.description),
    posterImage: trimString(next.posterImage),
  };
  const cleanedEpisodes = normalizeEpisodeOverrides(next.episodes);
  if (Object.keys(cleanedEpisodes).length) cleaned.episodes = cleanedEpisodes;
  const cleanedCdn = normalizeEpisodeOverrides(next.episodeCdn);
  if (Object.keys(cleanedCdn).length) cleaned.episodeCdn = cleanedCdn;
  const cleanedSeasons = normalizeEpisodeOverrides(next.episodeSeasons);
  if (Object.keys(cleanedSeasons).length) cleaned.episodeSeasons = cleanedSeasons;

  await updateDriveFileMetadata(normalizedId, {
    description: buildEmbeddedSeriesDescription(cleaned),
  });
  invalidateListCache("series");

  return {
    id: normalizedId,
    override: cleaned,
  };
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
  isServiceAccountStorageQuotaError,
  listDriveMovies,
  listDriveSeries,
  invalidateListCache,
  updateCatalogSeriesMetadata,
  readCatalogMetadata,
  writeCatalogMetadata,
  setCors,
  updateDriveFileMetadata,
  updateCatalogMovieMetadata,
  getMovieReaction,
  setMovieReaction,
};

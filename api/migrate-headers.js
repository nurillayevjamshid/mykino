/**
 * Migration script: Eski movies ichidagi header ma'lumotlarni yangi alohida storage ga ko'chirish
 * Run: node api/migrate-headers.js
 */

const crypto = require("crypto");

const METADATA_FILE_NAME = ".my-kino-metadata.json";
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

// Metadata fayllarini qidirish
async function findMetadataFile(folderId, fileName) {
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+name='${fileName}'+and+trashed=false&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,modifiedTime)`;
  const response = await authorizedFetch(url);
  const data = await response.json().catch(() => ({ files: [] }));
  return data.files?.[0] || null;
}

// Fayl o'qish
async function readFile(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await authorizedFetch(url);
  if (!response.ok) return null;
  const text = await response.text().catch(() => null);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Yangi fayl yozish
async function writeFile(folderId, fileName, data, existingFileId = null) {
  const metadata = {
    name: fileName,
    mimeType: "application/json",
    ...(existingFileId ? {} : { parents: [folderId] }),
  };

  const boundary = `----Boundary${Date.now()}`;
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

// Migration logikasi
async function migrate() {
  console.log("=== HEADER MIGRATION STARTED ===\n");

  const folderId = getEnv("GOOGLE_DRIVE_FOLDER_ID");
  if (!folderId) {
    console.error("❌ GOOGLE_DRIVE_FOLDER_ID not set!");
    return;
  }

  console.log(`📁 Folder ID: ${folderId}\n`);

  // 1. Eski metadata faylini o'qish
  console.log("1. Reading old metadata file...");
  const oldMetadataFile = await findMetadataFile(folderId, METADATA_FILE_NAME);
  if (!oldMetadataFile) {
    console.error("❌ Old metadata file not found!");
    return;
  }
  console.log(`✅ Found: ${oldMetadataFile.id}\n`);

  const oldData = await readFile(oldMetadataFile.id);
  if (!oldData || !oldData.movies) {
    console.error("❌ Invalid old metadata structure!");
    return;
  }

  console.log(`📊 Found ${Object.keys(oldData.movies).length} movies\n`);

  // 2. Header ma'lumotlari bor kinolarni topish
  console.log("2. Finding movies with header data...");
  const headersToMigrate = [];

  for (const [movieId, movieData] of Object.entries(oldData.movies)) {
    if (movieData.headerImage || movieData.showInHeader || movieData.heroPoster) {
      headersToMigrate.push({
        movieId,
        headerImage: movieData.headerImage || movieData.heroPoster,
        showInHeader: movieData.showInHeader || movieData.heroFeatured || false,
        headerCrop: movieData.headerCrop || null,
        title: movieData.title || "",
        year: movieData.year || "",
        category: movieData.genre || "",
        rating: movieData.rating || "",
      });
      console.log(`  - ${movieId}: ${movieData.title || "Unknown"}`);
    }
  }

  if (headersToMigrate.length === 0) {
    console.log("ℹ️ No headers to migrate\n");
    return;
  }

  console.log(`\n📊 Found ${headersToMigrate.length} headers to migrate\n`);

  // 3. Yangi header metadata faylini yaratish
  console.log("3. Creating new header metadata file...");

  const newHeaderData = {
    headers: headersToMigrate.map((h, index) => ({
      id: `header-${Date.now()}-${index}`,
      movieId: h.movieId,
      title: h.title,
      year: h.year,
      category: h.category,
      rating: h.rating,
      // Base64 rasm URL sifatida saqlanadi (vaqtinchalik)
      // Keyinchalik alohida yuklash kerak bo'ladi
      headerImageUrl: h.headerImage?.startsWith("data:") ? null : h.headerImage,
      headerImageFileId: null,
      cropSettings: h.headerCrop,
      order: index,
      isActive: h.showInHeader,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      needsUpload: h.headerImage?.startsWith("data:"), // Base64 bo'lsa keyin yuklash kerak
      base64Data: h.headerImage?.startsWith("data:") ? h.headerImage : null,
    })),
    migratedAt: new Date().toISOString(),
  };

  const existingHeaderFile = await findMetadataFile(folderId, HEADER_METADATA_FILE_NAME);
  const saved = await writeFile(folderId, HEADER_METADATA_FILE_NAME, newHeaderData, existingHeaderFile?.id);

  if (saved?.id) {
    console.log(`✅ Created: ${saved.id}\n`);
  } else {
    console.error("❌ Failed to create header metadata file!\n");
    return;
  }

  // 4. Eski metadata dan header ma'lumotlarini o'chirish (ixtiyoriy)
  console.log("4. Cleaning up old metadata...");
  const cleanedMovies = { ...oldData.movies };
  let cleanedCount = 0;

  for (const header of headersToMigrate) {
    if (cleanedMovies[header.movieId]) {
      delete cleanedMovies[header.movieId].headerImage;
      delete cleanedMovies[header.movieId].showInHeader;
      delete cleanedMovies[header.movieId].heroPoster;
      delete cleanedMovies[header.movieId].heroFeatured;
      delete cleanedMovies[header.movieId].headerCrop;
      cleanedCount++;
    }
  }

  // Eski faylni yangilash (header ma'lumotlari o'chirilgan)
  const cleanedData = { ...oldData, movies: cleanedMovies };
  await writeFile(folderId, METADATA_FILE_NAME, cleanedData, oldMetadataFile.id);
  console.log(`✅ Cleaned ${cleanedCount} movies\n`);

  // 5. Natija
  console.log("=== MIGRATION COMPLETED ===\n");
  console.log("📋 Summary:");
  console.log(`  - Movies processed: ${Object.keys(oldData.movies).length}`);
  console.log(`  - Headers migrated: ${headersToMigrate.length}`);
  console.log(`  - Cleaned from old: ${cleanedCount}\n`);
  console.log("⚠️  IMPORTANT:");
  console.log("  - Base64 images are still stored in the new file temporarily.");
  console.log("  - They will be uploaded to Drive storage when you edit/save each header.");
  console.log("  - Or run 'upload-base64-headers.js' to bulk upload them.\n");
}

// Ishga tushirish
migrate().catch(console.error);

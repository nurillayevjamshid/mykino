#!/usr/bin/env node
/*
 * migrate-to-r2.js
 *
 * Google Drive'dagi har bir kinoni Cloudflare R2'ga ko'chiradi va
 * cdnUrl'ni Drive metadata'siga saqlaydi.
 *
 * Env (.mykino-r2.env va .mykino-sa.json kerak):
 *   R2_ACCOUNT_ID, R2_BUCKET, R2_ENDPOINT, R2_PUBLIC_URL,
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
 *
 * Foydalanish:
 *   node scripts/migrate-to-r2.js                 # status (qaysi ko'chgan)
 *   node scripts/migrate-to-r2.js --apply <ID>    # bitta kino ko'chirish (driveFileId)
 *   node scripts/migrate-to-r2.js --apply --all   # hamma kinolar
 *   node scripts/migrate-to-r2.js --apply --limit 5  # 5 ta birinchi NEEDS_MIGRATE
 */

const { Readable } = require("stream");
const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

const {
  listDriveMovies,
  getDriveMediaResponse,
  updateCatalogMovieMetadata,
} = require("../api/_lib/google-drive");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALL = args.includes("--all");
const limitIndex = args.indexOf("--limit");
const LIMIT = limitIndex >= 0 ? Number(args[limitIndex + 1]) || 1 : Infinity;
const SPECIFIC_ID = args.find((a) => !a.startsWith("--") && a.length > 10);

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    console.error(`FATAL: ${name} env o'rnatilmagan.`);
    process.exit(1);
  }
  return value;
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

const R2_BUCKET = requireEnv("R2_BUCKET");
const R2_PUBLIC_URL = requireEnv("R2_PUBLIC_URL").replace(/\/+$/, "");

const s3 = new S3Client({
  region: "auto",
  endpoint: requireEnv("R2_ENDPOINT"),
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  },
});

function objectKey(movie) {
  return `${movie.driveFileId}.mp4`;
}

function publicUrlFor(movie) {
  return `${R2_PUBLIC_URL}/${encodeURIComponent(objectKey(movie))}`;
}

async function checkExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404 || error.name === "NotFound") return false;
    throw error;
  }
}

async function uploadOne(movie) {
  const key = objectKey(movie);
  const url = publicUrlFor(movie);

  if (await checkExists(key)) {
    log(`  [SKIP_EXISTS] R2 da allaqachon bor: ${key}`);
    if (!movie.cdnUrl) {
      log(`  [PATCH_META] cdnUrl Drive metadata'ga yoziladi...`);
      await updateCatalogMovieMetadata(movie.driveFileId, { cdnUrl: url });
    }
    return { status: "SKIP_EXISTS", url };
  }

  log(`  → yuklab olinmoqda va R2'ga upload qilinmoqda (streaming)...`);
  const upstream = await getDriveMediaResponse(movie.driveFileId);
  const totalBytes = Number(upstream.headers.get("content-length") || 0);
  const bodyStream = Readable.fromWeb(upstream.body);

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET,
      Key: key,
      Body: bodyStream,
      ContentType: "video/mp4",
    },
    queueSize: 4,
    partSize: 16 * 1024 * 1024, // 16MB
    leavePartsOnError: false,
  });

  let lastPercent = -1;
  upload.on("httpUploadProgress", (p) => {
    if (totalBytes > 0 && p.loaded != null) {
      const pct = Math.floor((p.loaded / totalBytes) * 100);
      if (pct !== lastPercent && pct % 10 === 0) {
        lastPercent = pct;
        log(`    ${pct}%  (${Math.round(p.loaded / 1048576)} / ${Math.round(totalBytes / 1048576)} MB)`);
      }
    }
  });

  await upload.done();
  log(`  ✓ R2'ga yuklandi: ${url}`);

  log(`  → cdnUrl Drive metadata'ga yoziladi...`);
  await updateCatalogMovieMetadata(movie.driveFileId, { cdnUrl: url });

  return { status: "MIGRATED", url };
}

async function main() {
  log(APPLY ? "MODE: APPLY (haqiqiy migratsiya)" : "MODE: STATUS (faqat ko'rsatish)");
  log("Drive katalogi olinmoqda...");
  const movies = await listDriveMovies();
  log(`Topildi: ${movies.length} ta kino.\n`);

  const mp4Movies = movies.filter((m) => {
    const mime = String(m.mimeType || "").toLowerCase();
    const ext = String(m.fileName || "").split(".").pop()?.toLowerCase();
    return mime.includes("mp4") || mime.includes("quicktime") || ["mp4", "m4v", "mov"].includes(ext);
  });

  const alreadyMigrated = mp4Movies.filter((m) => m.cdnUrl);
  const needsMigrate = mp4Movies.filter((m) => !m.cdnUrl);

  log(`MP4: ${mp4Movies.length}`);
  log(`  Allaqachon ko'chgan: ${alreadyMigrated.length}`);
  log(`  Migratsiya kerak:    ${needsMigrate.length}`);
  log(`  Boshqa formatlar:    ${movies.length - mp4Movies.length} (skip)\n`);

  if (!APPLY) {
    log("Migratsiya boshlash uchun:");
    log("  node scripts/migrate-to-r2.js --apply --limit 1   # 1 ta sinab ko'rish");
    log("  node scripts/migrate-to-r2.js --apply --all       # hammasi");
    return;
  }

  let targets = [];
  if (SPECIFIC_ID) {
    const target = mp4Movies.find((m) => m.driveFileId === SPECIFIC_ID);
    if (!target) { log(`Topilmadi: ${SPECIFIC_ID}`); return; }
    targets = [target];
  } else if (ALL) {
    targets = needsMigrate;
  } else {
    targets = needsMigrate.slice(0, Number.isFinite(LIMIT) ? LIMIT : 1);
  }

  log(`Migratsiya qilinadi: ${targets.length} ta kino.\n`);
  const results = [];

  for (let i = 0; i < targets.length; i += 1) {
    const movie = targets[i];
    log(`[${i + 1}/${targets.length}] ${movie.fileName || movie.title}`);
    log(`  Drive ID: ${movie.driveFileId}`);
    log(`  Hajm: ${Math.round((movie.size || 0) / 1048576)} MB`);
    try {
      const result = await uploadOne(movie);
      results.push({ ...result, name: movie.fileName });
      log(`  ${result.status}\n`);
    } catch (error) {
      results.push({ status: "FAIL", error: error.message, name: movie.fileName });
      log(`  FAIL: ${error.message}\n`);
    }
  }

  log("=== XULOSA ===");
  const summary = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  for (const [status, count] of Object.entries(summary)) log(`  ${status}: ${count}`);
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exit(1);
});

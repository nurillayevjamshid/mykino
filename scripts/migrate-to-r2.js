#!/usr/bin/env node
/*
 * migrate-to-r2.js
 *
 * Google Drive'dagi har bir kinoni VA serial epizodlarini Cloudflare R2'ga
 * ko'chiradi (MKV/AVI/WebM -> MP4), cdnUrl'ni Drive metadata'siga saqlaydi.
 *
 * Env (.mykino-r2.env va .mykino-sa.json kerak):
 *   R2_ACCOUNT_ID, R2_BUCKET, R2_ENDPOINT, R2_PUBLIC_URL,
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
 *
 * Foydalanish:
 *   node scripts/migrate-to-r2.js                 # status (kino + serial)
 *   node scripts/migrate-to-r2.js --apply <ID>    # bitta fayl (driveFileId yoki epizod ID)
 *   node scripts/migrate-to-r2.js --apply --all   # hamma kino + hamma serial epizodi
 *   node scripts/migrate-to-r2.js --apply --limit 5  # 5 ta birinchi NEEDS_MIGRATE
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

const {
  listDriveMovies,
  listDriveSeries,
  listAdVideos,
  getDriveMediaResponse,
  updateCatalogMovieMetadata,
  updateCatalogSeriesMetadata,
  updateAdVideoCdn,
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

function objectKey(driveFileId) {
  return `${driveFileId}.mp4`;
}

function publicUrlFor(driveFileId) {
  return `${R2_PUBLIC_URL}/${encodeURIComponent(objectKey(driveFileId))}`;
}

function isMkvFile(fileName, mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  const ext = String(fileName || "").split(".").pop()?.toLowerCase();
  return mime.includes("matroska") || ext === "mkv" || ext === "webm" || ext === "avi";
}

function downloadToFile(fileId, destPath) {
  return getDriveMediaResponse(fileId).then((upstream) => new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(destPath);
    Readable.fromWeb(upstream.body).pipe(ws);
    ws.on("finish", resolve);
    ws.on("error", reject);
  }));
}

// MKV/AVI/WebM -> MP4. Video H.264 bo'lsa copy (tez, lossless),
// boshqa bo'lsa libx264 ga re-encode. Audio doim AAC.
function convertToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const tryConvert = (videoCodecArgs, label) => {
      log(`    ffmpeg: ${label}`);
      const proc = spawn("ffmpeg", [
        "-y",
        "-i", inputPath,
        "-map", "0:v:0",
        "-map", "0:a",
        ...videoCodecArgs,
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        outputPath,
      ], { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      proc.stderr.on("data", (c) => { stderr += c.toString(); });
      proc.on("error", reject);
      proc.on("exit", (code) => {
        if (code === 0) { resolve(label); return; }
        if (videoCodecArgs[1] === "copy") {
          // copy ishlamadi (kodek mos emas) -> re-encode'ga o'tish
          log(`    video copy ishlamadi, re-encode'ga o'tilmoqda...`);
          tryConvert(["-c:v", "libx264", "-preset", "veryfast", "-crf", "21"], "re-encode (libx264)");
        } else {
          reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-400)}`));
        }
      });
    };
    tryConvert(["-c:v", "copy"], "video copy + audio AAC");
  });
}

async function uploadFileToR2(key, filePath, totalBytes) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: "video/mp4",
    },
    queueSize: 4,
    partSize: 16 * 1024 * 1024,
    leavePartsOnError: false,
  });
  let lastPercent = -1;
  upload.on("httpUploadProgress", (p) => {
    if (totalBytes > 0 && p.loaded != null) {
      const pct = Math.floor((p.loaded / totalBytes) * 100);
      if (pct !== lastPercent && pct % 10 === 0) {
        lastPercent = pct;
        log(`    upload ${pct}%`);
      }
    }
  });
  await upload.done();
}

// MKV/AVI/WebM faylni yuklab olib, MP4'ga aylantirib R2'ga yuklaydi.
async function migrateMkv(task) {
  const key = objectKey(task.driveFileId);
  const url = publicUrlFor(task.driveFileId);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mkv2mp4-"));
  const inputPath = path.join(tmpDir, "input");
  const outputPath = path.join(tmpDir, "output.mp4");
  try {
    log(`  → MKV yuklab olinmoqda (${Math.round((task.size || 0) / 1048576)} MB)...`);
    await downloadToFile(task.driveFileId, inputPath);
    log(`  → MP4'ga aylantirilmoqda...`);
    const method = await convertToMp4(inputPath, outputPath);
    const outSize = fs.statSync(outputPath).size;
    log(`  → R2'ga yuklanmoqda (${Math.round(outSize / 1048576)} MB, ${method})...`);
    await uploadFileToR2(key, outputPath, outSize);
    log(`  ✓ R2'ga yuklandi: ${url}`);
    await task.writeCdn(url);
    return { status: "MIGRATED_MKV", url };
  } finally {
    try { fs.unlinkSync(inputPath); } catch (_) {}
    try { fs.unlinkSync(outputPath); } catch (_) {}
    try { fs.rmdirSync(tmpDir); } catch (_) {}
  }
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

// Bitta faylni (kino yoki epizod) R2'ga ko'chiradi.
async function uploadOne(task) {
  const key = objectKey(task.driveFileId);
  const url = publicUrlFor(task.driveFileId);

  if (await checkExists(key)) {
    log(`  [SKIP_EXISTS] R2 da allaqachon bor: ${key}`);
    if (!task.cdnUrl) {
      log(`  [PATCH_META] cdnUrl Drive metadata'ga yoziladi...`);
      await task.writeCdn(url);
    }
    return { status: "SKIP_EXISTS", url };
  }

  if (isMkvFile(task.fileName, task.mimeType)) {
    return migrateMkv(task);
  }

  log(`  → yuklab olinmoqda va R2'ga upload qilinmoqda (streaming)...`);
  const upstream = await getDriveMediaResponse(task.driveFileId);
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
  await task.writeCdn(url);

  return { status: "MIGRATED", url };
}

function isVideoFile(fileName, mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  const ext = String(fileName || "").split(".").pop()?.toLowerCase();
  return mime.includes("mp4") || mime.includes("quicktime") || mime.includes("matroska")
    || ["mp4", "m4v", "mov", "mkv", "webm", "avi"].includes(ext);
}

// Kinoni umumiy "task" ko'rinishiga keltiradi.
function movieToTask(movie) {
  return {
    kind: "movie",
    driveFileId: movie.driveFileId,
    fileName: movie.fileName || "",
    mimeType: movie.mimeType || "",
    size: movie.size || 0,
    cdnUrl: movie.cdnUrl || "",
    label: movie.fileName || movie.title || movie.driveFileId,
    writeCdn: (url) => updateCatalogMovieMetadata(movie.driveFileId, { cdnUrl: url }),
  };
}

// Serial epizodini umumiy "task" ko'rinishiga keltiradi.
function episodeToTask(series, episode) {
  return {
    kind: "episode",
    driveFileId: episode.id,
    fileName: episode.fileName || "",
    mimeType: episode.mimeType || "",
    size: episode.size || 0,
    cdnUrl: episode.cdnUrl || "",
    label: `[serial] ${series.title} — ${episode.title || episode.fileName || episode.id}`,
    writeCdn: (url) => updateCatalogSeriesMetadata(series.folderId || series.id, {
      episodeCdn: { [episode.id]: url },
    }),
  };
}

// Reklama videosini umumiy "task" ko'rinishiga keltiradi.
function adVideoToTask(adVideo) {
  return {
    kind: "ad",
    driveFileId: adVideo.id,
    fileName: adVideo.name || "",
    mimeType: adVideo.mimeType || "",
    size: adVideo.size || 0,
    cdnUrl: adVideo.cdnUrl || "",
    label: `[reklama] ${adVideo.name || adVideo.id}`,
    writeCdn: (url) => updateAdVideoCdn(adVideo.id, url),
  };
}

async function main() {
  log(APPLY ? "MODE: APPLY (haqiqiy migratsiya)" : "MODE: STATUS (faqat ko'rsatish)");

  log("Drive kino katalogi olinmoqda...");
  const movies = await listDriveMovies();
  const videoMovies = movies.filter((m) => isVideoFile(m.fileName, m.mimeType));
  const movieTasks = videoMovies.map(movieToTask);

  log("Drive serial katalogi olinmoqda...");
  let seriesList = [];
  try {
    seriesList = await listDriveSeries();
  } catch (error) {
    log(`  Seriallar olinmadi (skip): ${error.message}`);
  }
  const episodeTasks = [];
  for (const series of seriesList) {
    for (const episode of series.episodes || []) {
      if (!episode.id) continue;
      if (!isVideoFile(episode.fileName, episode.mimeType)) continue;
      episodeTasks.push(episodeToTask(series, episode));
    }
  }

  log("Drive reklama videolari olinmoqda...");
  let adVideos = [];
  try {
    adVideos = await listAdVideos();
  } catch (error) {
    log(`  Reklama videolari olinmadi (skip): ${error.message}`);
  }
  const adTasks = adVideos
    .filter((v) => v.id && isVideoFile(v.name, v.mimeType))
    .map(adVideoToTask);

  const allTasks = [...movieTasks, ...episodeTasks, ...adTasks];
  const alreadyMigrated = allTasks.filter((t) => t.cdnUrl);
  const needsMigrate = allTasks.filter((t) => !t.cdnUrl);
  const mkvCount = needsMigrate.filter((t) => isMkvFile(t.fileName, t.mimeType)).length;

  log("");
  log(`Kinolar:          ${movieTasks.length}`);
  log(`Serial:           ${seriesList.length} ta serial, ${episodeTasks.length} ta epizod`);
  log(`Reklama:          ${adTasks.length} ta video`);
  log(`Jami videolar:    ${allTasks.length}`);
  log(`  Allaqachon ko'chgan: ${alreadyMigrated.length}`);
  log(`  Migratsiya kerak:    ${needsMigrate.length}  (shundan MKV/konvert: ${mkvCount})`);
  log("");

  if (!APPLY) {
    log("Migratsiya boshlash uchun:");
    log("  node scripts/migrate-to-r2.js --apply --limit 1   # 1 ta sinab ko'rish");
    log("  node scripts/migrate-to-r2.js --apply --all       # hammasi (kino + serial)");
    return;
  }

  let targets = [];
  if (SPECIFIC_ID) {
    const target = allTasks.find((t) => t.driveFileId === SPECIFIC_ID);
    if (!target) { log(`Topilmadi: ${SPECIFIC_ID}`); return; }
    targets = [target];
  } else if (ALL) {
    targets = needsMigrate;
  } else {
    targets = needsMigrate.slice(0, Number.isFinite(LIMIT) ? LIMIT : 1);
  }

  log(`Migratsiya qilinadi: ${targets.length} ta video.\n`);
  const results = [];

  for (let i = 0; i < targets.length; i += 1) {
    const task = targets[i];
    log(`[${i + 1}/${targets.length}] ${task.label}`);
    log(`  Drive ID: ${task.driveFileId}`);
    log(`  Hajm: ${Math.round((task.size || 0) / 1048576)} MB`);
    try {
      const result = await uploadOne(task);
      results.push({ ...result, name: task.label });
      log(`  ${result.status}\n`);
    } catch (error) {
      results.push({ status: "FAIL", error: error.message, name: task.label });
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

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
const { spawn, spawnSync } = require("child_process");
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
const FORCE = args.includes("--force");
const EPISODES = args.includes("--episodes");
const limitIndex = args.indexOf("--limit");
const LIMIT = limitIndex >= 0 ? Number(args[limitIndex + 1]) || 1 : Infinity;
const seriesIndex = args.indexOf("--series");
const SERIES_FILTER = seriesIndex >= 0 ? String(args[seriesIndex + 1] || "").toLowerCase() : "";
// Bayroqlar qiymatlari (--limit N, --series "nom") SPECIFIC_ID sifatida olinmasligi kerak.
const FLAG_VALUE_INDICES = new Set();
if (limitIndex >= 0) FLAG_VALUE_INDICES.add(limitIndex + 1);
if (seriesIndex >= 0) FLAG_VALUE_INDICES.add(seriesIndex + 1);
const SPECIFIC_ID = args.find((a, i) => !a.startsWith("--") && a.length > 10 && !FLAG_VALUE_INDICES.has(i));

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

function downloadOnce(fileId, destPath) {
  return getDriveMediaResponse(fileId).then((upstream) => new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(destPath);
    const rs = Readable.fromWeb(upstream.body);
    // Manba oqimi (Drive) o'rtada uzilsa ("other side closed") 'error' hodisasi
    // ushlanmasa butun jarayon yiqiladi — shuning uchun uni ham reject qilamiz.
    rs.on("error", (err) => { ws.destroy(); reject(err); });
    ws.on("error", reject);
    ws.on("finish", resolve);
    rs.pipe(ws);
  }));
}

// Drive yuklab olish vaqtinchalik tarmoq uzilishida (UND_ERR_SOCKET) qayta urinadi.
async function downloadToFile(fileId, destPath, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await downloadOnce(fileId, destPath);
      return;
    } catch (err) {
      lastErr = err;
      try { fs.unlinkSync(destPath); } catch (_) {}
      if (i < attempts) {
        log(`    yuklab olish uzildi (urinish ${i}/${attempts}): ${err.message} — qayta urinilmoqda...`);
        await new Promise((r) => setTimeout(r, 3000 * i));
      }
    }
  }
  throw lastErr;
}

// Video oqimning kodeki va piksel formatini aniqlaydi (ffprobe).
function probeVideoStream(inputPath) {
  const res = spawnSync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,pix_fmt",
    "-of", "default=nokey=1:noprint_wrappers=1",
    inputPath,
  ], { encoding: "utf8" });
  const lines = String(res.stdout || "").trim().split(/\r?\n/);
  return {
    codec: (lines[0] || "").toLowerCase(),
    pixFmt: (lines[1] || "").toLowerCase(),
  };
}

// Har qanday video -> brauzerda ishlaydigan MP4 (H.264 8-bit + AAC).
// Manba allaqachon H.264 8-bit (yuv420p) bo'lsa video oqim copy qilinadi
// (tez, lossless). Aks holda libx264'ga re-encode qilinadi: HEVC/H.265,
// 10-bit H.264, VP9, AV1 va h.k. iPhone/Android Telegram WebView'da qora
// ekran (ovoz bor, rasm yo'q) beradi — shuning uchun copy emas, re-encode kerak.
function convertToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const { codec, pixFmt } = probeVideoStream(inputPath);
    const browserSafe = codec === "h264"
      && (pixFmt === "yuv420p" || pixFmt === "yuvj420p" || pixFmt === "");
    const reencodeArgs = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p"];

    const runFfmpeg = (videoCodecArgs, label) => {
      log(`    ffmpeg: ${label}`);
      const proc = spawn("ffmpeg", [
        "-y",
        "-i", inputPath,
        "-map", "0:v:0",
        "-map", "0:a?",
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
          runFfmpeg(reencodeArgs, "re-encode (libx264)");
        } else {
          reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-400)}`));
        }
      });
    };

    if (browserSafe) {
      runFfmpeg(["-c:v", "copy"], `video copy (h264 ${pixFmt || "8-bit"})`);
    } else {
      runFfmpeg(reencodeArgs, `re-encode (libx264, manba: ${codec || "noma'lum"} ${pixFmt || ""})`);
    }
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

// Har qanday videoni yuklab olib, brauzerga mos MP4'ga (H.264 8-bit + AAC)
// aylantirib R2'ga yuklaydi. MP4-idishli HEVC ham re-encode qilinadi.
async function migrateVideo(task) {
  const key = objectKey(task.driveFileId);
  const url = publicUrlFor(task.driveFileId);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mykino-r2-"));
  const inputPath = path.join(tmpDir, "input");
  const outputPath = path.join(tmpDir, "output.mp4");
  try {
    log(`  → yuklab olinmoqda (${Math.round((task.size || 0) / 1048576)} MB)...`);
    await downloadToFile(task.driveFileId, inputPath);
    log(`  → MP4'ga aylantirilmoqda...`);
    const method = await convertToMp4(inputPath, outputPath);
    const outSize = fs.statSync(outputPath).size;
    log(`  → R2'ga yuklanmoqda (${Math.round(outSize / 1048576)} MB, ${method})...`);
    await uploadFileToR2(key, outputPath, outSize);
    log(`  ✓ R2'ga yuklandi: ${url}`);
    await task.writeCdn(url);
    return { status: "MIGRATED", url };
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
// Har bir video yuklab olinadi, kodeki tekshiriladi va brauzerga mos MP4'ga
// aylantirib yuklanadi (H.264 8-bit bo'lsa copy, aks holda libx264 re-encode).
// --force bilan R2'da allaqachon bor faylni ham qayta konvert qiladi.
async function uploadOne(task) {
  const key = objectKey(task.driveFileId);
  const url = publicUrlFor(task.driveFileId);

  if (!FORCE && await checkExists(key)) {
    log(`  [SKIP_EXISTS] R2 da allaqachon bor: ${key}`);
    if (!task.cdnUrl) {
      log(`  [PATCH_META] cdnUrl Drive metadata'ga yoziladi...`);
      await task.writeCdn(url);
    }
    return { status: "SKIP_EXISTS", url };
  }

  return migrateVideo(task);
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
    log("  node scripts/migrate-to-r2.js --apply --force --all              # hammasini qayta konvert (HEVC -> H.264)");
    log("  node scripts/migrate-to-r2.js --apply --force --series \"nom\"     # bitta serialni qayta konvert");
    return;
  }

  // --force bilan allaqachon ko'chgan fayllarni ham qayta konvert qilish mumkin.
  const pool = FORCE ? allTasks : needsMigrate;

  let targets = [];
  if (SPECIFIC_ID) {
    const target = allTasks.find((t) => t.driveFileId === SPECIFIC_ID);
    if (!target) { log(`Topilmadi: ${SPECIFIC_ID}`); return; }
    targets = [target];
  } else if (SERIES_FILTER) {
    targets = pool.filter((t) => t.kind === "episode"
      && String(t.label || "").toLowerCase().includes(SERIES_FILTER));
    if (!targets.length) { log(`Mos serial epizodi topilmadi: "${SERIES_FILTER}"`); return; }
  } else if (EPISODES) {
    targets = pool.filter((t) => t.kind === "episode");
    if (!targets.length) { log("Serial epizodi topilmadi."); return; }
  } else if (ALL) {
    targets = pool;
  } else {
    targets = pool.slice(0, Number.isFinite(LIMIT) ? LIMIT : 1);
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

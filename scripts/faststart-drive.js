#!/usr/bin/env node
/*
 * faststart-drive.js
 *
 * Google Drive papkasidagi har bir .mp4 fayl uchun MP4 "moov" atomi
 * fayl boshida joylashganini tekshiradi. Agar moov keyinda bo'lsa
 * (faststart YO'Q), ffmpeg yordamida remux qiladi va Drive'dagi
 * faylni almashtiradi.
 *
 * Foydalanish:
 *   $env:GOOGLE_DRIVE_FOLDER_ID = "..."
 *   $env:GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 = "..."
 *   node scripts/faststart-drive.js              # faqat tekshiradi (dry-run)
 *   node scripts/faststart-drive.js --apply      # haqiqatan o'zgartiradi
 *
 * Talab: ffmpeg PATH'da bo'lishi kerak.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { Readable } = require("stream");

const {
  listDriveMovies,
  getDriveMediaResponse,
  getAccessToken,
} = require("../api/_lib/google-drive");

const APPLY = process.argv.includes("--apply");
const PROBE_BYTES = 1024 * 1024; // 1MB

function log(message) {
  process.stdout.write(`${message}\n`);
}

/** MP4 atomlarini parse qilib, "moov" "mdat" dan oldin kelganini aniqlaydi */
function inspectFaststart(buffer) {
  let offset = 0;
  let moovOffset = -1;
  let mdatOffset = -1;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "moov" && moovOffset === -1) moovOffset = offset;
    if (type === "mdat" && mdatOffset === -1) mdatOffset = offset;
    if (moovOffset !== -1 && mdatOffset !== -1) break;
    if (size === 0) break; // last box
    if (size === 1) {
      // 64-bit size — keyingisini o'qiy olmaymiz oddiy yo'l bilan
      return { moovBeforeMdat: null, moovFound: moovOffset !== -1 };
    }
    if (size < 8) return { moovBeforeMdat: null, moovFound: false };
    offset += size;
  }
  return {
    moovBeforeMdat: moovOffset !== -1 && mdatOffset !== -1
      ? moovOffset < mdatOffset
      : moovOffset !== -1 && mdatOffset === -1, // moov topildi, mdat hali yo'q = oldida
    moovFound: moovOffset !== -1,
  };
}

async function probeFile(fileId) {
  const upstream = await getDriveMediaResponse(fileId, { Range: `bytes=0-${PROBE_BYTES - 1}` });
  const arrayBuffer = await upstream.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function downloadFullFile(fileId, destPath) {
  const upstream = await getDriveMediaResponse(fileId);
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(destPath);
    Readable.fromWeb(upstream.body).pipe(ws);
    ws.on("finish", resolve);
    ws.on("error", reject);
  });
}

function runFfmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-c", "copy",
      "-movflags", "+faststart",
      outputPath,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function uploadReplaceContent(fileId, filePath, mimeType) {
  const token = await getAccessToken();
  const stat = fs.statSync(filePath);
  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&supportsAllDrives=true`;
  const stream = fs.createReadStream(filePath);
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": mimeType || "video/mp4",
      "Content-Length": String(stat.size),
    },
    body: stream,
    duplex: "half",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Drive upload xato ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json().catch(() => ({}));
}

async function processMovie(movie, tmpDir) {
  const fileId = movie.driveFileId || movie.fileId;
  const name = movie.fileName || movie.title || fileId;
  const mimeType = String(movie.mimeType || "").toLowerCase();
  const ext = (movie.fileName || "").split(".").pop()?.toLowerCase();

  if (!fileId) return { name, status: "SKIP_NO_ID" };
  if (mimeType && !mimeType.includes("mp4") && !mimeType.includes("quicktime") && ext !== "mp4" && ext !== "m4v" && ext !== "mov") {
    return { name, status: "SKIP_NOT_MP4" };
  }

  let probeBuffer;
  try {
    probeBuffer = await probeFile(fileId);
  } catch (error) {
    return { name, status: "PROBE_FAIL", error: error.message };
  }

  const { moovBeforeMdat, moovFound } = inspectFaststart(probeBuffer);
  if (moovBeforeMdat === true) return { name, status: "OK_FASTSTART" };
  if (!moovFound && moovBeforeMdat === null) {
    // moov 1MB ichida topilmadi — demak keyinda. faststart kerak
  }

  if (!APPLY) return { name, status: "NEEDS_FIX" };

  const inputPath = path.join(tmpDir, `${fileId}.in.mp4`);
  const outputPath = path.join(tmpDir, `${fileId}.out.mp4`);
  try {
    log(`  → yuklab olinmoqda: ${name}`);
    await downloadFullFile(fileId, inputPath);
    log(`  → ffmpeg faststart...`);
    await runFfmpeg(inputPath, outputPath);
    log(`  → Drive'ga yuklanmoqda...`);
    await uploadReplaceContent(fileId, outputPath, "video/mp4");
    return { name, status: "FIXED" };
  } catch (error) {
    return { name, status: "FAIL", error: error.message };
  } finally {
    try { fs.unlinkSync(inputPath); } catch (_) {}
    try { fs.unlinkSync(outputPath); } catch (_) {}
  }
}

async function main() {
  log(APPLY ? "MODE: APPLY (haqiqiy o'zgartirish)" : "MODE: dry-run (faqat tekshirish)");
  log("Drive katalogi olinmoqda...");
  const movies = await listDriveMovies();
  log(`Topildi: ${movies.length} ta video.\n`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "faststart-"));
  const results = [];
  let processed = 0;

  for (const movie of movies) {
    processed += 1;
    log(`[${processed}/${movies.length}] ${movie.fileName || movie.title}`);
    const result = await processMovie(movie, tmpDir);
    results.push(result);
    log(`  ${result.status}${result.error ? " - " + result.error : ""}\n`);
  }

  try { fs.rmdirSync(tmpDir); } catch (_) {}

  const summary = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  log("\n=== XULOSA ===");
  for (const [status, count] of Object.entries(summary)) {
    log(`  ${status}: ${count}`);
  }
  const needsFix = results.filter((r) => r.status === "NEEDS_FIX").length;
  if (needsFix > 0 && !APPLY) {
    log(`\n${needsFix} ta fayl faststart talab qiladi. Tuzatish uchun:\n  npm run faststart:apply`);
  }
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exit(1);
});

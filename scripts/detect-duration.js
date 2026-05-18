#!/usr/bin/env node
/*
 * detect-duration.js
 *
 * Har bir kino uchun davomiyligini (minutda) avtomatik aniqlaydi va
 * Drive metadata'siga `durationMinutes` qilib saqlaydi.
 *
 * Manba ustuvorligi:
 *   1) Drive'ning o'z `videoMediaMetadata.durationMillis` (bepul, network yo'q)
 *   2) `cdnUrl` (R2) — ffprobe orqali HTTP range bilan o'qiladi
 *   3) `/api/drive-stream/...` (Drive) — agar ffprobe va lokal server bo'lsa
 *
 * Talab: tizimda `ffprobe` o'rnatilgan bo'lishi kerak (ffmpeg paketi ichida).
 *   Windows: choco install ffmpeg   |   winget install Gyan.FFmpeg
 *   Linux:   apt install ffmpeg
 *
 * Foydalanish:
 *   node scripts/detect-duration.js                  # status (qaysi kinolarda yo'q)
 *   node scripts/detect-duration.js --apply <ID>     # bitta kino (driveFileId)
 *   node scripts/detect-duration.js --apply --all    # hamma yo'qotilganlar
 *   node scripts/detect-duration.js --apply --limit 10
 *   node scripts/detect-duration.js --apply --force --all  # mavjudini ham qayta hisoblash
 */

const { spawn } = require("child_process");
const {
  listDriveMovies,
  updateCatalogMovieMetadata,
} = require("../api/_lib/google-drive");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALL = args.includes("--all");
const FORCE = args.includes("--force");
const limitIndex = args.indexOf("--limit");
const LIMIT = limitIndex >= 0 ? Number(args[limitIndex + 1]) || 1 : Infinity;
const SPECIFIC_ID = args.find((a) => !a.startsWith("--") && a.length > 10);

function log(message) {
  process.stdout.write(`${message}\n`);
}

function ffprobeDurationSeconds(url) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      url,
    ]);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.stderr.on("data", (chunk) => { stderr += chunk; });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exit ${code}: ${stderr.trim() || "no output"}`));
        return;
      }
      const seconds = Number(String(stdout).trim());
      if (!Number.isFinite(seconds) || seconds <= 0) {
        reject(new Error(`ffprobe noto'g'ri davomiylik qaytardi: "${stdout.trim()}"`));
        return;
      }
      resolve(seconds);
    });
  });
}

function pickProbeUrl(movie) {
  if (movie.cdnUrl) return movie.cdnUrl;
  return "";
}

async function detectOne(movie) {
  if (movie.durationMinutes && !FORCE) {
    return { status: "SKIP_HAS", minutes: movie.durationMinutes };
  }
  const url = pickProbeUrl(movie);
  if (!url) {
    return { status: "SKIP_NO_URL" };
  }
  const seconds = await ffprobeDurationSeconds(url);
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (!APPLY) {
    return { status: "WOULD_SET", minutes };
  }
  await updateCatalogMovieMetadata(movie.driveFileId || movie.id, { durationMinutes: minutes });
  return { status: "SET", minutes };
}

async function main() {
  const movies = await listDriveMovies();
  let targets = movies;

  if (SPECIFIC_ID) {
    targets = movies.filter((m) => m.driveFileId === SPECIFIC_ID || m.id === SPECIFIC_ID);
    if (!targets.length) {
      log(`FATAL: '${SPECIFIC_ID}' ID li kino topilmadi.`);
      process.exit(1);
    }
  } else if (ALL || APPLY) {
    targets = movies.filter((m) => FORCE || !m.durationMinutes);
  }

  if (Number.isFinite(LIMIT)) targets = targets.slice(0, LIMIT);

  log(`Jami kinolar: ${movies.length}. Tekshiriladi: ${targets.length}. APPLY=${APPLY} FORCE=${FORCE}`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const movie of targets) {
    const label = `${movie.title || movie.fileName} [${movie.driveFileId || movie.id}]`;
    try {
      const result = await detectOne(movie);
      if (result.status === "SET") {
        log(`  SET  ${label} → ${result.minutes} daqiqa`);
        ok += 1;
      } else if (result.status === "WOULD_SET") {
        log(`  WOULD SET  ${label} → ${result.minutes} daqiqa`);
        ok += 1;
      } else if (result.status === "SKIP_HAS") {
        log(`  SKIP ${label} (allaqachon ${result.minutes} daqiqa)`);
        skipped += 1;
      } else if (result.status === "SKIP_NO_URL") {
        log(`  SKIP ${label} (cdnUrl yo'q — avval R2'ga ko'chiring)`);
        skipped += 1;
      }
    } catch (error) {
      log(`  FAIL ${label}: ${error.message}`);
      failed += 1;
    }
  }

  log("");
  log(`Yakun: SET=${ok}, SKIP=${skipped}, FAIL=${failed}`);
  if (!APPLY) log("Bu quruq ishga tushirish edi. Saqlash uchun --apply qo'shing.");
}

main().catch((error) => {
  log(`FATAL: ${error.message}`);
  process.exit(1);
});

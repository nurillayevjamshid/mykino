#!/usr/bin/env node
// Repoga tushib qolgan sirlarni (bot token, kalitlar, parollar) qidiradi.
//
// Repo ochiq: bu yerga yozilgan har qanday token bir necha daqiqada
// botlar tomonidan topiladi va bot nomidan spam yuborishda ishlatiladi.
// Haqiqiy qiymatlar faqat .env (gitignore), Vercel Environment Variables
// va GitHub Secrets'da turishi kerak.
//
//   node scripts/check-secrets.js            # git'dagi barcha fayllar
//   node scripts/check-secrets.js --staged   # faqat commit qilinayotganlar (pre-commit)
//
// Topilsa, 1 kodi bilan chiqadi va qiymatning faqat boshini ko'rsatadi.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const SKIP_FILES = new Set(["package-lock.json"]);
const BINARY_EXT = /\.(png|jpe?g|gif|webp|avif|ico|svg|mp4|mp3|webm|woff2?|ttf|otf|pdf|zip|gz)$/i;

const RULES = [
  { name: "Telegram bot token", re: /\b\d{8,10}:[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/g },
  { name: "Private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "Google service account key", re: /"private_key"\s*:\s*"-----BEGIN/g },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "GitHub token", re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{50,}/g },
  { name: "Vercel Blob token", re: /\bvercel_blob_rw_[A-Za-z0-9]{16,}/g },
  { name: "Parolli ulanish manzili", re: /\b(rediss?|postgres(ql)?|mongodb(\+srv)?|mysql):\/\/[^\s:"'`/@]+:[^\s"'`@]{3,}@/g },
  // .env namunalari va workflow'larda maxfiy o'zgaruvchiga haqiqiy qiymat yozilishi.
  {
    name: "Maxfiy o'zgaruvchiga qiymat yozilgan",
    re: /^[ \t]*(ADMIN_PASSWORD|ADMIN_SESSION_SECRET|TELEGRAM_WEBHOOK_SECRET|R2_SECRET_ACCESS_KEY|R2_ACCESS_KEY_ID|BLOB_READ_WRITE_TOKEN|YOUTUBE_API_KEY|GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64)[ \t]*[=:][ \t]*["']?(?!\$\{\{|your-|<|base64-encoded|ci-|test-|\$)[^\s"'#]{6,}/gm,
    onlyFiles: /(^|\/)(\.env[^/]*|[^/]*\.env\.example|[^/]*\.ya?ml)$/,
  },
];

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function listFiles(staged) {
  const out = staged
    ? git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
    : git(["ls-files", "-z"]);
  return out.split("\0").filter(Boolean);
}

function readContent(file, staged) {
  if (staged) {
    try {
      return execFileSync("git", ["show", `:${file}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
    } catch (_) {
      return null;
    }
  }
  const full = path.join(ROOT, file);
  try {
    if (fs.statSync(full).size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(full);
  } catch (_) {
    return null;
  }
}

function mask(value) {
  const v = String(value);
  return v.length <= 10 ? `${v.slice(0, 3)}…` : `${v.slice(0, 10)}…`;
}

function scan({ staged = false } = {}) {
  const findings = [];
  for (const file of listFiles(staged)) {
    if (SKIP_FILES.has(path.basename(file)) || BINARY_EXT.test(file) || file.includes("node_modules/")) continue;
    const buf = readContent(file, staged);
    if (!buf || buf.length > MAX_FILE_BYTES || buf.includes(0)) continue;
    const text = buf.toString("utf8");
    for (const rule of RULES) {
      if (rule.onlyFiles && !rule.onlyFiles.test(file)) continue;
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(text))) {
        const line = text.slice(0, m.index).split("\n").length;
        findings.push({ file, line, rule: rule.name, sample: mask(m[0].trim()) });
      }
    }
  }
  return findings;
}

if (require.main === module) {
  const staged = process.argv.includes("--staged");
  const findings = scan({ staged });
  if (!findings.length) {
    console.log("check-secrets: sir topilmadi.");
    process.exit(0);
  }
  console.error("check-secrets: repoga sir tushib qolgan!\n");
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.rule}  (${f.sample})`);
  console.error(
    "\nBu qiymatlarni fayldan olib tashlang va faqat .env / Vercel Environment Variables /" +
      "\nGitHub Secrets'da saqlang. Agar ular allaqachon push qilingan bo'lsa — ularni" +
      "\nBEKOR QILING (masalan, @BotFather → /revoke), chunki git tarixida qoladi."
  );
  process.exit(1);
}

module.exports = { scan, RULES };

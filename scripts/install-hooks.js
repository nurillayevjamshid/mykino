#!/usr/bin/env node
// npm install paytida git hook'larni (.githooks) ulaydi. Git bo'lmagan
// muhitda (masalan, Vercel build) jim o'tkazib yuboriladi.
const { execFileSync } = require("child_process");
const path = require("path");

try {
  const root = path.resolve(__dirname, "..");
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root, stdio: "ignore" });
} catch (_) {
  // git yo'q yoki repo emas — hook kerak emas.
}

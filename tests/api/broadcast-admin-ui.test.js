"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

describe("Broadcast Image Upload from Device (Admin UI & Integration)", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const adminHtml = fs.readFileSync(path.join(rootDir, "webapp/admin/index.html"), "utf8");
  const adminCss = fs.readFileSync(path.join(rootDir, "webapp/admin/admin.css"), "utf8");
  const adminJs = fs.readFileSync(path.join(rootDir, "webapp/admin/admin.js"), "utf8");

  test("webapp/admin/index.html contains broadcastUploadArea, file input, preview image, remove button, and URL input", () => {
    assert.match(adminHtml, /id="broadcastUploadArea"/, "broadcastUploadArea exists");
    assert.match(adminHtml, /id="broadcastPhotoFile"/, "broadcastPhotoFile exists");
    assert.match(adminHtml, /id="broadcastPhotoPreviewImg"/, "broadcastPhotoPreviewImg exists");
    assert.match(adminHtml, /id="broadcastPhotoRemoveBtn"/, "broadcastPhotoRemoveBtn exists");
    assert.match(adminHtml, /id="broadcastPhotoUrl"/, "broadcastPhotoUrl exists");
    assert.match(adminHtml, /id="broadcastPhotoHint"/, "broadcastPhotoHint exists");
    assert.match(adminHtml, /Qurilmadan rasm tanlash/, "upload text exists");
  });

  test("webapp/admin/admin.css has .poster-upload.broadcast-upload rule", () => {
    assert.match(adminCss, /\.poster-upload\.broadcast-upload/, ".broadcast-upload rule exists in admin.css");
  });

  test("webapp/admin/admin.js handles device photo upload, preview, and fallback", () => {
    assert.match(adminJs, /function updateBroadcastPhotoArea/, "updateBroadcastPhotoArea defined");
    assert.match(adminJs, /async function handleBroadcastPhotoFile/, "handleBroadcastPhotoFile defined");
    assert.match(adminJs, /uploadCategoryImage\(dataUrl,\s*'broadcast-'/, "uploads to storage via uploadCategoryImage");
    assert.match(adminJs, /broadcastPhotoFile/, "handles broadcastPhotoFile change");
    assert.match(adminJs, /broadcastPhotoRemoveBtn/, "handles broadcastPhotoRemoveBtn click");
    assert.match(adminJs, /broadcastUploadArea/, "handles dragover and drop on broadcastUploadArea");
    assert.match(adminJs, /broadcastSelectedDataUrl/, "manages broadcastSelectedDataUrl state");
  });

  test("webapp/admin/admin.js renders preview using either photoUrl or selected device photo", () => {
    assert.match(adminJs, /document\.getElementById\('broadcastPhotoUrl'\)\.value\.trim\(\)\s*\|\|\s*broadcastSelectedDataUrl/);
  });

  test("webapp/admin/admin.js submits broadcast with photoUrl or mediaDataUrl", () => {
    assert.match(adminJs, /mediaDataUrl\s*=\s*\(!photoUrl\s*&&\s*broadcastSelectedDataUrl\)\s*\?\s*broadcastSelectedDataUrl\s*:\s*undefined/);
  });
});

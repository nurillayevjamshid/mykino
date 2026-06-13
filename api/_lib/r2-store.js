const crypto = require("crypto");

function getR2Config() {
  const endpoint = String(process.env.R2_ENDPOINT || "").trim().replace(/\/+$/, "");
  const bucket = String(process.env.R2_BUCKET || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const publicUrl = String(process.env.R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
    const error = new Error(
      "Cloudflare R2 sozlanmagan. Vercel'da R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL ni qo'shing.",
    );
    error.statusCode = 500;
    error.code = "R2_CONFIG_MISSING";
    throw error;
  }

  return { endpoint, bucket, accessKeyId, secretAccessKey, publicUrl };
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

// Rasmni Cloudflare R2'ga (S3-mos API, SigV4 imzo) 'img/' prefiksi bilan yuklaydi.
async function uploadImageToR2(base64Data, fileNamePrefix) {
  const { endpoint, bucket, accessKeyId, secretAccessKey, publicUrl } = getR2Config();

  const base64Content = base64Data.replace(/^data:image\/[\w.+-]+;base64,/, "");
  const body = Buffer.from(base64Content, "base64");
  const mimeMatch = base64Data.match(/^data:(image\/[\w.+-]+);base64,/);
  const contentType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const key = `img/${fileNamePrefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${extension}`;

  const url = new URL(`${endpoint}/${bucket}/${key}`);
  const host = url.host;
  const region = "auto";
  const service = "s3";

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  // Faylga uniq hash bor (Date.now + randomBytes), shuning uchun immutable.
  // Cloudflare edge va brauzer rasmni 1 yilga keshlaydi -> har safar R2 origin'ga
  // urinmaydi va admin/mini app'da rasm bir marta yuklangach darrov chiqaveradi.
  const cacheControl = "public, max-age=31536000, immutable";
  const canonicalHeaders =
    `cache-control:${cacheControl}\n`
    + `content-type:${contentType}\n`
    + `host:${host}\n`
    + `x-amz-content-sha256:${payloadHash}\n`
    + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "cache-control;content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalUri = url.pathname.split("/").map(encodeURIComponent).join("/");
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Cache-Control": cacheControl,
      "Content-Type": contentType,
      Host: host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new Error(`Rasm Cloudflare R2'ga yuklanmadi (${response.status}). ${text.slice(0, 200)}`);
    error.statusCode = 502;
    error.code = "R2_UPLOAD_FAILED";
    throw error;
  }

  return { directUrl: `${publicUrl}/${key}` };
}

// === Generic SigV4 R2 helpers (JSON put/get/delete) ===
async function signedR2Request({ method, key, body = null, contentType = "application/json; charset=utf-8" }) {
  const { endpoint, bucket, accessKeyId, secretAccessKey, publicUrl } = getR2Config();
  const url = new URL(`${endpoint}/${bucket}/${key}`);
  const host = url.host;
  const region = "auto";
  const service = "s3";

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const bodyBuffer = body == null ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(body);
  const payloadHash = sha256Hex(bodyBuffer);

  const headersBase = [
    method === "PUT" ? `content-type:${contentType}` : null,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].filter(Boolean);
  const canonicalHeaders = headersBase.join("\n") + "\n";
  const signedHeaders = method === "PUT"
    ? "content-type;host;x-amz-content-sha256;x-amz-date"
    : "host;x-amz-content-sha256;x-amz-date";
  const canonicalUri = url.pathname.split("/").map(encodeURIComponent).join("/");
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    Host: host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: authorization,
  };
  if (method === "PUT") headers["Content-Type"] = contentType;

  return { url, host, method, headers, body: method === "PUT" ? bodyBuffer : undefined, publicUrl };
}

async function putJsonToR2(key, data) {
  const body = Buffer.from(JSON.stringify(data));
  const req = await signedR2Request({ method: "PUT", key, body });
  const response = await fetch(req.url, { method: "PUT", headers: req.headers, body: req.body });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new Error(`R2 PUT failed (${response.status}). ${text.slice(0, 200)}`);
    error.statusCode = 502;
    error.code = "R2_PUT_FAILED";
    throw error;
  }
  return { key, publicUrl: `${req.publicUrl}/${key}` };
}

async function getJsonFromR2(key, fallback = null) {
  const { publicUrl } = getR2Config();
  try {
    const response = await fetch(`${publicUrl}/${key}?t=${Date.now()}`, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (response.status === 404) return fallback;
    if (!response.ok) return fallback;
    const text = await response.text();
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

// Signed GET — for private R2 objects (e.g., user lists). Doesn't leak via public URL.
async function getJsonFromR2Signed(key, fallback = null) {
  try {
    const req = await signedR2Request({ method: "GET", key });
    const response = await fetch(req.url, { method: "GET", headers: req.headers });
    if (response.status === 404) return fallback;
    if (!response.ok) return fallback;
    const text = await response.text();
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

async function deleteFromR2(key) {
  const req = await signedR2Request({ method: "DELETE", key });
  const response = await fetch(req.url, { method: "DELETE", headers: req.headers });
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "");
    const error = new Error(`R2 DELETE failed (${response.status}). ${text.slice(0, 200)}`);
    error.statusCode = 502;
    error.code = "R2_DELETE_FAILED";
    throw error;
  }
  return { key };
}

// Generic binary upload to R2 (video, audio, anything). Faylga `prefixDir/`
// prefiksi qo'yiladi; contentType data URL'dan olinadi.
async function uploadFileToR2(dataUrl, fileNamePrefix, options = {}) {
  const { endpoint, bucket, accessKeyId, secretAccessKey, publicUrl } = getR2Config();
  const prefixDir = String(options.prefixDir || "file").replace(/[^a-z0-9_-]/gi, "") || "file";

  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(dataUrl || "").trim());
  if (!m) {
    const err = new Error("dataUrl (base64) noto'g'ri."); err.statusCode = 400; throw err;
  }
  const contentType = m[1] || "application/octet-stream";
  const body = Buffer.from(m[2], "base64");

  // Extension from MIME (mp4/webm/mov/...)
  const subtype = (contentType.split("/")[1] || "bin").split(";")[0].split("+")[0];
  const safeExt = (options.forceExt || subtype).replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  const safePrefix = String(fileNamePrefix || "file").replace(/[^a-z0-9._-]/gi, "").slice(0, 60) || "file";
  const key = `${prefixDir}/${safePrefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${safeExt}`;

  const url = new URL(`${endpoint}/${bucket}/${key}`);
  const host = url.host;
  const region = "auto";
  const service = "s3";

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  // Cache-Control: Cloudflare edge va brauzerga kinoni 1 yilga keshlash ruxsati.
  // Faylga uniq hash qo'shilgan (Date.now() + randomBytes), shuning uchun immutable
  // — kino segmentlari edge'da qoladi, har range so'rovi R2 origin'ga bormaydi.
  const cacheControl = "public, max-age=31536000, immutable";
  const canonicalHeaders =
    `cache-control:${cacheControl}\n`
    + `content-type:${contentType}\n`
    + `host:${host}\n`
    + `x-amz-content-sha256:${payloadHash}\n`
    + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "cache-control;content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalUri = url.pathname.split("/").map(encodeURIComponent).join("/");
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Cache-Control": cacheControl,
      "Content-Type": contentType,
      Host: host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new Error(`R2'ga yuklanmadi (${response.status}). ${text.slice(0, 200)}`);
    error.statusCode = 502;
    error.code = "R2_UPLOAD_FAILED";
    throw error;
  }

  return { directUrl: `${publicUrl}/${key}`, key, contentType, size: body.length };
}

module.exports = { uploadImageToR2, uploadFileToR2, putJsonToR2, getJsonFromR2, getJsonFromR2Signed, deleteFromR2 };

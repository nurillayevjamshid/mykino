const BLOB_API_BASE = "https://blob.vercel-storage.com";

function getBlobToken() {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!token) {
    const error = new Error("Vercel Blob Storage tokeni (BLOB_READ_WRITE_TOKEN) topilmadi.");
    error.statusCode = 500;
    error.code = "BLOB_TOKEN_MISSING";
    throw error;
  }
  return token;
}

async function findBlobUrl(pathname) {
  const token = getBlobToken();
  const url = new URL(BLOB_API_BASE);
  url.searchParams.set("prefix", pathname);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-version": "7",
    },
  });
  if (!response.ok) return "";
  const payload = await response.json().catch(() => null);
  const match = (payload?.blobs || []).find((b) => b.pathname === pathname);
  return match?.url || "";
}

async function readBlobJson(pathname, fallback = null) {
  try {
    const blobUrl = await findBlobUrl(pathname);
    if (!blobUrl) return fallback;
    const response = await fetch(blobUrl, { cache: "no-store" });
    if (!response.ok) return fallback;
    const text = await response.text();
    if (!text) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// Strict variant for read-modify-write flows: "blob genuinely absent" returns
// null, but a failed list/fetch/parse throws. Without this, a transient Blob
// API error reads as an empty file and the caller's write-back wipes the list.
async function readBlobJsonStrict(pathname) {
  const token = getBlobToken();
  const url = new URL(BLOB_API_BASE);
  url.searchParams.set("prefix", pathname);
  url.searchParams.set("limit", "1");
  const listResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-version": "7",
    },
  });
  if (!listResponse.ok) {
    const error = new Error(`Vercel Blob list failed (${listResponse.status}).`);
    error.statusCode = 502;
    error.code = "BLOB_LIST_FAILED";
    throw error;
  }
  const payload = await listResponse.json().catch(() => null);
  if (!payload) {
    const error = new Error("Vercel Blob list javobi o'qilmadi.");
    error.statusCode = 502;
    error.code = "BLOB_LIST_FAILED";
    throw error;
  }
  const match = (payload.blobs || []).find((b) => b.pathname === pathname);
  if (!match?.url) return null; // blob genuinely doesn't exist yet
  const response = await fetch(match.url, { cache: "no-store" });
  if (!response.ok) {
    const error = new Error(`Vercel Blob GET failed (${response.status}).`);
    error.statusCode = 502;
    error.code = "BLOB_GET_FAILED";
    throw error;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function writeBlobJson(pathname, data) {
  const token = getBlobToken();
  const url = new URL(`${BLOB_API_BASE}/${pathname.replace(/^\/+/, "")}`);
  url.searchParams.set("addRandomSuffix", "0");
  url.searchParams.set("allowOverwrite", "1");
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-version": "7",
      "Content-Type": "application/json",
      "x-content-type": "application/json",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "1",
    },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.url) {
    const error = new Error(payload?.error?.message || "Vercel Blob saqlanmadi.");
    error.statusCode = response.status || 502;
    error.code = "BLOB_WRITE_FAILED";
    throw error;
  }
  return payload;
}

module.exports = {
  readBlobJson,
  readBlobJsonStrict,
  writeBlobJson,
};

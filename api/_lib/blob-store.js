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
  writeBlobJson,
};

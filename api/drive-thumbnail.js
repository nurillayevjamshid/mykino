const { LOGO_POSTER_URL, getAccessToken, getDriveFileMetadata, setCors } = require("./_lib/google-drive");

function getFileId(request) {
  return String(request.query?.fileId || request.query?.id || "").trim();
}

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET ishlaydi." });
    return;
  }

  try {
    const fileId = getFileId(request);
    if (!fileId) {
      response.writeHead(307, { Location: LOGO_POSTER_URL });
      response.end();
      return;
    }

    const metadata = await getDriveFileMetadata(fileId, "id,name,thumbnailLink");
    if (!metadata.thumbnailLink) {
      response.writeHead(307, { Location: LOGO_POSTER_URL });
      response.end();
      return;
    }

    const token = await getAccessToken();
    const upstream = await fetch(metadata.thumbnailLink, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!upstream.ok) {
      response.writeHead(307, { Location: LOGO_POSTER_URL });
      response.end();
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
    response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, immutable");
    response.status(200).end(buffer);
  } catch {
    response.writeHead(307, { Location: LOGO_POSTER_URL });
    response.end();
  }
};

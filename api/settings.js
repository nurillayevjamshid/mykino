const { setCors, readCatalogMetadata, writeCatalogMetadata } = require("./_lib/google-drive");

module.exports = async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  try {
    const metadataState = await readCatalogMetadata();
    const settings = metadataState.data.settings || {};

    if (request.method === "GET") {
      response.status(200).json({ splashImageUrl: settings.splashImageUrl || "" });
      return;
    }

    if (request.method === "POST") {
      let body;
      if (typeof request.body === "string") {
        body = JSON.parse(request.body);
      } else {
        body = request.body || {};
      }

      // Update settings in metadata
      metadataState.data.settings = { ...settings, ...body };
      await writeCatalogMetadata(metadataState.data, metadataState.file);

      response.status(200).json({ ok: true, splashImageUrl: metadataState.data.settings.splashImageUrl });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    response.status(500).json({ ok: false, error: err.message });
  }
};

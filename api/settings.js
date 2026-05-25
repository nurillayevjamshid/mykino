const {
  getDriveConfig,
  getDriveFileMetadata,
  isServiceAccountStorageQuotaError,
  setCors,
  readCatalogMetadata,
  updateDriveFileMetadata,
  writeCatalogMetadata,
} = require("./_lib/google-drive");

const SETTINGS_META_START = "[MY_KINO_SETTINGS]";
const SETTINGS_META_END = "[/MY_KINO_SETTINGS]";
const DRIVE_DESCRIPTION_MAX_LENGTH = 28000;

async function readRequestBody(request) {
  if (request.body && Buffer.isBuffer(request.body)) {
    return JSON.parse(request.body.toString("utf8"));
  }

  if (request.body && typeof request.body === "string") {
    return JSON.parse(request.body);
  }

  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
  }

  return raw ? JSON.parse(raw) : {};
}

function trimString(value) {
  return String(value || "").trim();
}

function normalizeRawUrl(value) {
  const raw = trimString(value).replace(/^["']+|["']+$/g, "");
  const protocolMatch = raw.match(/https?:\/\/.+/i);
  return protocolMatch ? protocolMatch[0].trim() : raw;
}

function normalizePublicImageUrl(value) {
  const raw = normalizeRawUrl(value);
  if (!raw) return "";
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^(?:[a-z0-9-]+\.)*(?:public\.)?blob\.vercel-storage\.com\//i.test(raw)) {
    return `https://${raw}`;
  }
  if (raw.startsWith("/")) return raw;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    const error = new Error("Rasm URL noto'g'ri. Vercel Blob'dan olingan https linkni kiriting.");
    error.statusCode = 400;
    throw error;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const error = new Error("Rasm URL faqat http yoki https bo'lishi kerak.");
    error.statusCode = 400;
    throw error;
  }

  return parsed.href;
}

function readStoredPublicImageUrl(value) {
  try {
    return normalizePublicImageUrl(value);
  } catch {
    return "";
  }
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function extractFolderSettings(description) {
  const rawDescription = String(description || "");
  const startIndex = rawDescription.indexOf(SETTINGS_META_START);
  const endIndex = rawDescription.indexOf(SETTINGS_META_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return {};

  const jsonText = rawDescription
    .slice(startIndex + SETTINGS_META_START.length, endIndex)
    .trim();

  try {
    const parsed = JSON.parse(jsonText);
    const settings = parsed?.settings && typeof parsed.settings === "object" ? parsed.settings : parsed;
    return settings && typeof settings === "object" ? settings : {};
  } catch {
    return {};
  }
}

function buildFolderDescriptionWithSettings(description, settings) {
  const rawDescription = String(description || "");
  const block = [
    SETTINGS_META_START,
    JSON.stringify({ version: 1, settings }),
    SETTINGS_META_END,
  ].join("\n");
  const startIndex = rawDescription.indexOf(SETTINGS_META_START);
  const endIndex = rawDescription.indexOf(SETTINGS_META_END);
  const hasExistingBlock = startIndex !== -1 && endIndex !== -1 && endIndex > startIndex;
  const prefix = hasExistingBlock ? rawDescription.slice(0, startIndex).trimEnd() : rawDescription.trimEnd();
  const suffix = hasExistingBlock ? rawDescription.slice(endIndex + SETTINGS_META_END.length).trimStart() : "";
  const nextDescription = [prefix, block, suffix].filter(Boolean).join("\n\n");

  if (nextDescription.length > DRIVE_DESCRIPTION_MAX_LENGTH) {
    const error = new Error("Sozlamalarni Drive papka descriptioniga saqlash uchun joy yetmadi.");
    error.statusCode = 400;
    throw error;
  }

  return nextDescription;
}

async function readFolderSettings() {
  const { folderId } = getDriveConfig();
  const folder = await getDriveFileMetadata(folderId, "id,name,description");
  return extractFolderSettings(folder.description);
}

async function writeFolderSettings(nextSettings) {
  const { folderId } = getDriveConfig();
  const folder = await getDriveFileMetadata(folderId, "id,name,description");
  const currentSettings = extractFolderSettings(folder.description);
  const settings = { ...currentSettings, ...nextSettings };
  const description = buildFolderDescriptionWithSettings(folder.description, settings);

  await updateDriveFileMetadata(
    folderId,
    { description },
    "id,name,description,modifiedTime",
  );

  return settings;
}

function normalizeAdLinkUrl(value) {
  const raw = trimString(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:" && parsed.protocol !== "tg:") {
      return "";
    }
    return parsed.href;
  } catch {
    return "";
  }
}

function normalizeAd(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: Boolean(source.enabled),
    imageUrl: readStoredPublicImageUrl(source.imageUrl),
    linkUrl: normalizeAdLinkUrl(source.linkUrl),
    buttonText: trimString(source.buttonText).slice(0, 40),
  };
}

async function readPersistedSettings(settings) {
  if (hasOwn(settings, "splashImageUrl") || hasOwn(settings, "ad")) {
    return {
      splashImageUrl: readStoredPublicImageUrl(settings.splashImageUrl),
      ad: normalizeAd(settings.ad),
    };
  }

  try {
    const folderSettings = await readFolderSettings();
    return {
      splashImageUrl: readStoredPublicImageUrl(folderSettings.splashImageUrl),
      ad: normalizeAd(folderSettings.ad),
    };
  } catch {
    return { splashImageUrl: "", ad: normalizeAd(null) };
  }
}

module.exports = async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method === "GET") {
    // CDN'da 30s kesh + 5 daqiqa SWR. Settings tez-tez o'zgarmaydi.
    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=300");
  } else {
    response.setHeader("Cache-Control", "no-store, max-age=0");
  }

  try {
    const metadataState = await readCatalogMetadata();
    const settings = metadataState.data.settings || {};

    if (request.method === "GET") {
      response.status(200).json(await readPersistedSettings(settings));
      return;
    }

    if (request.method === "POST") {
      const body = await readRequestBody(request);
      const nextSettings = { ...settings };

      if (hasOwn(body, "splashImageUrl")) {
        nextSettings.splashImageUrl = normalizePublicImageUrl(body.splashImageUrl || "");
      }

      if (hasOwn(body, "ad")) {
        const incomingAd = body.ad && typeof body.ad === "object" ? body.ad : {};
        nextSettings.ad = {
          enabled: Boolean(incomingAd.enabled),
          imageUrl: incomingAd.imageUrl ? normalizePublicImageUrl(incomingAd.imageUrl) : "",
          linkUrl: normalizeAdLinkUrl(incomingAd.linkUrl || ""),
          buttonText: trimString(incomingAd.buttonText).slice(0, 40),
        };
      }

      metadataState.data.settings = nextSettings;
      try {
        await writeCatalogMetadata(metadataState.data, metadataState.file);
      } catch (error) {
        if (!isServiceAccountStorageQuotaError(error)) {
          throw error;
        }

        await writeFolderSettings(metadataState.data.settings);
      }

      response.status(200).json({
        ok: true,
        splashImageUrl: nextSettings.splashImageUrl || "",
        ad: normalizeAd(nextSettings.ad),
      });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    response.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
};

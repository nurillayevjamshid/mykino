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

async function readPersistedSettings(settings) {
  if (hasOwn(settings, "splashImageUrl")) {
    return { splashImageUrl: readStoredPublicImageUrl(settings.splashImageUrl) };
  }

  try {
    const folderSettings = await readFolderSettings();
    return { splashImageUrl: readStoredPublicImageUrl(folderSettings.splashImageUrl) };
  } catch {
    return { splashImageUrl: "" };
  }
}

module.exports = async function handler(request, response) {
  setCors(response);
  response.setHeader("Cache-Control", "no-store, max-age=0");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
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
      const splashImageUrl = normalizePublicImageUrl(body.splashImageUrl || "");

      // Update settings in metadata
      metadataState.data.settings = { ...settings, splashImageUrl };
      try {
        await writeCatalogMetadata(metadataState.data, metadataState.file);
      } catch (error) {
        if (!isServiceAccountStorageQuotaError(error)) {
          throw error;
        }

        await writeFolderSettings(metadataState.data.settings);
      }

      response.status(200).json({ ok: true, splashImageUrl });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    response.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
};

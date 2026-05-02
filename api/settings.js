const fs = require("fs");
const path = require("path");
const { setCors } = require("./_lib/google-drive");

const SETTINGS_PATH = path.join(__dirname, "..", "data", "settings.json");

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  } catch {
    return { splashImageUrl: "" };
  }
}

function writeSettings(data) {
  const current = readSettings();
  const merged = { ...current, ...data };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

module.exports = async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method === "GET") {
    const settings = readSettings();
    response.status(200).json(settings);
    return;
  }

  if (request.method === "POST") {
    try {
      const body = request.body || {};
      const updated = writeSettings(body);
      response.status(200).json({ ok: true, ...updated });
    } catch (err) {
      response.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  response.status(405).json({ ok: false, error: "Method not allowed" });
};

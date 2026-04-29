function parseAdminIds() {
  const raw = String(process.env.ADMIN_IDS || "679291909").trim();
  return new Set(
    raw
      .split(",")
      .map((value) => Number(String(value).trim()))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
}

function resolveAdminId(request, payload = {}) {
  const headerValue = request.headers["x-admin-id"];
  const queryValue = request.query?.adminId;
  const bodyValue = payload?.adminId;
  const value = bodyValue ?? queryValue ?? headerValue;
  const adminId = Number(value);
  return Number.isFinite(adminId) ? adminId : 0;
}

function ensureAdmin(request, response, payload = {}) {
  const adminId = resolveAdminId(request, payload);
  const adminIds = parseAdminIds();
  if (!adminIds.has(adminId)) {
    response.status(403).json({
      ok: false,
      code: "ADMIN_REQUIRED",
      error: "Bu endpoint faqat admin uchun.",
    });
    return null;
  }
  return adminId;
}

module.exports = {
  ensureAdmin,
  parseAdminIds,
  resolveAdminId,
};

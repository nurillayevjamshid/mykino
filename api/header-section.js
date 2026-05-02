const { setCors } = require("./_lib/google-drive");

module.exports = async function handler(request, response) {
  setCors(response);
  response.status(410).json({
    ok: false,
    code: "FEATURE_DISABLED",
    error: "Header section feature has been removed.",
  });
};

// Minimal mock for Vercel @vercel/node handler signature.
// Vercel passes (req, res) where res has setHeader / status(...).json / status(...).send / end.
function createMockRes() {
  const res = {
    headers: {},
    statusCode: 200,
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
    removeHeader(name) {
      delete this.headers[name];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.headers["Content-Type"] =
        this.headers["Content-Type"] || "application/json; charset=utf-8";
      this.ended = true;
      return this;
    },
    send(payload) {
      this.body = payload;
      if (typeof payload === "string" && this.headers["Content-Type"] && this.headers["Content-Type"].includes("application/json")) {
        try {
          this.body = JSON.parse(payload);
        } catch (_) {}
      }
      this.ended = true;
      return this;
    },
    end(payload) {
      if (payload !== undefined) this.body = payload;
      this.ended = true;
      return this;
    },
  };
  return res;
}

function createMockReq({
  method = "GET",
  url = "/",
  query = {},
  headers = {},
  body = null,
} = {}) {
  // Vercel gives Node's IncomingMessage, which has a Symbol.asyncIterator body stream.
  // We only need to satisfy the shape our handlers actually touch.
  const req = {
    method,
    url,
    query,
    headers,
    body,
    async *[Symbol.asyncIterator]() {
      // not used by our handlers, but present to be safe
    },
  };
  return req;
}

module.exports = { createMockReq, createMockRes };

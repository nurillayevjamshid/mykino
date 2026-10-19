const fs = require("fs");
const path = require("path");

const BOOKS_FILE = path.join(process.cwd(), "data", "books.json");

function readBooks() {
  const candidates = [
    path.join(process.cwd(), "data", "books.json"),
    path.join(process.cwd(), "webapp", "books", "books.json"),
    path.join(__dirname, "..", "..", "data", "books.json"),
    path.join(__dirname, "..", "data", "books.json"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (_) {}
  }
  return [];
}

async function handleBooksRequest(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  const books = readBooks();
  const query = String(request.query?.q || "").trim().toLowerCase();
  const genre = String(request.query?.genre || "").trim().toLowerCase();
  const id = String(request.query?.id || "").trim();

  let filtered = books;

  if (id) {
    const book = filtered.find((b) => String(b.id) === id);
    if (!book) {
      response.status(404).json({ ok: false, error: "Audio kitob topilmadi" });
      return;
    }
    response.status(200).json({ ok: true, book });
    return;
  }

  if (genre && genre !== "barchasi") {
    filtered = filtered.filter((b) => String(b.genre || "").toLowerCase().includes(genre));
  }

  if (query) {
    filtered = filtered.filter((b) => {
      const t = String(b.title || "").toLowerCase();
      const a = String(b.author || "").toLowerCase();
      const n = String(b.narrator || "").toLowerCase();
      const g = String(b.genre || "").toLowerCase();
      return t.includes(query) || a.includes(query) || n.includes(query) || g.includes(query);
    });
  }

  response.status(200).json({ ok: true, count: filtered.length, total: books.length, books: filtered });
}

module.exports = {
  handleBooksRequest,
  readBooks,
};

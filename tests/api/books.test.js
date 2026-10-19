"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { createMockReq, createMockRes } = require("../helpers/mock-http");
const { handleBooksRequest, readBooks } = require("../../api/_lib/books");

describe("api/_lib/books.js", () => {
  test("readBooks returns list of audiobooks from data/books.json", () => {
    const books = readBooks();
    assert.ok(Array.isArray(books));
    assert.ok(books.length > 0);

    // Verify all books have required fields from image 2
    for (const b of books) {
      assert.ok(b.id, "Kitob ID bo'lishi shart");
      assert.ok(b.title, "Kitob nomi bo'lishi shart");
      assert.ok(b.author, "Muallif nomi bo'lishi shart");
      assert.ok(b.genre, "Janr bo'lishi shart");
      assert.ok(b.size, "Hajmi bo'lishi shart");
      assert.ok(b.duration, "Vaqti bo'lishi shart");
      assert.ok(b.narrator, "O'qigan inson nomi bo'lishi shart");
    }
  });

  test("OPTIONS returns 204 with CORS headers", async () => {
    const req = createMockReq({ method: "OPTIONS" });
    const res = createMockRes();

    await handleBooksRequest(req, res);
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
    assert.equal(res.ended, true);
  });

  test("GET returns all audiobooks", async () => {
    const req = createMockReq({ method: "GET" });
    const res = createMockRes();

    await handleBooksRequest(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.books));
    assert.ok(res.body.books.length > 0);
    assert.equal(res.body.count, res.body.books.length);
  });

  test("GET with q parameter filters books", async () => {
    const req = createMockReq({ method: "GET", query: { q: "Qor" } });
    const res = createMockRes();

    await handleBooksRequest(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.books.length > 0);
    assert.ok(res.body.books.some((b) => b.title.includes("Qor")));
  });

  test("GET with genre parameter filters books", async () => {
    const req = createMockReq({ method: "GET", query: { genre: "Hikoya" } });
    const res = createMockRes();

    await handleBooksRequest(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.books.length > 0);
    for (const b of res.body.books) {
      assert.ok(b.genre.toLowerCase().includes("hikoya"));
    }
  });

  test("GET with id parameter returns specific book", async () => {
    const req = createMockReq({ method: "GET", query: { id: "7457" } });
    const res = createMockRes();

    await handleBooksRequest(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.book.id, "7457");
    assert.equal(res.body.book.title, "Qor qo‘ynida lola");
  });
});

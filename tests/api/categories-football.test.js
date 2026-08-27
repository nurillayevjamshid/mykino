const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createMockReq, createMockRes } = require("../helpers/mock-http");

const LEAGUES = [
  ["eng.1", "APL"],
  ["esp.1", "La Liga"],
  ["ger.1", "Bundesliga"],
  ["ita.1", "A Serie"],
  ["fra.1", "Liga 1"],
  ["ksa.1", "Saudi Liga"],
  ["uefa.champions", "UCL"],
  ["uefa.europa", "Yevropa Ligasi"],
  ["uefa.europa.conf", "Konferensiyalar Ligasi"],
];

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function scoreboardPayload(slug, name) {
  return {
    leagues: [{ name, logos: [{ href: `https://cdn.example.com/${slug}.png`, rel: ["full"] }] }],
    events: [{
      id: `event-${slug}`,
      date: "2026-08-27T18:30:00Z",
      competitions: [{
        startDate: "2026-08-27T18:30:00Z",
        status: { type: { state: "pre", completed: false, name: "STATUS_SCHEDULED" } },
        competitors: [
          { homeAway: "home", score: "", team: { displayName: `${name} Home`, logo: `https://cdn.example.com/${slug}-home.png` } },
          { homeAway: "away", score: "", team: { displayName: `${name} Away`, logo: `https://cdn.example.com/${slug}-away.png` } },
        ],
      }],
    }],
  };
}

function standingsPayload(slug) {
  return {
    children: [{
      name: `${slug} table`,
      standings: { entries: [{
        note: { rank: 1 },
        team: { displayName: "Real Madrid", logos: [{ href: "https://cdn.example.com/real.png" }] },
        stats: [
          { name: "gamesPlayed", value: 2 },
          { name: "wins", value: 2 },
          { name: "ties", value: 0 },
          { name: "losses", value: 0 },
          { name: "pointsFor", value: 5 },
          { name: "pointsAgainst", value: 1 },
          { name: "pointDifferential", value: 4 },
          { name: "points", value: 6 },
        ],
      }] },
    }],
  };
}

describe("api/categories.js football leagues", () => {
  let originalFetch;
  let handler;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    delete require.cache[require.resolve("../../api/categories.js")];
    handler = require("../../api/categories.js");
    globalThis.fetch = async (url) => {
      const value = String(url);
      const slug = LEAGUES.find(([id]) => value.includes(`/soccer/${id}/`))?.[0];
      if (value.includes("/scoreboard?dates=")) {
        const name = LEAGUES.find(([id]) => id === slug)?.[1] || "Liga";
        return jsonResponse(scoreboardPayload(slug, name));
      }
      if (value.includes("/standings")) return jsonResponse(standingsPayload(slug));
      throw new Error(`Unexpected URL: ${value}`);
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns all requested leagues with Tashkent kickoff time and selected standings", async () => {
    const req = createMockReq({ method: "GET", url: "/api/categories?type=fifa&date=2026-08-27&league=esp.1" });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.leagues.length, 9);
    assert.equal(res.body.matches.length, 9);
    assert.equal(res.body.date, "2026-08-27");
    assert.equal(res.body.timeZone, "Asia/Tashkent");
    assert.equal(res.body.matches.every((match) => match.time === "23:30"), true);
    assert.equal(res.body.matches.every((match) => match.home.logo.includes("-home.png")), true);
    assert.equal(res.body.standings.leagueId, "esp.1");
    assert.equal(res.body.standings.rows[0].team, "Real Madrid");
    assert.equal(res.body.standings.rows[0].pts, 6);
    assert.equal(res.body.standings.rows[0].logo, "https://cdn.example.com/real.png");
  });
});

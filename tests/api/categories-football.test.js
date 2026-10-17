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

function summaryPayload(eventId, isLive = false) {
  return {
    header: {
      competitions: [{
        status: {
          type: {
            state: isLive ? "in" : "post",
            completed: !isLive,
            name: isLive ? "STATUS_IN_PROGRESS" : "STATUS_FULL_TIME",
            description: isLive ? "In Progress" : "Full Time",
          },
          displayClock: isLive ? "68'" : "90'",
        },
        competitors: [
          { id: "101", homeAway: "home", score: "2", team: { displayName: "Real Madrid", logo: "https://cdn.example.com/real.png" } },
          { id: "102", homeAway: "away", score: "1", team: { displayName: "Barcelona", logo: "https://cdn.example.com/barca.png" } },
        ],
      }],
    },
    keyEvents: [
      {
        id: "goal-1",
        type: { type: "goal", text: "Goal" },
        clock: { displayValue: "24'" },
        scoringPlay: true,
        team: { id: "101", displayName: "Real Madrid" },
        participants: [
          { athlete: { displayName: "Vinícius Júnior" } },
          { athlete: { displayName: "Jude Bellingham" } },
        ],
        text: "Goal! Real Madrid 1, Barcelona 0. Vinícius Júnior.",
      },
      {
        id: "card-1",
        type: { type: "yellow-card", text: "Yellow Card" },
        clock: { displayValue: "41'" },
        team: { id: "102", displayName: "Barcelona" },
        participants: [
          { athlete: { displayName: "Gavi" } },
        ],
      },
    ],
    boxscore: {
      teams: [
        {
          homeAway: "home",
          team: { displayName: "Real Madrid" },
          statistics: [
            { name: "possession", displayValue: "54%" },
            { name: "shots", displayValue: "14" },
            { name: "shotsOnTarget", displayValue: "6" },
            { name: "corners", displayValue: "5" },
            { name: "fouls", displayValue: "9" },
          ],
        },
        {
          homeAway: "away",
          team: { displayName: "Barcelona" },
          statistics: [
            { name: "possession", displayValue: "46%" },
            { name: "shots", displayValue: "10" },
            { name: "shotsOnTarget", displayValue: "3" },
            { name: "corners", displayValue: "3" },
            { name: "fouls", displayValue: "12" },
          ],
        },
      ],
    },
    rosters: [
      {
        team: { id: "101" },
        formation: "4-3-3",
        roster: [
          { athlete: { displayName: "Courtois" }, position: { abbreviation: "GK" }, starter: true, jersey: 1 },
          { athlete: { displayName: "Carvajal" }, position: { abbreviation: "RB" }, starter: true, jersey: 2 },
          { athlete: { displayName: "Modric" }, position: { abbreviation: "CM" }, starter: false, jersey: 10 },
        ],
      },
      {
        team: { id: "102" },
        formation: "4-3-3",
        roster: [
          { athlete: { displayName: "Ter Stegen" }, position: { abbreviation: "GK" }, starter: true, jersey: 1 },
          { athlete: { displayName: "Koundé" }, position: { abbreviation: "RB" }, starter: true, jersey: 23 },
          { athlete: { displayName: "Pedri" }, position: { abbreviation: "CM" }, starter: false, jersey: 8 },
        ],
      },
    ],
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
      if (value.includes("/summary?event=")) {
        const isLive = value.includes("event=live-");
        return jsonResponse(summaryPayload("event-1", isLive));
      }
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

  test("returns match details with events, statistics, and rosters via fifa-lineup endpoint", async () => {
    const req = createMockReq({ method: "GET", url: "/api/categories?type=fifa-lineup&eventId=match-101&league=esp.1" });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.found, true);
    assert.equal(res.body.status, "finished");
    assert.equal(res.body.score, "2 : 1");
    assert.equal(res.body.events.length, 2);
    assert.equal(res.body.events[0].type, "goal");
    assert.equal(res.body.events[0].minute, "24'");
    assert.equal(res.body.events[0].player, "Vinícius Júnior");
    assert.equal(res.body.events[0].assist, "Jude Bellingham");
    assert.equal(res.body.events[1].type, "yellow-card");
    assert.equal(res.body.events[1].player, "Gavi");
    assert.equal(res.body.statistics.length, 5);
    assert.equal(res.body.statistics[0].key, "possession");
    assert.equal(res.body.statistics[0].home, "54%");
    assert.equal(res.body.statistics[0].away, "46%");
    assert.equal(res.body.home.name, "Real Madrid");
    assert.equal(res.body.home.starting.length, 2);
    assert.equal(res.body.home.subs.length, 1);
    assert.equal(res.body.away.name, "Barcelona");
    assert.equal(res.body.away.starting.length, 2);
    assert.equal(res.body.away.subs.length, 1);
  });

  test("returns live match state and minute when game is ongoing", async () => {
    const req = createMockReq({ method: "GET", url: "/api/categories?type=fifa-lineup&eventId=live-999&league=esp.1" });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.status, "live");
    assert.equal(res.body.minute, "68'");
    assert.equal(res.body.score, "2 : 1");
    assert.match(res.headers["Cache-Control"], /s-maxage=60/);
  });

  test("caches past and future matches with 30-60 min s-maxage and serves HIT", async () => {
    // 1) Past match (e.g. 2026-01-01)
    const reqPast1 = createMockReq({ method: "GET", url: "/api/categories?type=fifa&date=2026-01-01&league=esp.1" });
    const resPast1 = createMockRes();
    await handler(reqPast1, resPast1);
    assert.equal(resPast1.statusCode, 200);
    assert.match(resPast1.headers["Cache-Control"], /s-maxage=3600/);

    const reqPast2 = createMockReq({ method: "GET", url: "/api/categories?type=fifa&date=2026-01-01&league=esp.1" });
    const resPast2 = createMockRes();
    await handler(reqPast2, resPast2);
    assert.equal(resPast2.statusCode, 200);
    assert.equal(resPast2.headers["X-Football-Cache"], "HIT");

    // 2) Future match (e.g. 2026-12-31)
    const reqFuture1 = createMockReq({ method: "GET", url: "/api/categories?type=fifa&date=2026-12-31&league=esp.1" });
    const resFuture1 = createMockRes();
    await handler(reqFuture1, resFuture1);
    assert.equal(resFuture1.statusCode, 200);
    assert.match(resFuture1.headers["Cache-Control"], /s-maxage=2700/);

    const reqFuture2 = createMockReq({ method: "GET", url: "/api/categories?type=fifa&date=2026-12-31&league=esp.1" });
    const resFuture2 = createMockRes();
    await handler(reqFuture2, resFuture2);
    assert.equal(resFuture2.statusCode, 200);
    assert.equal(resFuture2.headers["X-Football-Cache"], "HIT");
  });

  test("caches live lineup with 60s s-maxage and serves HIT on repeat", async () => {
    const req1 = createMockReq({ method: "GET", url: "/api/categories?type=fifa-lineup&eventId=live-777&league=esp.1" });
    const res1 = createMockRes();
    await handler(req1, res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.status, "live");
    assert.match(res1.headers["Cache-Control"], /s-maxage=60/);

    const req2 = createMockReq({ method: "GET", url: "/api/categories?type=fifa-lineup&eventId=live-777&league=esp.1" });
    const res2 = createMockRes();
    await handler(req2, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.headers["X-Fifa-Lineup-Cache"], "HIT");
  });

  test("coalesces concurrent requests so external fetch is only called once (single-flight)", async () => {
    let fetchCount = 0;
    const prevFetch = globalThis.fetch;
    globalThis.fetch = async (...args) => {
      fetchCount += 1;
      await new Promise((r) => setTimeout(r, 20)); // network delay
      return prevFetch(...args);
    };

    // 5 concurrent requests for same new date
    const dateKey = "2026-05-15";
    const requests = Array.from({ length: 5 }, () => {
      const req = createMockReq({ method: "GET", url: `/api/categories?type=fifa&date=${dateKey}&league=esp.1` });
      const res = createMockRes();
      return handler(req, res).then(() => res);
    });

    const responses = await Promise.all(requests);
    responses.forEach((res) => assert.equal(res.statusCode, 200));

    // Without single-flight, 5 requests would trigger 5 * (9 leagues * 2 dates + 1 standings) = ~95 fetches!
    // With single-flight, only 1 wave of fetches (19 fetches) is executed!
    assert.ok(fetchCount <= 20, `Fetch count was ${fetchCount}, expected single wave <= 20`);
  });
});

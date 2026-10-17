const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseArgs,
  calculateStats,
  runConcurrentLoad,
  createLocalTestServer,
  runAllLoadTests,
} = require("../../scripts/load-test");

test("Automated Load Testing Suite", async (t) => {
  await t.test("1. parseArgs parses CLI arguments correctly", () => {
    const opts = parseArgs(["--concurrency", "75", "--requests", "150", "--url", "https://example.com", "--report"]);
    assert.equal(opts.concurrency, 75);
    assert.equal(opts.requests, 150);
    assert.equal(opts.targetUrl, "https://example.com");
    assert.equal(opts.markdownReport, true);
  });

  await t.test("2. calculateStats accurately computes percentiles and RPS", () => {
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const stats = calculateStats(latencies, 500, { "200": 10 }, 0);

    assert.equal(stats.total, 10);
    assert.equal(stats.success, 10);
    assert.equal(stats.failed, 0);
    assert.equal(stats.successRate, 100);
    assert.equal(stats.min, 10);
    assert.equal(stats.max, 100);
    assert.equal(stats.avg, 55);
    assert.equal(stats.p50, 60); // index 5
    assert.ok(stats.p95 >= 90);
    assert.equal(stats.rps, 20); // 10 reqs / 0.5s = 20 req/s
  });

  await t.test("3. Local test server handles parallel requests with 50 concurrency", async () => {
    const server = await createLocalTestServer();
    try {
      const stats = await runConcurrentLoad({
        url: `${server.baseUrl}/api/movies?page=1&limit=5`,
        concurrency: 25,
        totalRequests: 50,
      });

      assert.equal(stats.total, 50);
      assert.equal(stats.failed, 0);
      assert.equal(stats.successRate, 100);
      assert.ok(stats.avg > 0);
      assert.ok(stats.rps > 0);
    } finally {
      await server.close();
    }
  });

  await t.test("4. runAllLoadTests executes 50 parallel requests across all endpoints", async () => {
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => {
      const urlStr = String(url || "");
      if (urlStr.includes("site.api.espn.com")) {
        return new Response(JSON.stringify({
          leagues: [{ name: "APL", logos: [] }],
          events: [],
          header: { competitions: [{ status: { type: { state: "pre" } }, competitors: [] }] },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return origFetch(url, opts);
    };

    try {
      // 50 parallel requests, 50 requests per endpoint
      const result = await runAllLoadTests({
        concurrency: 50,
        requests: 50,
        markdownReport: false,
      });

      assert.equal(result.results.length, 4);
      assert.equal(result.totalAll, 200); // 4 endpoints * 50 requests
      assert.equal(result.totalFailed, 0);
      assert.equal(result.overallSuccessRate, 100);

      for (const r of result.results) {
        assert.equal(r.stats.failed, 0);
        assert.ok(r.stats.rps > 0);
        assert.ok(r.stats.avg < 1500, `Latency too high: ${r.stats.avg}ms`);
      }
    } finally {
      global.fetch = origFetch;
    }
  });
});

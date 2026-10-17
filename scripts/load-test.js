#!/usr/bin/env node
// Automated Load & Stress Testing Script for MyKino API Endpoints
// Tests:
//   1. Kinolar ro'yxati: /api/movies
//   2. Musiqa ro'yxati: /api/music
//   3. Futbol o'yinlari ro'yxati: /api/categories?type=fifa
//   4. Futbol Modal oynasi (tarkiblar, statistika): /api/categories?type=fifa-lineup
//
// Sends 50-100 parallel concurrent requests and prints a performance / latency report.

const http = require("http");
const { performance } = require("perf_hooks");
const path = require("path");
const fs = require("fs");

// Default configuration
const DEFAULT_CONCURRENCY = 50;
const DEFAULT_REQUESTS = 100;
const DEFAULT_ORIGIN = "https://www.myplaylist.uz";

function parseArgs(args = process.argv.slice(2)) {
  const options = {
    concurrency: DEFAULT_CONCURRENCY,
    requests: DEFAULT_REQUESTS,
    targetUrl: "",
    markdownReport: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--concurrency" || arg === "-c") {
      options.concurrency = parseInt(args[++i], 10) || DEFAULT_CONCURRENCY;
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = parseInt(arg.split("=")[1], 10) || DEFAULT_CONCURRENCY;
    } else if (arg === "--requests" || arg === "-n") {
      options.requests = parseInt(args[++i], 10) || DEFAULT_REQUESTS;
    } else if (arg.startsWith("--requests=")) {
      options.requests = parseInt(arg.split("=")[1], 10) || DEFAULT_REQUESTS;
    } else if (arg === "--url" || arg === "-u") {
      options.targetUrl = args[++i] || "";
    } else if (arg.startsWith("--url=")) {
      options.targetUrl = arg.split("=")[1] || "";
    } else if (arg === "--report" || arg === "--markdown") {
      options.markdownReport = true;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    }
  }

  if (!options.targetUrl && process.env.BASE_URL) {
    options.targetUrl = process.env.BASE_URL;
  }

  return options;
}

/**
 * Hisoblash funksiyalari (p50, p95, p99, o'rtacha)
 */
function calculateStats(latencies, totalDurationMs, statusCodes, errorCount) {
  const success = latencies.length;
  const allReqs = success + errorCount;
  if (!allReqs) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      successRate: 0,
      rps: 0,
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      statusCodes,
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const totalSuccess = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);

  const getPercentile = (p) => {
    if (!totalSuccess) return 0;
    const idx = Math.min(Math.floor((p / 100) * totalSuccess), totalSuccess - 1);
    return sorted[idx];
  };

  const durationSec = totalDurationMs > 0 ? totalDurationMs / 1000 : 0.001;
  const rps = Math.round(allReqs / durationSec);

  return {
    total: allReqs,
    success,
    failed: errorCount,
    successRate: Number(((success / allReqs) * 100).toFixed(1)),
    rps,
    min: totalSuccess ? Number(sorted[0].toFixed(1)) : 0,
    max: totalSuccess ? Number(sorted[totalSuccess - 1].toFixed(1)) : 0,
    avg: totalSuccess ? Number((sum / totalSuccess).toFixed(1)) : 0,
    p50: Number(getPercentile(50).toFixed(1)),
    p95: Number(getPercentile(95).toFixed(1)),
    p99: Number(getPercentile(99).toFixed(1)),
    statusCodes,
  };
}

/**
 * Parallel so'rovlar havuzini (concurrency pool) ishga tushirish
 */
async function runConcurrentLoad({ url, headers = {}, concurrency = 50, totalRequests = 100 }) {
  let dispatched = 0;
  let errorCount = 0;
  const latencies = [];
  const statusCodes = {};

  const startTime = performance.now();

  async function worker(workerId) {
    const clientIp = `192.168.1.${(workerId % 250) + 1}`;
    while (true) {
      if (dispatched >= totalRequests) break;
      dispatched++;

      const reqStart = performance.now();
      try {
        const resp = await fetch(url, {
          headers: {
            Origin: DEFAULT_ORIGIN,
            "User-Agent": "MyKino-LoadTest/1.0",
            "X-Forwarded-For": clientIp,
            ...headers,
          },
        });
        const latency = performance.now() - reqStart;

        const code = String(resp.status);
        statusCodes[code] = (statusCodes[code] || 0) + 1;

        if (resp.ok || resp.status === 304) {
          latencies.push(latency);
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
        statusCodes["ERR"] = (statusCodes["ERR"] || 0) + 1;
      }
    }
  }

  const workers = [];
  const activeConcurrency = Math.min(concurrency, totalRequests);
  for (let i = 0; i < activeConcurrency; i++) {
    workers.push(worker(i));
  }

  await Promise.all(workers);
  const totalDurationMs = performance.now() - startTime;

  return calculateStats(latencies, totalDurationMs, statusCodes, errorCount);
}

/**
 * Lokal serverless API handlerlarni o'rab turuvchi HTTP test server
 */
function createLocalTestServer() {
  const moviesHandler = require("../api/movies");
  const musicHandler = require("../api/music");
  const categoriesHandler = require("../api/categories");

  const server = http.createServer(async (req, res) => {
    // Vercel serverless helperlarni emulate qilish
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    req.query = Object.fromEntries(parsedUrl.searchParams.entries());

    res.status = function (code) {
      res.statusCode = code;
      return res;
    };
    res.json = function (obj) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(obj));
      return res;
    };
    res.send = function (data) {
      res.end(data);
      return res;
    };

    try {
      if (parsedUrl.pathname.startsWith("/api/movies")) {
        await moviesHandler(req, res);
      } else if (parsedUrl.pathname.startsWith("/api/music")) {
        await musicHandler(req, res);
      } else if (parsedUrl.pathname.startsWith("/api/categories")) {
        await categoriesHandler(req, res);
      } else {
        res.status(404).json({ ok: false, error: "Not Found" });
      }
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: err.message });
      }
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const baseUrl = `http://127.0.0.1:${port}`;
      resolve({
        baseUrl,
        close: () => new Promise((cb) => server.close(cb)),
      });
    });
  });
}

/**
 * Asosiy test sinovlari
 */
async function runAllLoadTests(options = {}) {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    requests = DEFAULT_REQUESTS,
    targetUrl = "",
    markdownReport = false,
  } = options;

  let localServer = null;
  let baseUrl = targetUrl;

  if (!baseUrl) {
    console.log(`\n⏳ Lokal test server ishga tushirilmoqda (In-process Vercel mock)...`);
    localServer = await createLocalTestServer();
    baseUrl = localServer.baseUrl;
  }

  console.log(`\n========================================================================================`);
  console.log(`🚀 MYKINO API YUKLAMA VA STRESS TESTI (Load & Stress Test)`);
  console.log(`========================================================================================`);
  console.log(`🎯 Nishon URL:         ${baseUrl}`);
  console.log(`⚡ Bir vaqtdagi oqim:  ${concurrency} ta parallel so'rov (Concurrency)`);
  console.log(`📦 Jami so'rovlar:     Har bir endpoint uchun ${requests} ta`);
  console.log(`========================================================================================\n`);

  const endpoints = [
    {
      name: "🎬 Kinolar ro'yxati (/api/movies)",
      path: "/api/movies?page=1&limit=24",
    },
    {
      name: "🎵 Musiqa ro'yxati (/api/music)",
      path: "/api/music?page=1&limit=20",
    },
    {
      name: "⚽ Futbol o'yinlari (/api/categories?type=fifa)",
      path: "/api/categories?type=fifa",
    },
    {
      name: "📊 Futbol Modal oynasi (/fifa-lineup)",
      path: "/api/categories?type=fifa-lineup&home=Arsenal&away=Chelsea",
    },
  ];

  const results = [];

  for (const ep of endpoints) {
    process.stdout.write(`⏳ Sinovdan o'tkazilmoqda: ${ep.name}... `);
    const fullUrl = `${baseUrl}${ep.path}`;
    const stats = await runConcurrentLoad({
      url: fullUrl,
      concurrency,
      totalRequests: requests,
    });
    results.push({ ...ep, stats });
    console.log(`Tayyor! (O'rtacha: ${stats.avg}ms | RPS: ${stats.rps} req/s)`);
  }

  if (localServer) {
    await localServer.close();
  }

  // Format ASCII Table
  console.log(`\n` + "=".repeat(98));
  console.log(`📊 YAKUNIY NATIJALAR HISOBOTI (LOAD TEST SUMMARY)`);
  console.log("=".repeat(98));
  console.log(
    `Endpoint`.padEnd(38) +
    `Muvaffaqiyat`.padEnd(16) +
    `O'rtacha`.padEnd(10) +
    `p50`.padEnd(9) +
    `p95`.padEnd(9) +
    `p99`.padEnd(9) +
    `RPS`
  );
  console.log("-".repeat(98));

  let totalSuccessful = 0;
  let totalFailed = 0;

  for (const r of results) {
    const s = r.stats;
    totalSuccessful += s.success;
    totalFailed += s.failed;

    const nameCol = r.name.padEnd(38);
    const successCol = `${s.success}/${s.total} (${s.successRate}%)`.padEnd(16);
    const avgCol = `${s.avg}ms`.padEnd(10);
    const p50Col = `${s.p50}ms`.padEnd(9);
    const p95Col = `${s.p95}ms`.padEnd(9);
    const p99Col = `${s.p99}ms`.padEnd(9);
    const rpsCol = `${s.rps} req/s`;

    console.log(`${nameCol}${successCol}${avgCol}${p50Col}${p95Col}${p99Col}${rpsCol}`);
  }

  console.log("=".repeat(98));

  const totalAll = totalSuccessful + totalFailed;
  const overallSuccessRate = totalAll > 0 ? ((totalSuccessful / totalAll) * 100).toFixed(1) : "0";

  if (totalFailed === 0) {
    console.log(`\n✅ NATIJA: Barcha ${totalAll} ta so'rov 100% muvaffaqiyatli va xatosiz bajarildi!`);
    console.log(`💡 Kesh va parallel processing so'rovlarni bir necha millisoniyada qaytarmoqda.\n`);
  } else {
    console.log(`\n⚠️ NATIJA: ${totalFailed} ta so'rovda xatolik yuz berdi (${overallSuccessRate}% muvaffaqiyatli).\n`);
  }

  if (markdownReport) {
    generateMarkdownReport(results, options, baseUrl);
  }

  return {
    results,
    totalAll,
    totalSuccessful,
    totalFailed,
    overallSuccessRate: Number(overallSuccessRate),
  };
}

function generateMarkdownReport(results, options, baseUrl) {
  const reportPath = path.join(process.cwd(), "load-test-report.md");
  let md = `# 🚀 MyKino API Load Test Hisoboti\n\n`;
  md += `- **Sana:** ${new Date().toISOString()}\n`;
  md += `- **Nishon server:** \`${baseUrl}\`\n`;
  md += `- **Parallel oqimlar (Concurrency):** ${options.concurrency}\n`;
  md += `- **Har bir endpoint uchun so'rovlar:** ${options.requests}\n\n`;

  md += `| Endpoint | Muvaffaqiyat | O'rtacha | p50 (Median) | p95 | p99 | Throughput (RPS) |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const r of results) {
    const s = r.stats;
    md += `| **${r.name}** | ${s.success}/${s.total} (${s.successRate}%) | ${s.avg}ms | ${s.p50}ms | ${s.p95}ms | ${s.p99}ms | **${s.rps} req/s** |\n`;
  }

  md += `\n### Status Kodlari Taqsimoti\n\n`;
  for (const r of results) {
    md += `- **${r.name}:** \`${JSON.stringify(r.stats.statusCodes)}\`\n`;
  }

  fs.writeFileSync(reportPath, md, "utf8");
  console.log(`📄 Markdown hisobot fayli saqlandi: ${reportPath}`);
}

// CLI orqali to'g'ridan-to'g'ri ishga tushirilganda
if (require.main === module) {
  const options = parseArgs();
  runAllLoadTests(options).catch((err) => {
    console.error("Load testda kutilmagan xatolik:", err);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  calculateStats,
  runConcurrentLoad,
  createLocalTestServer,
  runAllLoadTests,
};

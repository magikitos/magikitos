"use strict";
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const rate of [1, 4]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.route("**/*", (r) =>
      ["127.0.0.1", "magikitos.ddev.site"].includes(
        new URL(r.request().url()).hostname,
      )
        ? r.continue()
        : r.abort(),
    );
    await page.addInitScript(() => {
      localStorage.setItem(
        "magikitos.adventure",
        JSON.stringify({ flags: {  }, muted: true }),
      );
      window.tasks = [];
      new PerformanceObserver((l) =>
        tasks.push(
          ...l
            .getEntries()
            .map((e) => ({ start: e.startTime, duration: e.duration })),
        ),
      ).observe({ type: "longtask", buffered: true });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const started = Date.now();
    await page.goto("http://127.0.0.1:47834/bosque/explorar");
    await require("./browser-entry.cjs").enterWorld(page);
    const ready = Date.now() - started;
    await page.waitForTimeout(400);
    await page.mouse.move(720, 450);
    for (let n = 0; n < 4; n++) await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(400);
    const results = await page.evaluate(() => ({
      tasks,
      resources: performance
        .getEntriesByType("resource")
        .filter((e) => e.name.includes("/assets/aventura/"))
        .map((e) => ({
          path: new URL(e.name).pathname,
          bytes: e.transferSize,
          duration: e.duration,
        })),
      state: {
        ...MagikitosAdventure.inspect(),
        entities: undefined,
        neighbors: undefined,
        needs: undefined,
        flags: undefined,
      },
    }));
    console.log(
      JSON.stringify(
        {
          cpu: rate,
          readyMs: ready,
          longTasks: results.tasks,
          assetRequests: results.resources.length,
          assetTransferBytes: results.resources.reduce(
            (n, e) => n + e.bytes,
            0,
          ),
          chunks: results.state.chunkCount,
        },
        null,
        2,
      ),
    );
    await page.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

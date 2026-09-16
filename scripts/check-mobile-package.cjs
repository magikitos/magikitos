"use strict";
// This verifies the bundled web payload, NOT an iOS simulator or Android binary.
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright");
const root = path.resolve("apps/mobile/www");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
};
const server = http.createServer((req, res) => {
  const target = path.resolve(
    root,
    "." +
      new URL(req.url, "http://localhost").pathname.replace(
        /\/$/,
        "/index.html",
      ),
  );
  if (
    !target.startsWith(root + path.sep) ||
    !fs.existsSync(target) ||
    !fs.statSync(target).isFile()
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": types[path.extname(target)] || "application/octet-stream",
  });
  fs.createReadStream(target).pipe(res);
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    await page.addInitScript(() => {
      if (!localStorage.getItem("magikitos.locale"))
        localStorage.setItem("magikitos.locale", "es");
    });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    console.log("PASS local mobile launcher served");
    await page.waitForURL("**/es/index.html");
    await require("./browser-entry.cjs").enterWorld(page);
    const config = await page
      .locator("#adventure-config")
      .textContent()
      .then(JSON.parse);
    assert.equal(new URL(config.apiBase).protocol, "https:");
    assert.equal(Object.keys(config.routes).length, 6);
    assert(!require("../apps/mobile/capacitor.config.json").server?.url);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      390,
    );
    await page.locator("#self-toggle").tap();
    await page.locator("#world-language").selectOption("/en/index.html");
    await page.waitForURL("**/en/index.html");
    await require("./browser-entry.cjs").enterWorld(page);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("magikitos.locale")),
      "en",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS native web payload: offline entry, locale launcher, local assets/routes and remote JSON-only API boundary (not a native-device test)",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});

"use strict";
/** Static game server. Only JSON APIs and public media can reach the optional local website. */
const http = require("node:http"),
  https = require("node:https"),
  fs = require("node:fs"),
  path = require("node:path");
const { build, out } = require("./build.cjs");
const { ROUTES } = require("./page.cjs");
const web = new URL(process.env.WEB_ORIGIN || "https://magikitos.ddev.site");
if (
  !["http:", "https:"].includes(web.protocol) ||
  web.username ||
  web.password ||
  (!["127.0.0.1", "localhost"].includes(web.hostname) &&
    !web.hostname.endsWith(".ddev.site"))
)
  throw Error("WEB_ORIGIN must be local");
const port = Number(process.env.GAME_PORT || 47834),
  origin = "http://127.0.0.1:" + port,
  offline = process.argv.includes("--offline");
if (!process.argv.includes("--no-build")) build();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".mp3": "audio/mpeg",
};
function send(res, status, body, type = "text/plain") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex,nofollow",
  });
  res.end(body);
}
function serve(req, res, rel) {
  let file;
  try {
    file = fs.realpathSync(path.resolve(out, rel));
  } catch (_) {
    send(res, 404, "Not found");
    return;
  }
  if (
    !file.startsWith(fs.realpathSync(out) + path.sep) ||
    !fs.statSync(file).isFile()
  ) {
    send(res, 404, "Not found");
    return;
  }
  const size = fs.statSync(file).size;
  const headers = {
    "Content-Type": types[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  const start = range ? Number(range[1]) : 0;
  const end = range && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
  if (req.headers.range && (!range || start > end || start >= size)) {
    res.writeHead(416, { ...headers, "Content-Range": "bytes */" + size });
    res.end();
    return;
  }
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  res.writeHead(range ? 206 : 200, { ...headers, "Content-Length": end - start + 1 });
  if (req.method === "HEAD") res.end();
  else fs.createReadStream(file, { start, end }).pipe(res);
}
function proxy(req, res, url, api) {
  if (offline) {
    send(
      res,
      api ? 503 : 404,
      api ? JSON.stringify({ ok: false, error: "offline" }) : "Unavailable",
      api ? "application/json" : "text/plain",
    );
    return;
  }
  const headers = { ...req.headers, host: web.host };
  delete headers["accept-encoding"];
  if (headers.origin) headers.origin = web.origin;
  const client = web.protocol === "https:" ? https : http;
  const upstream = client.request(
    new URL(url, web),
    { method: req.method, headers, rejectUnauthorized: false },
    (response) => {
      if (
        api &&
        !String(response.headers["content-type"]).includes(
          "application/json",
        ) &&
        response.statusCode !== 204
      ) {
        response.resume();
        send(
          res,
          502,
          JSON.stringify({ ok: false, error: "invalid_api_response" }),
          "application/json",
        );
        return;
      }
      const reply = {
        ...response.headers,
        "cache-control": "no-store",
        "x-robots-tag": "noindex,nofollow",
      };
      delete reply["transfer-encoding"];
      delete reply["content-length"];
      if (headers.origin) reply["access-control-allow-origin"] = origin;
      res.writeHead(response.statusCode, reply);
      response.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent)
      send(
        res,
        502,
        JSON.stringify({ ok: false, error: "local_api_unavailable" }),
        "application/json",
      );
    else res.destroy();
  });
  upstream.setTimeout(15000, () =>
    upstream.destroy(Error("Local API timeout")),
  );
  req.pipe(upstream);
}
http
  .createServer((req, res) => {
    try {
      const url = new URL(req.url, origin);
      if (req.headers.host !== new URL(origin).host || url.origin !== origin) {
        send(res, 403, "Local host only");
        return;
      }
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        req.headers.origin !== origin
      ) {
        send(res, 403, "Same-origin writes only");
        return;
      }
      if (url.pathname.startsWith("/api/world/")) {
        proxy(req, res, url.pathname + url.search, true);
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        send(res, 405, "Method not allowed");
        return;
      }
      const locale = Object.keys(ROUTES).find(
        (lang) => ROUTES[lang] === url.pathname,
      );
      if (locale) {
        const { id } = JSON.parse(
          fs.readFileSync(path.join(out, "current.json")),
        );
        serve(req, res, "releases/" + id + "/pages/" + locale + ".html");
        return;
      }
      const asset = url.pathname.match(
        /^\/game\/releases\/([a-f0-9]{20})\/(assets\/[^?#]+)$/,
      );
      if (asset) {
        serve(req, res, "releases/" + asset[1] + "/" + asset[2]);
        return;
      }
      if (url.pathname === "/") {
        res.writeHead(302, { Location: ROUTES.es });
        res.end();
        return;
      }
      if (url.pathname === "/service-worker.js") {
        send(
          res,
          200,
          'self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));',
          "text/javascript",
        );
        return;
      }
      if (/^\/assets\/(images|audios)\//.test(url.pathname)) {
        proxy(req, res, url.pathname + url.search, false);
        return;
      }
      // A deliberate website navigation leaves the game; never fetch or embed that page.
      if (
        offline ||
        /^\/(game|assets|api|\.local|tools)(\/|$)/.test(url.pathname)
      ) {
        send(res, 404, "Not found");
        return;
      }
      res.writeHead(302, {
        Location: new URL(url.pathname + url.search, web).href,
      });
      res.end();
    } catch (error) {
      send(res, 500, "Local game: " + error.message);
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(
      "Static game: " +
        origin +
        ROUTES.es +
        (offline
          ? " — no website connection"
          : " — local JSON API: " + web.origin),
    ),
  );

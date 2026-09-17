"use strict";
/** Loopback-only studio. The only writable targets are its own workspace and recovery history. */
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { snapshot } = require("./snapshot.cjs"),
  { WorkspaceStore } = require("./workspace.cjs"),
  { build } = require("./build.cjs");
const ROOT = path.resolve(__dirname, "../.."),
  LOCAL = process.env.STUDIO_DATA_DIR
    ? path.resolve(process.env.STUDIO_DATA_DIR)
    : path.join(ROOT, ".local/adventure-studio");
const PORT = Number(process.env.STUDIO_PORT || 47832),
  ORIGIN = "http://127.0.0.1:" + PORT,
  TOKEN = crypto.randomBytes(24).toString("hex");
const store = new WorkspaceStore(LOCAL);
require("node:child_process").execFileSync(
  process.env.STUDIO_PHP || "php",
  [path.join(ROOT, "scripts/bake-adventure-atlas.php"), "--studio"],
  { stdio: "inherit" },
);
build(ROOT, path.join(LOCAL, "build"));
let current;
function refresh() {
  current = snapshot(ROOT);
  store.archive(current);
}
refresh();
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
};
const send = (res, status, data) => {
  res.writeHead(status, {
    ...headers,
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
};
async function body(req) {
  let size = 0,
    chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw Error("Ajustes demasiado grandes");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
function file(res, req, root, relative) {
  const resolved = fs.realpathSync(path.resolve(root, relative)),
    safe = fs.realpathSync(root);
  if (!resolved.startsWith(safe + path.sep) || !fs.statSync(resolved).isFile())
    throw Error("Archivo no permitido");
  const types = {
    ".js": "text/javascript",
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".avif": "image/avif",
    ".ogg": "audio/ogg",
    ".woff2": "font/woff2",
  };
  const size = fs.statSync(resolved).size,
    range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  let start = 0,
    end = size - 1,
    status = 200,
    extra = {};
  if (range) {
    start = +range[1];
    end = range[2] ? Math.min(+range[2], end) : end;
    if (start > end) {
      res.writeHead(416, headers);
      res.end();
      return;
    }
    status = 206;
    extra["Content-Range"] = "bytes " + start + "-" + end + "/" + size;
  }
  res.writeHead(status, {
    ...headers,
    ...extra,
    "Content-Type": types[path.extname(resolved)] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = fs.createReadStream(resolved, { start, end });
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== new URL(ORIGIN).host) {
      send(res, 403, { error: "Solo loopback" });
      return;
    }
    const url = new URL(req.url, ORIGIN),
      p = decodeURIComponent(url.pathname);
    if (req.headers.origin && req.headers.origin !== ORIGIN) {
      send(res, 403, { error: "Origen no permitido" });
      return;
    }
    if (req.method === "POST" && p === "/api/workspace") {
      if (
        req.headers.origin !== ORIGIN ||
        req.headers["x-studio-token"] !== TOKEN ||
        !req.headers["content-type"]?.startsWith("application/json")
      ) {
        send(res, 403, { error: "Solicitud de studio requerida" });
        return;
      }
      refresh();
      store.load(current);
      send(res, 200, store.save(await body(req)));
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      send(res, 405, { error: "Método no permitido" });
      return;
    }
    if (p === "/api/context") {
      refresh();
      // Los nombres van del snapshot VIVO y no del archivado: el archivo se guarda por su
      // `baseHash`, que resume el mundo y el arte, no los textos, así que un nombre corregido
      // hoy seguiría enseñándose viejo hasta que cambiara el mapa. Y no forman parte de ninguna
      // propuesta: son cómo se llama cada pantalla en la pantalla.
      send(res, 200, {
        ...store.load(current),
        nombres: current.nombres,
        token: TOKEN,
      });
      return;
    }
    if (p === "/api/workspace") {
      refresh();
      send(res, 200, store.load(current));
      return;
    }
    if (p === "/api/diff") {
      refresh();
      const loaded = store.load(current);
      send(res, 200, { ...store.diff(), conflicts: loaded.conflicts });
      return;
    }
    if (p.startsWith("/studio-art/")) {
      file(
        res,
        req,
        path.join(ROOT, ".local/adventure-studio/art"),
        p.slice(12),
      );
      return;
    }
    if (p === "/") {
      file(res, req, path.join(__dirname, "public"), "index.html");
      return;
    }
    if (p === "/studio.js") {
      file(res, req, path.join(LOCAL, "build"), "studio.js");
      return;
    }
    if (p.startsWith("/assets/fonts/")) {
      file(res, req, path.join(ROOT, "public/assets/fonts"), p.slice(14));
      return;
    }
    if (p.startsWith("/assets/aventura/")) {
      file(
        res,
        req,
        path.join(ROOT, "public/assets/aventura"),
        p.slice("/assets/aventura/".length),
      );
      return;
    }
    file(res, req, path.join(__dirname, "public"), p.slice(1));
  } catch (error) {
    if (!res.headersSent)
      send(res, error.status || 400, {
        error:
          error.code === "ENOENT" ? "No existe en el studio" : error.message,
      });
    else res.destroy();
  }
});
server.listen(PORT, "127.0.0.1", () =>
  console.log(
    "Magikitos Studio: " +
      ORIGIN +
      "\nVersión del estudio: " +
      store.file +
      "\nSin endpoint para escribir escenas del juego.",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close());

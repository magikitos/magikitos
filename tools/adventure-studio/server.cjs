"use strict";
/** Loopback-only studio. The only writable targets are its own drafts and snapshot archive. */
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { snapshot, hash } = require("./snapshot.cjs"),
  { validateChanges, diff } = require("./draft"),
  { build } = require("./build.cjs");
const ROOT = path.resolve(__dirname, "../.."),
  LOCAL = process.env.STUDIO_DATA_DIR
    ? path.resolve(process.env.STUDIO_DATA_DIR)
    : path.join(ROOT, ".local/adventure-studio");
const PORT = Number(process.env.STUDIO_PORT || 47832),
  ORIGIN = "http://127.0.0.1:" + PORT,
  TOKEN = crypto.randomBytes(24).toString("hex");
const DRAFTS = path.join(LOCAL, "drafts"),
  SNAPSHOTS = path.join(LOCAL, "snapshots");
for (const dir of [DRAFTS, SNAPSHOTS]) fs.mkdirSync(dir, { recursive: true });
build(ROOT, path.join(LOCAL, "build"));
let current;
function refresh() {
  current = snapshot(ROOT);
  const archived = path.join(SNAPSHOTS, current.baseHash + ".json");
  if (!fs.existsSync(archived))
    fs.writeFileSync(archived, JSON.stringify(current), {
      flag: "wx",
      mode: 0o600,
    });
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
const validId = (id) =>
  typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,70}$/.test(id);
function saved(id) {
  if (!validId(id)) throw Error("Nombre inválido");
  const file = path.join(DRAFTS, id + ".json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}
function base(hashValue) {
  if (!/^[a-f0-9]{64}$/.test(hashValue)) throw Error("Base inválida");
  return JSON.parse(
    fs.readFileSync(path.join(SNAPSHOTS, hashValue + ".json"), "utf8"),
  );
}
async function body(req) {
  let size = 0,
    chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw Error("Borrador demasiado grande");
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
    if (req.method === "POST" && p === "/api/drafts") {
      if (
        req.headers.origin !== ORIGIN ||
        req.headers["x-studio-token"] !== TOKEN ||
        !req.headers["content-type"]?.startsWith("application/json")
      ) {
        send(res, 403, { error: "Solicitud de studio requerida" });
        return;
      }
      const input = await body(req);
      if (!validId(input.id)) throw Error("Nombre inválido");
      const previous = saved(input.id);
      if ((previous?.revision ?? 0) !== input.revision) {
        send(res, 409, {
          error:
            "Otra pestaña ha guardado este borrador. Recarga o guárdalo con otro nombre.",
        });
        return;
      }
      const source = base(input.baseHash),
        changes = validateChanges(source, input.changes);
      const draft = {
        id: input.id,
        name: String(input.name || input.id).slice(0, 100),
        baseHash: source.baseHash,
        revision: (previous?.revision || 0) + 1,
        updatedAt: new Date().toISOString(),
        changes,
      };
      const target = path.join(DRAFTS, input.id + ".json"),
        temp = target + "." + crypto.randomBytes(6).toString("hex") + ".tmp";
      fs.writeFileSync(temp, JSON.stringify(draft, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      if (previous) {
        const history = path.join(DRAFTS, input.id + "-history");
        fs.mkdirSync(history, { recursive: true });
        fs.copyFileSync(
          target,
          path.join(history, previous.revision + ".json"),
        );
      }
      fs.renameSync(temp, target);
      send(res, 200, draft);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      send(res, 405, { error: "Método no permitido" });
      return;
    }
    if (p === "/api/context") {
      refresh();
      send(res, 200, { snapshot: current, token: TOKEN });
      return;
    }
    if (p === "/api/drafts") {
      send(res, 200, {
        drafts: fs
          .readdirSync(DRAFTS)
          .filter((f) => f.endsWith(".json"))
          .map((f) => saved(f.slice(0, -5)))
          .map(({ id, name, updatedAt, baseHash, revision }) => ({
            id,
            name,
            updatedAt,
            baseHash,
            revision,
          })),
      });
      return;
    }
    if (p.startsWith("/api/drafts/")) {
      const id = p.slice("/api/drafts/".length),
        draft = saved(id);
      if (!draft) {
        send(res, 404, { error: "No existe el borrador" });
        return;
      }
      const source = base(draft.baseHash);
      if (url.searchParams.has("export")) {
        send(res, 200, {
          purpose: "review-only",
          baseHash: source.baseHash,
          draft: draft.name,
          scenes: diff(source, draft.changes),
        });
        return;
      }
      send(res, 200, {
        draft,
        snapshot: source,
        stale: source.baseHash !== current.baseHash,
      });
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
      file(res, req, path.join(ROOT, "public/assets/aventura"), p.slice(17));
      return;
    }
    if (p.startsWith("/ui/")) {
      file(
        res,
        req,
        path.join(LOCAL, "ui-lab/public"),
        p.slice(4) || "index.html",
      );
      return;
    }
    if (p.startsWith("/sprites/")) {
      file(res, req, path.join(LOCAL, "ui-lab/public/sprites"), p.slice(9));
      return;
    }
    if (p.startsWith("/media/")) {
      file(res, req, path.join(LOCAL, "ui-lab/public/media"), p.slice(7));
      return;
    }
    if (["/lab.js", "/lab.css", "/data.json"].includes(p)) {
      file(res, req, path.join(LOCAL, "ui-lab/public"), p.slice(1));
      return;
    }
    file(res, req, path.join(__dirname, "public"), p.slice(1));
  } catch (error) {
    if (!res.headersSent)
      send(res, 400, {
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
      "\nBorradores: " +
      DRAFTS +
      "\nSin endpoint para escribir escenas del juego.",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close());

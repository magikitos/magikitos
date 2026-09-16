"use strict";
/** Package the same verified game; native owns no second world or renderer. */
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process");
const { build, root } = require("./build.cjs"),
  { verify } = require("./artifact.cjs"),
  { page, ROUTES } = require("./page.cjs");
const mobile = path.join(root, "apps/mobile"),
  www = path.join(mobile, "www");
const website = new URL(
  process.env.MOBILE_WEBSITE_ORIGIN || "https://magikitos.com/",
);
if (
  website.protocol !== "https:" ||
  website.username ||
  website.password ||
  website.pathname !== "/"
)
  throw Error("MOBILE_WEBSITE_ORIGIN must be an HTTPS origin");
const release = build({ reuseArt: true }),
  id = path.basename(release);
verify(release, id);
// This exact generated directory contains no editable source or user data.
if (fs.existsSync(www)) fs.rmSync(www, { recursive: true });
const prefix = "/game/releases/" + id;
fs.mkdirSync(path.join(www, "game/releases", id), { recursive: true });
fs.cpSync(
  path.join(release, "assets"),
  path.join(www, "game/releases", id, "assets"),
  { recursive: true },
);
const nativeRoutes = Object.fromEntries(
  Object.keys(ROUTES).map((lang) => [lang, `/${lang}/index.html`]),
);
for (const lang of Object.keys(ROUTES)) {
  const html = fs.readFileSync(
    path.join(release, "pages", lang + ".html"),
    "utf8",
  );
  const match = html.match(
    /<script[^>]*\bid="adventure-config"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) throw Error("Missing static configuration");
  const config = {
    ...JSON.parse(match[1]),
    routes: nativeRoutes,
    apiBase: new URL("api/world/", website).href,
    websiteBase: website.href,
    baseUrl: nativeRoutes[lang],
  };
  const target = path.join(www, lang, "index.html");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    page(config, prefix).replace(
      '<script src="' + prefix,
      '<script src="/native-platform.js" defer></script>\n    <script src="' +
        prefix,
    ),
  );
}
const esbuild = require("./adventure-studio/build.cjs").esbuild(root);
for (const name of ["platform", "launch"])
  cp.execFileSync(
    esbuild,
    [
      path.join(mobile, "src", name + ".js"),
      "--bundle",
      "--minify",
      "--target=es2022",
      "--outfile=" + path.join(www, "native-" + name + ".js"),
    ],
    { stdio: "inherit" },
  );
fs.copyFileSync(
  path.join(mobile, "src/index.html"),
  path.join(www, "index.html"),
);
fs.writeFileSync(
  path.join(www, "build.json"),
  JSON.stringify({
    artifact: id,
    nativeVersion: require(path.join(mobile, "package.json")).version,
    website: website.href,
  }) + "\n",
);
console.log(
  "Bundled mobile game: " + www + " (six locales, no remote server.url)",
);

"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const registry = require("./registry");
/** Scoped read-only resources. The archived private sample stays local and immutable. */
function experimentRoutes(req, res, p, { local, root, file, headers, send }) {
  const prefix = "/experiments/";
  if (!p.startsWith(prefix)) return false;
  const parts = p.slice(prefix.length).split("/"),
    id = parts.shift(),
    relative = parts.join("/");
  if (!registry.some((e) => e.id === id)) {
    send(res, 404, { error: "Experimento desconocido" });
    return true;
  }
  if (["definition-motion", "duende-cast"].includes(id)) {
    const source = path.join(root, "tools/adventure-studio/experiments/" + id),
      compiled = path.join(local, "experiments", id);
    if (relative === "view") file(res, req, source, "index.html");
    else if (relative === "style.css") file(res, req, source, relative);
    else if (["runtime.js", "budget.json"].includes(relative))
      file(res, req, compiled, relative);
    else if (relative.startsWith("art/"))
      file(res, req, path.join(compiled, "art"), relative.slice(4));
    else if (
      id === "duende-cast" &&
      /^sources\/(ascua|zarzal|trasto|candil)\.png$/.test(relative)
    )
      file(res, req, path.join(source, "sources"), relative.slice(8));
    else send(res, 404, { error: "Recurso del estudio visual desconocido" });
    return true;
  }
  if (id === "camera") {
    const source = path.join(root, "tools/adventure-studio/experiments/camera"),
      compiled = path.join(local, "experiments/camera");
    if (relative === "view") file(res, req, source, "index.html");
    else if (relative === "style.css") file(res, req, source, relative);
    else if (
      [
        "runtime.js",
        "runtime.js.LEGAL.txt",
        "THREE-LICENSE.txt",
        "budget.json",
      ].includes(relative)
    )
      file(res, req, compiled, relative);
    else if (relative.startsWith("art/"))
      file(res, req, path.join(compiled, "art"), relative.slice(4));
    else send(res, 404, { error: "Recurso de cámara desconocido" });
    return true;
  }
  if (id === "forest-scale") {
    if (relative.startsWith("art/"))
      file(
        res,
        req,
        path.join(root, "tools/adventure-studio/experiments/forest-scale/art"),
        relative.slice(4),
      );
    else if (
      [
        "manifest.json",
        "habitats.png",
        "habitats.json",
        "nature.png",
        "nature.json",
      ].includes(relative)
    )
      file(res, req, path.join(local, "experiments/forest-scale"), relative);
    else {
      send(res, 404, { error: "Recurso de experimento desconocido" });
    }
    return true;
  }
  const source = path.join(root, ".local/adventure-studio/ui-lab/public");
  if (relative === "view") {
    if (!fs.existsSync(path.join(source, "index.html"))) {
      res.writeHead(200, {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
      });
      res.end(
        '<!doctype html><html lang="es"><meta charset="utf-8"><p>El archivo de esta prueba no está instalado en esta copia local. No se descarga de producción.</p></html>',
      );
      return true;
    }
    let html = fs.readFileSync(path.join(source, "index.html"), "utf8");
    html = html
      .replaceAll('href="/lab.css"', 'href="/experiments/conversation/lab.css"')
      .replaceAll('src="/lab.js"', 'src="/experiments/conversation/lab.js"');
    html = html.replace(
      "</head>",
      "<style>.lab-brand,.lab-footer{display:none!important}.lab-bar{justify-content:space-between!important;padding:10px 16px!important}.lab-desk{min-height:0!important}</style></head>",
    );
    res.writeHead(200, {
      ...headers,
      "Content-Type": "text/html; charset=utf-8",
    });
    res.end(html);
    return true;
  }
  if (["lab.js", "lab.css", "data.json"].includes(relative)) {
    let text = fs.readFileSync(path.join(source, relative), "utf8");
    for (const item of ["/sprites/", "/media/", "/data.json"])
      text = text.replaceAll(item, "/experiments/conversation" + item);
    res.writeHead(200, {
      ...headers,
      "Content-Type": relative.endsWith(".js")
        ? "text/javascript"
        : relative.endsWith(".css")
          ? "text/css"
          : "application/json",
    });
    res.end(text);
    return true;
  }
  if (relative.startsWith("media/") || relative.startsWith("sprites/")) {
    file(res, req, source, relative);
    return true;
  }
  send(res, 404, { error: "Recurso de archivo desconocido" });
  return true;
}
module.exports = { experimentRoutes };

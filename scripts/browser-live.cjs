"use strict";
/**
 * La web simulada de las pruebas con bosque vivo de verdad: identidad, partida guardada, cuenta,
 * cuerpo, mensajes y el ticket firmado con la misma clave que el demonio de la prueba. Cada suite
 * aporta su estado (qué partida hay guardada, qué cuenta, qué necesidades) y, si quiere, más
 * puntos de la API; lo común vive aquí y no en cada fichero.
 */
const { protocol } = require("../public/assets/js/adventure/forest-connection");

/**
 * El demonio del bosque vivo vive en la web privada, al lado de este repositorio. Quien clone solo
 * el juego no lo tiene: la suite se salta sola en vez de romperse, porque es una prueba de
 * integración con el servidor de verdad, no una simulación.
 *
 * ⛔ SOLO SE SALTA SI NO ESTÁ. Cualquier otro fallo al cargarlo —un error de sintaxis, un export
 * renombrado, una dependencia que falta— tiene que ROMPER la suite: un «no está al lado» falso
 * sería un verde que debería ser rojo, y encima mintiendo sobre el motivo.
 */
function liveDaemon() {
  try {
    return {
      createLiveServer: require("../../magikitos/bosque-vivo/server.cjs").createLiveServer,
      mac: require("../../magikitos/bosque-vivo/tickets.cjs").mac,
    };
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND" && /bosque-vivo/.test(error.message)) return null;
    throw error;
  }
}

/** El ticket que la web firma para entrar en el bosque vivo, con el cuerpo y el sitio de la partida guardada. */
function liveTicket({ secret, user, saved, capabilities = { boat: false } }) {
  const { mac } = liveDaemon();
  const now = Date.now(),
    claims = {
      aud: protocol.ticketAudience,
      user,
      publicId: mac(secret, "public", String(user)).slice(0, 24),
      session: mac(secret, "session", String(user)),
      issuedAt: now,
      expiresAt: now + 300000,
      variant: 0,
      scene: saved.scene,
      ...saved.position,
      mode: "foot",
      capabilities,
      ...(saved.entrance ? { entrance: saved.entrance } : {}),
    };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return { protocol: 1, socketPath: "/bosque", now, expiresAt: claims.expiresAt, ticket: payload + "." + mac(secret, "forest-ticket", payload) };
}

/**
 * Enruta la página: el bundle recién construido, la página del juego apuntando al demonio de la
 * prueba, y la API simulada. `state` da la partida (`saved`, `profile`, `save`), la cuenta
 * (`account`), el cuerpo (`needs`) y, opcionalmente, `extra(endpoint, route, url)` para puntos
 * propios de la suite; lo que nadie contesta responde 503 como una web caída.
 */
async function routeLiveWebsite(page, { origin, port, bundled, user, secret, state, extra = () => undefined }) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.endsWith("/js/aventura.min.js"))
      return route.fulfill({ contentType: "text/javascript", body: bundled.outputFiles[0].text });
    if (url.pathname === "/bosque/explorar") {
      const response = await route.fetch(), html = await response.text();
      const body = html.replace(/(<script type="application\/json" id="adventure-config">)([\s\S]*?)(<\/script>)/, (_, a, json, b) => {
        const config = JSON.parse(json);
        config.websiteBase = `http://127.0.0.1:${port}/`;
        config.apiBase = origin + "/api/world/";
        return a + JSON.stringify(config).replaceAll("<", "\\u003c") + b;
      });
      return route.fulfill({ response, body });
    }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const endpoint = url.pathname.split("/").at(-1);
    let body = await extra(endpoint, route, url);
    if (body === "handled") return;
    if (body === "abort") return route.abort("failed");
    if (body === undefined) {
      if (endpoint === "identity") body = { user: { id: user, handle: "synthetic-" + user, name: "Test" } };
      else if (endpoint === "game-state") body = { profile: state.profile(), recoveries: [] };
      else if (endpoint === "game-save") body = state.save(route.request().postDataJSON().state);
      else if (endpoint === "game-account") body = { account: state.account() };
      else if (endpoint === "game-body") body = { now: Date.now(), needs: state.needs() };
      else if (endpoint === "forest-messages") body = { zone: url.searchParams.get("zone"), now: Date.now(), messages: state.messages ? state.messages(url.searchParams.get("zone")) : [] };
      else if (endpoint === "forest-ticket") body = liveTicket({ secret, user, saved: state.saved() });
    }
    return route.fulfill({ status: body ? 200 : 503, contentType: "application/json", body: JSON.stringify(body || { ok: false, error: "offline" }) });
  });
}
module.exports = { liveDaemon, liveTicket, routeLiveWebsite };

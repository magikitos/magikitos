"use strict";
/** UUID v4 con el generador criptográfico del navegador. Uno para todo el juego (identidad del aparato, telemetría). */
function uuid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
/** Id de operación para la API: los 32 hexadecimales de un UUID, sin guiones. */
const operationId = () => uuid().replaceAll("-", "");
module.exports = { uuid, operationId };

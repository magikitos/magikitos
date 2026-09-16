"use strict";
// Same identity namespace as analytics, WITHOUT importing or starting its collector.
// No credential is sent anywhere by this module. The device id is not authentication.
function deviceIdentity() {
  let data = {};
  try {
    data = JSON.parse(localStorage.getItem("magikito.discovery")) || {};
  } catch (_) {}
  if (typeof data !== "object" || Array.isArray(data)) data = {};
  if (
    typeof data.device_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(data.device_id)
  ) {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    data.device_id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    try {
      localStorage.setItem("magikito.discovery", JSON.stringify(data));
    } catch (_) {}
  }
  return data.device_id;
}
module.exports = { deviceIdentity };

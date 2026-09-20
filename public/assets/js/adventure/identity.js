"use strict";
// Same identity namespace as analytics, WITHOUT importing or starting its collector.
// No credential is sent anywhere by this module. The device id is not authentication.
const { uuid } = require("./ids");
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
    data.device_id = uuid();
    try {
      localStorage.setItem("magikito.discovery", JSON.stringify(data));
    } catch (_) {}
  }
  return data.device_id;
}
module.exports = { deviceIdentity };

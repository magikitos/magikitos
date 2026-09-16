"use strict";
let locale;
try {
  locale = localStorage.getItem("magikitos.locale");
} catch (_) {}
locale ||= navigator.language.split("-")[0];
if (!["es", "en", "de", "fr", "it", "pt"].includes(locale)) locale = "en";
location.replace("/" + locale + "/index.html");

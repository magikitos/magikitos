"use strict";
const { Capacitor, SystemBars } = require("@capacitor/core");
const { App } = require("@capacitor/app");
const { Browser } = require("@capacitor/browser");
if (Capacitor.isNativePlatform()) {
  const immerse = () => SystemBars.hide().catch(() => {});
  window.MagikitosPlatform = Object.freeze({ native: true, immerse });
  document.documentElement.dataset.platform = Capacitor.getPlatform();
  App.addListener("appStateChange", ({ isActive }) => {
    window.dispatchEvent(
      new CustomEvent("magikitos:app-state", { detail: { active: isActive } }),
    );
    if (isActive) immerse();
  });
  App.addListener("backButton", () => {
    const dialog = document.querySelector("dialog[open]:not(#world-entry)");
    if (dialog) {
      dialog.close();
      return;
    }
    if (document.getElementById("world-entry")?.open) return;
    // Back dismisses gameplay UI, never navigates the local WebView into a remote site.
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (
      ["https:", "http:"].includes(url.protocol) &&
      url.origin !== location.origin
    ) {
      event.preventDefault();
      Browser.open({ url: url.href });
    }
  });
  immerse();
}

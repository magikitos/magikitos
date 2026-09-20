"use strict";
const { execFileSync } = require("node:child_process");
execFileSync(process.execPath, ["tools/build.cjs"], { stdio: "inherit" });
for (const name of [
  "check-adventure",
  "check-adventure-locales",
  "check-forest-upgrade",
  "check-forest-client",
  "check-forest-objects",
  "check-forest-objects-negative",
  "check-forest-notes",
  "check-forest-notes-negative",
  "check-shared-object-contract",
  "check-shared-map",
  "check-river-core",
  "check-world-polish",
  "check-community-foundations",
  "check-pickups",
  "check-material-account",
  "check-construction-layout",
  "check-construction-density",
  "check-forest-overgrowth",
  "check-forest-bomb",
  "check-bomb-balance",
  "check-construction-retry",
  "check-community-sync",
  "check-community-sync-negative",
  "check-cloud-save",
  "check-adventure-geography",
  "check-adventure-residents",
  "check-adventure-picnic",
  "check-adventure-ascua",
  "check-adventure-controls",
  "check-audio-core",
  "check-adventure-mobility",
  "check-gait",
  "check-adventure-journeys",
  "check-adventure-interactions",
  "check-adventure-assets",
  "check-actor-art",
  "check-vessel-art",
  "check-rowing-contract",
  "check-playable-cast",
  "check-relief-art",
  "check-adventure-life",
  "check-adventure-camera",
  "check-world-layout",
  "check-adventure-materials-portals",
  "check-adventure-studio",
  "check-studio-selection",
  "check-adventure-gallery",
  "check-adventure-movables",
  "check-woodland-core",
  "check-adventure-paths",
  "check-adventure-doors",
  "check-door-geometry",
  "check-adventure-account",
  "check-flat-art",
  "check-release-install",
])
  execFileSync(process.execPath, ["scripts/" + name + ".cjs"], {
    stdio: "inherit",
  });
execFileSync("php", ["scripts/check-adventure-crops.php"], {
  stdio: "inherit",
});
execFileSync("php", ["scripts/check-actor-registration.php"], {
  stdio: "inherit",
});
execFileSync(process.execPath, ["scripts/check-playable-art.cjs", "--sources-only"], {
  stdio: "inherit",
});
execFileSync("php", ["scripts/check-woodland-cutouts.php"], {
  stdio: "inherit",
});

"use strict";
const { execFileSync } = require("node:child_process");
execFileSync(process.execPath, ["tools/build.cjs"], { stdio: "inherit" });
for (const name of [
  "check-adventure",
  "check-river-core",
  "check-world-polish",
  "check-community-foundations",
  "check-pickups",
  "check-material-account",
  "check-construction-layout",
  "check-homestead-layout",
  "check-cloud-save",
  "check-adventure-geography",
  "check-adventure-residents",
  "check-adventure-picnic",
  "check-adventure-ascua",
  "check-adventure-controls",
  "check-input-modality",
  "check-audio-core",
  "check-adventure-mobility",
  "check-adventure-journeys",
  "check-adventure-interactions",
  "check-adventure-assets",
  "check-adventure-life",
  "check-adventure-camera",
  "check-adventure-materials-portals",
  "check-adventure-studio",
  "check-studio-selection",
  "check-adventure-gallery",
  "check-adventure-movables",
  "check-woodland-core",
  "check-adventure-paths",
  "check-adventure-doors",
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
execFileSync("php", ["scripts/check-woodland-cutouts.php"], {
  stdio: "inherit",
});

"use strict";
/** Install a verified static artifact in local DDEV. Never deploys or copies editable source. */
const fs = require("node:fs"), path = require("node:path");
const {out} = require("./build.cjs"), {installRelease} = require("./install-release.cjs");
const root = fs.realpathSync(path.resolve(process.argv[2] || path.join(__dirname,"../../magikitos")));
if (!fs.existsSync(path.join(root,".ddev/config.yaml")) || !fs.existsSync(path.join(root,"src/game-release.php")))
  throw Error("Target must be the local DDEV website with its game mount");
const pointer = JSON.parse(fs.readFileSync(path.join(out,"current.json")));
if(!/^[a-f0-9]{20}$/.test(pointer.id)) throw Error("Invalid release id");
const result=installRelease(path.join(out,"releases",pointer.id),root,{activate:true});
console.log("Installed locally: "+result.destination+"\nNo source engine copied, no deployment, old releases retained.");

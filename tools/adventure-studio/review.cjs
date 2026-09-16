"use strict";
/** Agent entry point: read the one Studio proposal. Never writes game data. */
const path = require("node:path");
const { WorkspaceStore } = require("./workspace.cjs"),
  { snapshot } = require("./snapshot.cjs");
const root = path.resolve(__dirname, "../..");
const store = new WorkspaceStore(path.join(root, ".local/adventure-studio"));
const result = store.load(snapshot(root));
const proposal = store.diff();
if (!process.argv.includes("--full"))
  for (const scene of proposal.scenes) delete scene.proposedScene;
process.stdout.write(
  JSON.stringify({ ...proposal, conflicts: result.conflicts }, null, 2) + "\n",
);
if (result.conflicts.length) process.exitCode = 2;

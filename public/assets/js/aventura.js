/* The adventure entry point. Runtime modules are bundled into this page-only asset. */
"use strict";
const { Adventure } = require("./adventure/game");
const node = document.getElementById("adventure-config");
if (node) {
  const game = new Adventure(JSON.parse(node.textContent));
  window.MagikitosAdventure = Object.freeze({ inspect: () => game.inspect() });
  game.init();
}

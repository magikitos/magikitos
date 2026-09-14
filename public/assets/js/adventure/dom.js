"use strict";
/** The game's own DOM, always text/attributes from whitelisted DTOs. No HTML from an API. */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (key === "text") node.textContent = String(value);
    else if (key === "class") node.className = value;
    else if (key === "on")
      for (const [event, fn] of Object.entries(value))
        node.addEventListener(event, fn);
    else node.setAttribute(key, String(value));
  }
  node.append(...children.filter(Boolean));
  return node;
}
function button(text, action, className = "") {
  return el("button", {
    type: "button",
    text,
    class: className,
    on: { click: action },
  });
}
function websiteLink(game, text, value, className = "") {
  const url = game.api.url(value);
  if (!url) return null;
  return el("a", {
    href: url,
    text,
    class: className,
    target: "_blank",
    rel: "noopener",
    on: { click: () => game.save() },
  });
}
module.exports = { el, button, websiteLink };

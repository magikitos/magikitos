"use strict";
const plan = require("./poses.json");
const poseCount = (a) =>
  a.frames * a.directions.length * (a.variants?.length || 1);
const totalPoses = (actions) => actions.reduce((n, a) => n + poseCount(a), 0);
function renderPlan(host, group, query) {
  const q = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const actions = plan.actions.filter(
    (a) =>
      (group === "all" || a.group === group) &&
      (a.label + " " + a.brief + " " + a.id)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(q),
  );
  host.replaceChildren(
    ...actions.map((a) => {
      const card = document.createElement("article");
      card.className = "pose-row";
      card.dataset.action = a.id;
      const h = document.createElement("h3");
      h.textContent = a.label;
      const m = document.createElement("p");
      m.className = "meta";
      m.textContent =
        a.directions.length +
        " dirección" +
        (a.directions.length === 1 ? "" : "es") +
        " × " +
        a.frames +
        " poses" +
        (a.variants ? " × " + a.variants.length + " gestos" : "") +
        " = " +
        poseCount(a);
      const p = document.createElement("p");
      p.textContent = a.brief;
      const d = document.createElement("div");
      d.className = "directions";
      d.textContent =
        a.directions.join(" · ") +
        " / apoyo: " +
        a.anchor +
        (a.variants ? " / " + a.variants.join(", ") : "");
      card.append(h, m, p, d);
      return card;
    }),
  );
  return (
    actions.length + " acciones · " + totalPoses(actions) + " poses estimadas"
  );
}
module.exports = { plan, poseCount, totalPoses, renderPlan };

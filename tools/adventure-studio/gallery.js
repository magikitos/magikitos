"use strict";
const { families } = require("../../public/assets/js/adventure/elements");

/** The palette contains native, already baked sprites; it never loads source masters. */
class Gallery {
  constructor(root, sprites, onAdd) {
    this.root = root;
    this.sprites = sprites;
    this.onAdd = onAdd;
    this.query = root.querySelector("[data-gallery-search]");
    this.category = root.querySelector("[data-gallery-category]");
    this.list = root.querySelector("[data-gallery-list]");
    const categories = [
      ...new Set(
        Object.values(families)
          .filter((f) => f.placeable !== false)
          .map((f) => f.category),
      ),
    ];
    for (const name of categories) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      this.category.append(option);
    }
    this.query.addEventListener("input", () => this.render());
    this.category.addEventListener("change", () => this.render());
    this.render();
  }
  sceneChanged(scene) {
    this.scene = scene;
    this.render();
  }
  render() {
    const query = this.query.value.toLocaleLowerCase(),
      category = this.category.value;
    this.list.replaceChildren();
    for (const [id, family] of Object.entries(families)) {
      if (
        family.placeable === false ||
        (this.scene?.indoor && family.category === "Casitas") ||
        (category && family.category !== category) ||
        !(family.label + " " + family.category)
          .toLocaleLowerCase()
          .includes(query)
      )
        continue;
      const variants = family.variants.filter((v) =>
        this.sprites.frame(v.sprite),
      );
      if (!variants.length) continue;
      const card = document.createElement("article");
      card.className = "gallery-card";
      card.dataset.family = id;
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 90;
      canvas.setAttribute("aria-hidden", "true");
      const title = document.createElement("strong");
      title.textContent = family.label;
      const select = document.createElement("select");
      select.setAttribute("aria-label", "Variante de " + family.label);
      for (const v of [
        { id: "auto", label: "Variada · fija por objeto" },
        ...variants,
      ]) {
        const option = document.createElement("option");
        option.value = v.id;
        option.textContent = v.label;
        select.append(option);
      }
      const draw = () => {
        const variant =
            variants.find((v) => v.id === select.value) || variants[0],
          frame = this.sprites.frame(variant.sprite),
          c = canvas.getContext("2d");
        c.clearRect(0, 0, 100, 90);
        c.imageSmoothingEnabled = false;
        const k = Math.min(90 / frame.w, 80 / frame.h);
        this.sprites.draw(
          c,
          variant.sprite,
          (100 - frame.w * k) / 2,
          (90 - frame.h * k) / 2,
          frame.w * k,
          frame.h * k,
        );
      };
      select.onchange = draw;
      draw();
      const add = document.createElement("button");
      add.textContent = "Colocar";
      add.setAttribute("aria-label", "Colocar " + family.label);
      add.onclick = () => this.onAdd(id, select.value);
      card.append(canvas, title, select, add);
      this.list.append(card);
    }
    if (!this.list.children.length) {
      const p = document.createElement("p");
      p.className = "note";
      p.textContent = "No hay elementos para este filtro.";
      this.list.append(p);
    }
  }
}
module.exports = { Gallery };

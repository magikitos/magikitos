"use strict";
const { el, button } = require("./dom");
/**
 * LA BIENVENIDA: cinco láminas la primera vez que alguien entra al bosque (23-sep-2026).
 *
 * Quien llegaba aparecía en la pradera y nadie le decía nada, y casi todos se iban sin hacer una
 * sola acción. Esto lo cuenta como un escape room, que la gente ya sabe lo que es, y no nombra
 * los cuentos, los chistes ni el diario: eso lo tiene que encontrar cada cual.
 *
 * Va en el MISMO panel que los cuentos y los chistes (`#world-content`), con la lámina en su
 * marco de papel. Cada lámina es un paquete de sprites propio que se pide solo al llegar a ella
 * (y la siguiente de antemano), así que a quien ya la ha visto no le cuesta ni un byte.
 *
 * Se enseña UNA vez: la marca `welcomed` viaja en la partida, así que tampoco vuelve en otro
 * aparato con cuenta. Y solo a una partida en blanco (sin marcas ni saco), que es lo que
 * distingue a quien llega de quien ya ha jugado aunque sea en otro navegador.
 */
const SLIDES = [
  "welcome-1-explora",
  "welcome-2-escape-room",
  "welcome-3-interactua",
  "welcome-4-descubre",
  "welcome-5-relajate",
];
class Welcome {
  constructor(game) {
    this.game = game;
    this.canvases = new Map();
    this.at = 0;
    this.open = false;
  }
  due() {
    const s = this.game.state;
    return (
      !Object.keys(s.flags || {}).length && !Object.keys(s.inventory || {}).length
    );
  }
  /** Draws one slide into a canvas, once. A slide that cannot load keeps its paper frame. */
  art(i) {
    const name = SLIDES[i];
    if (!name) return Promise.resolve(null);
    if (this.canvases.has(name)) return this.canvases.get(name);
    const sprites = this.game.renderer.sprites;
    const task = (async () => {
      if (!sprites.has(name)) return null;
      try {
        const lease = await sprites.prepare([name]);
        const canvas = sprites.icon(name, { fullCanvas: true });
        lease.release();
        if (canvas) canvas.className = "world-welcome-art";
        return canvas;
      } catch (_) {
        return null;
      }
    })();
    this.canvases.set(name, task);
    return task;
  }
  show() {
    const g = this.game;
    g.state.flags.welcomed = true;
    g.dirty = true;
    g.save();
    this.open = true;
    this.at = 0;
    this.root = el("article", {
      class: "world-experience world-experience--art world-welcome",
    });
    this.frame = el("div", { class: "world-welcome-frame" });
    this.title = el("h1", { tabindex: "-1" });
    this.text = el("p", { class: "world-welcome-text" });
    this.dots = el("div", { class: "world-welcome-dots", "aria-hidden": "true" });
    for (let i = 0; i < SLIDES.length; i++) this.dots.append(el("span"));
    this.next = button("", () => this.step(), "world-primary");
    this.skip = button(g.text("welcomeSkip"), () => this.close("skip"));
    this.root.append(
      el("div", { class: "world-experience-object world-welcome-object" }, [this.frame]),
      this.dots,
      this.title,
      this.text,
      el("div", { class: "world-experience-actions" }, [this.next]),
      el("div", { class: "world-experience-links" }, [this.skip]),
    );
    g.site.present(this.root);
    g.telemetry?.milestone("welcome:start");
    this.paint();
  }
  async paint() {
    const g = this.game,
      i = this.at,
      n = i + 1;
    this.title.textContent = g.text("welcome" + n + "Title");
    this.text.textContent = g.text("welcome" + n + "Text");
    this.next.textContent = g.text(
      n === SLIDES.length ? "welcomeStart" : "welcomeNext",
    );
    [...this.dots.children].forEach((d, k) =>
      d.classList.toggle("is-on", k === i),
    );
    this.frame.replaceChildren();
    this.frame.classList.add("is-loading");
    this.title.focus({ preventScroll: true });
    const canvas = await this.art(i);
    this.art(i + 1);
    if (this.at !== i || !this.open) return;
    this.frame.classList.remove("is-loading");
    if (canvas) this.frame.replaceChildren(canvas);
  }
  step() {
    if (this.at >= SLIDES.length - 1) return this.close("done");
    this.at++;
    this.paint();
  }
  close(how) {
    if (!this.open) return;
    this.open = false;
    this.game.telemetry?.milestone("welcome:" + how);
    this.game.closeContent();
  }
}
module.exports = { Welcome };

"use strict";
/** A memory turn has at most two exposed cards. No timers or rewards live in the board. */
class MemoryBoard {
  constructor(pairs, found = [], random = Math.random) {
    this.cards = pairs.flatMap((p) => [p.id, p.id]);
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    this.found = new Set(found.filter((id) => this.cards.includes(id)));
    this.open = [];
  }
  turn(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.cards.length ||
        this.open.length === 2 || this.open.includes(index) || this.found.has(this.cards[index])) return null;
    this.open.push(index);
    if (this.open.length < 2) return { type: "first" };
    const [a, b] = this.open;
    return this.cards[a] === this.cards[b]
      ? { type: "pair", id: this.cards[a] }
      : { type: "miss" };
  }
  settle(accept = true) {
    if (accept && this.open.length === 2 && this.cards[this.open[0]] === this.cards[this.open[1]])
      this.found.add(this.cards[this.open[0]]);
    this.open = [];
  }
  get complete() { return this.found.size * 2 === this.cards.length; }
}
module.exports = { MemoryBoard };

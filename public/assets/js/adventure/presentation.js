"use strict";
const { keepsakePoint } = require("./keepsakes");
const { facing } = require("./characters");
const { playerVariant, playerPack } = require("./player-art");
const { active } = require("./rules");
function cardinal(dx, dy) {
  return Math.abs(dx) > Math.abs(dy) ? facing(dx,0) : facing(0,dy);
}
function gains(before, after) {
  return Object.keys(after.inventory).filter(id => after.inventory[id] > (before.inventory[id] || 0));
}
/** Reusable foreground gestures. Rules own all state; these timelines cannot grant, spend or consume. */
class Presentation {
  constructor(game) { this.game = game; this.hiddenEntities = new Set(); }
  hides(entity) { return this.hiddenEntities.has(entity.id); }
  finish() { this.hiddenEntities.clear(); }
  async play(effect, entity) {
    const game = this.game, sprites = game.renderer.sprites;
    const kind = effect.sequence;
    if (!["work","toss","discover"].includes(kind)) throw new Error("Unknown presentation");
    const props = (effect.props || []).map(id => {
      if (!game.catalog.items[id]) throw new Error("Unknown presentation item");
      return game.catalog.items[id].sprite;
    });
    const names = [...props, effect.sprite, effect.result && game.catalog.items[effect.result]?.sprite].filter(Boolean);
    const old = new Set(sprites.pinned);
    const packs = await sprites.prepare(names, [playerPack(kind === "discover" ? "discover" : "work", game.player)]);
    sprites.activate(new Set([...old, ...packs]));
    packs.release?.();
    game.player.direction = kind === "discover" ? "down" : cardinal(entity.x-game.player.x, entity.y-game.player.y);
    const target = kind === "toss"
      ? keepsakePoint(entity, Math.min(entity.keepsakes.limit-1, game.state.keepsakes?.[game.state.scene]?.[entity.id] || 0))
      : {x:entity.x, y:entity.y-13};
    try {
      await game.sequence.play("gesture", game.reducedMotion ? .35 : effect.duration, {
        kind, props, sprite:effect.sprite, result:effect.result && game.catalog.items[effect.result].sprite,
        direction:game.player.direction, target,
      });
    } finally { sprites.activate(old); }
  }
  async gains(before, after, origin) {
    // Hide only a collected source, not reusable plants or crafting stations.
    // This is visual transaction state: failure restores the source without granting an item.
    if (gains(before, after).length && active(origin, before) && !active(origin, after))
      this.hiddenEntities.add(origin.id);
    for (const id of gains(before,after))
      await this.play({sequence:"discover",sprite:this.game.catalog.items[id].sprite,duration:.45}, origin);
  }
  frame() {
    const seq = this.game.sequence.current;
    if (seq?.type !== "gesture") return null;
    const p = this.game.sequence.progress(), {kind,direction} = seq.data;
    const variant = playerVariant(this.game.player);
    if (kind === "discover") return `person-${variant}-discover-` + (p < .9 ? 2 : 3);
    const pose = kind === "toss" ? (p < .23 ? 1 : 3)
      : p < .2 ? 0 : p < .72 ? 1 + Math.floor(seq.elapsed*5)%2 : 3;
    return `person-${variant}-${direction}-work-${pose}`;
  }
  draw(ctx) {
    const game=this.game, seq=game.sequence.current;
    if (seq?.type !== "gesture") return;
    const p=game.sequence.progress(), d=seq.data, a=game.player, s=game.renderer.sprites;
    const draw=(sprite,x,y,size=16)=> {
      const f=s.frame(sprite); if (!f) return;
      const ratio=size/Math.max(f.w,f.h), w=f.w*ratio,h=f.h*ratio;
      s.draw(ctx,sprite,x-w/2,y-h/2,w,h);
    };
    if (d.kind === "discover") {
      draw(d.sprite,a.x,a.y-51,20);
      if (!game.reducedMotion) {
        ctx.fillStyle="#fff0b1";
        for (let i=0;i<4;i++) {
          const t=i*Math.PI/2+p*1.2;
          ctx.fillRect(a.x+Math.cos(t)*15,a.y-51+Math.sin(t)*12,1,2);
        }
      }
      return;
    }
    const horizontal=d.direction==="right"?1:d.direction==="left"?-1:0;
    const hand={x:a.x+horizontal*11,y:a.y-(d.direction==="up"?24:15)};
    if (d.kind === "toss") {
      const t=Math.max(0,Math.min(1,(p-.23)/.67));
      const x=hand.x+(d.target.x-hand.x)*t;
      const y=hand.y+(d.target.y-hand.y)*t-(game.reducedMotion?0:Math.sin(t*Math.PI)*28);
      draw(t>.98?"setin-flat":Math.floor(t*6)%2?"setin-angle":d.sprite,x,y,t>.98?5:8);
      if (t===1 && !game.reducedMotion) {
        ctx.strokeStyle="rgba(231,243,184,.65)"; ctx.lineWidth=.5;
        ctx.beginPath();ctx.ellipse(x,y,3+(p-.9)*45,1+(p-.9)*13,0,0,Math.PI*2);ctx.stroke();
      }
      return;
    }
    if (p>.75 && d.result) {
      draw(d.result,d.target.x,d.target.y,20);
      return;
    }
    const [input,tool,support]=d.props;
    if (support) draw(support,hand.x,hand.y+5,20);
    if (input) {
      // A common two-part cut: works with any input sprite, not a mushroom-specific animation.
      const split=tool && p>.35 ? 2 : 0;
      if (!split) draw(input,hand.x,hand.y,17);
      else for (const side of [-1,1]) {
        ctx.save();ctx.beginPath();
        ctx.rect(hand.x+(side<0?-20:0),hand.y-20,20,40);ctx.clip();
        draw(input,hand.x+side*split,hand.y,17);ctx.restore();
      }
    }
    if (tool && p>.2 && p<.72) {
      ctx.save();ctx.translate(hand.x+4,hand.y-3);
      ctx.rotate(game.reducedMotion?0:Math.sin(seq.elapsed*18)*.28);
      draw(tool,0,0,19);ctx.restore();
    }
  }
}
module.exports={Presentation,cardinal,gains};

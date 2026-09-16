import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import config from "./config.js";
const { PROPS, NEIGHBORS, heightAt } = config;
const C = {
  bark: "#66442e",
  barkLight: "#926341",
  wood: "#ac8250",
  dark: "#302c22",
  cream: "#e4cf9b",
  gold: "#f2bc50",
  leaves: ["#496b3b", "#5b7e42", "#77994d", "#94ab57"],
  red: "#b65336",
};
export class Models {
  constructor() {
    this.materials = new Map();
  }
  material(color) {
    if (!this.materials.has(color))
      this.materials.set(
        color,
        new T.MeshLambertMaterial({ color, flatShading: true }),
      );
    return this.materials.get(color);
  }
  mesh(p, g, color, x = 0, y = 0, z = 0, s = [1, 1, 1], r = [0, 0, 0]) {
    const m = new T.Mesh(g, this.material(color));
    m.position.set(x, y, z);
    m.scale.set(...s);
    m.rotation.set(...r);
    m.castShadow = true;
    m.receiveShadow = true;
    p.add(m);
    return m;
  }
  box(p, c, x, y, z, w, h, d, r = [0, 0, 0]) {
    return this.mesh(p, new T.BoxGeometry(w, h, d), c, x, y, z, [1, 1, 1], r);
  }
  ball(p, c, x, y, z, s = [1, 1, 1], detail = 1) {
    return this.mesh(p, new T.IcosahedronGeometry(1, detail), c, x, y, z, s);
  }
  cylinder(p, c, x, y, z, rt, rb, h, n = 10) {
    return this.mesh(p, new T.CylinderGeometry(rt, rb, h, n), c, x, y, z);
  }
  limb(p, c, a, b, r = 0.15) {
    const d = new T.Vector3(...b).sub(new T.Vector3(...a));
    const m = this.cylinder(
      p,
      c,
      ...new T.Vector3(...a).addScaledVector(d, 0.5).toArray(),
      r * 0.8,
      r,
      d.length(),
      7,
    );
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  arch(p, x, y, z, w, h) {
    const s = new T.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(-w / 2, h - w / 2);
    s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true);
    s.lineTo(w / 2, 0);
    s.closePath();
    return this.mesh(p, new T.ShapeGeometry(s, 10), C.dark, x, y, z);
  }
  window(p, x, y, z, scale = 0.7) {
    this.mesh(p, new T.CircleGeometry(scale, 16), C.gold, x, y, z);
    this.mesh(
      p,
      new T.TorusGeometry(scale, 0.09, 5, 16),
      C.bark,
      x,
      y,
      z + 0.03,
    );
    this.box(p, C.bark, x, y, z + 0.05, 0.1, scale * 2, 0.08);
    this.box(p, C.bark, x, y, z + 0.05, scale * 2, 0.1, 0.08);
  }
  lamp(p, x, y, z) {
    this.limb(p, C.dark, [x, y + 0.5, z - 0.3], [x, y + 0.5, z], 0.06);
    this.ball(p, C.gold, x, y, z, [0.22, 0.32, 0.22]);
    this.cylinder(p, C.bark, x, y + 0.25, z, 0.28, 0.28, 0.14, 8);
  }
  leaf(p, x, y, z, s = 1, angle = 0) {
    return this.ball(
      p,
      C.leaves[Math.abs(Math.round(angle * 3)) % 4],
      x,
      y,
      z,
      [s * 0.45, s * 0.1, s],
      0,
    ).rotation.set(0.3, angle, 0.2);
  }
  boot(p) {
    const s = new T.Shape();
    s.moveTo(-3.3, 0.2);
    s.bezierCurveTo(-3.5, 1.5, -2.7, 2.1, -1.3, 2.2);
    s.lineTo(0.5, 3);
    s.lineTo(0.9, 3.4);
    s.lineTo(3, 3.4);
    s.lineTo(3, 0.2);
    s.closePath();
    this.mesh(
      p,
      new T.ExtrudeGeometry(s, {
        depth: 2.7,
        bevelEnabled: true,
        bevelSize: 0.14,
        bevelThickness: 0.12,
        bevelSegments: 2,
        steps: 1,
      }),
      "#795037",
      0,
      0,
      -1.35,
    );
    this.box(p, C.dark, -0.2, 0.16, 0, 6.8, 0.32, 3.1);
    this.cylinder(p, "#795037", 1.75, 4.6, 0, 1.08, 1.3, 4.8, 16).scale.z = 1.3;
    this.cylinder(p, C.barkLight, 1.75, 6.94, 0, 1.21, 1.18, 0.35, 16).scale.z =
      1.3;
    this.cylinder(p, C.dark, 1.75, 7.125, 0, 0.99, 0.99, 0.018, 16).scale.z =
      1.3;
    this.arch(p, -1.9, 0.31, 1.5, 1.5, 1.85);
    for (let i = 0; i < 3; i++)
      this.box(
        p,
        C.cream,
        -1.9,
        0.08 + i * 0.09,
        1.85 + i * 0.15,
        1.7,
        0.15,
        0.55,
      );
    for (let i = 0; i < 5; i++) {
      const y = 2.8 + i * 0.64;
      for (const x of [0.75, 2])
        this.ball(p, C.gold, x, y, 1.49, [0.12, 0.12, 0.08], 0);
      this.limb(p, C.cream, [0.75, y, 1.53], [2, y + 0.48, 1.53], 0.045);
      this.limb(p, C.cream, [2, y, 1.54], [0.75, y + 0.48, 1.54], 0.045);
    }
    this.window(p, -0.1, 2.65, 1.51, 0.42);
    this.lamp(p, -3, 2.6, 1.9);
    for (let i = 0; i < 6; i++)
      this.leaf(
        p,
        -1.9 + Math.cos(i) * 0.9,
        2.4,
        1.7 + Math.sin(i) * 0.4,
        0.9,
        i,
      );
  }
  hut(p) {
    this.cylinder(p, "#776040", 0, 1.6, 0, 1.9, 2.2, 3.2, 10);
    this.cylinder(p, C.leaves[0], 0, 4, 0, 0.25, 2.9, 4.4, 8);
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 9; i++) {
        const a = (i * Math.PI * 2) / 9 + (j % 2) * 0.2,
          r = 2.5 - j * 0.75;
        this.leaf(p, Math.cos(a) * r, 2.5 + j * 1.2, Math.sin(a) * r, 1.25, a);
      }
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      this.limb(
        p,
        C.barkLight,
        [Math.cos(a) * 2.4, 0.1, Math.sin(a) * 2.4],
        [0, 6.6, 0],
        0.1,
      );
    }
    this.arch(p, 0, 0, 2.21, 1.5, 2.2);
    this.lamp(p, -1.4, 2.15, 2.4);
    this.box(p, C.cream, 0, 0.06, 2.6, 1.8, 0.12, 0.8);
  }
  stump(p) {
    this.cylinder(p, C.bark, 0, 2.8, 0, 2.25, 2.7, 5.6, 12);
    this.cylinder(p, C.wood, 0, 5.61, 0, 2.23, 2.23, 0.16, 12);
    this.cylinder(p, C.dark, 0, 5.72, 0, 1.75, 1.75, 0.04, 12);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      this.limb(
        p,
        i % 2 ? C.barkLight : C.bark,
        [Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5],
        [Math.cos(a) * 2.3, 5.7 + (i % 3) * 0.2, Math.sin(a) * 2.3],
        0.16,
      );
    }
    for (let i = 0; i < 7; i++) {
      const a = (i * 6.28) / 7;
      this.limb(
        p,
        C.bark,
        [Math.cos(a) * 4, 0, Math.sin(a) * 4],
        [Math.cos(a) * 1.7, 1.9, Math.sin(a) * 1.7],
        0.35,
      );
    }
    this.arch(p, 0, 0, 2.72, 1.65, 2.5);
    this.window(p, 1.2, 3.5, 2.18, 0.48);
    this.lamp(p, -1.25, 2.2, 2.8);
    for (let i = 0; i < 4; i++)
      this.ball(p, C.wood, 2.4, 1.3 + i * 0.85, -0.8, [0.7, 0.12, 0.65], 1);
  }
  mushroom(p, spec) {
    const h = spec.height * 0.65,
      r = spec.height * 0.52;
    this.cylinder(p, C.cream, 0, h / 2, 0, 0.4, 0.7, h, 12);
    this.mesh(
      p,
      new T.SphereGeometry(r, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      spec.red ? C.red : "#b5763d",
      0,
      h,
      0,
      [1, 0.48, 1],
    );
    this.cylinder(p, "#d1b986", 0, h - 0.025, 0, r, r, 0.07, 20);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4,
        d = r * (0.3 + (i % 3) * 0.19);
      this.ball(
        p,
        "#f0d8aa",
        Math.cos(a) * d,
        h + Math.sqrt(r * r - d * d) * 0.48,
        Math.sin(a) * d,
        [0.15, 0.045, 0.13],
        0,
      );
    }
  }
  tree(p, spec) {
    const h = spec.height,
      b = spec.birch,
      stem = b ? "#c4bfa2" : C.bark;
    this.cylinder(
      p,
      stem,
      0,
      h * 0.23,
      0,
      b ? 0.43 : 0.8,
      b ? 0.7 : 1.35,
      h * 0.46,
      9,
    );
    for (let i = 0; i < 7; i++) {
      const a = (i * 6.28) / 7;
      this.limb(
        p,
        stem,
        [Math.cos(a) * 2.7, 0.08, Math.sin(a) * 2.7],
        [0, 2, 0],
        b ? 0.15 : 0.32,
      );
    }
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4,
        y = h * (0.35 + (i % 4) * 0.1);
      this.limb(
        p,
        stem,
        [0, y - 1, 0],
        [Math.cos(a) * 3, y + 2, Math.sin(a) * 3],
        b ? 0.14 : 0.25,
      );
    }
    if (b)
      for (let i = 0; i < 12; i++)
        this.box(
          p,
          C.dark,
          0.03 + (i % 2) * 0.15,
          0.8 + i * 0.47,
          0.55,
          0.45,
          0.09,
          0.08,
          [0, 0, i * 0.2],
        );
    for (let i = 0; i < 27; i++) {
      const a = i * 2.399,
        r = (i % 3) * 1.5 + 0.4,
        y = h * (0.6 + (i % 5) * 0.07);
      this.ball(
        p,
        C.leaves[(i + (b ? 1 : 0)) % 4],
        Math.cos(a) * r,
        y,
        Math.sin(a) * r,
        [b ? 1.9 : 2.45, 1.35, b ? 1.6 : 2.05],
        1,
      );
    }
    for (let i = 0; i < 3; i++)
      this.ball(p, C.wood, 0.8, 1 + i * 0.55, 0.6, [0.4, 0.09, 0.3], 1);
  }
  fern(p) {
    for (let i = 0; i < 9; i++) {
      const a = (i * 6.28) / 9,
        dx = Math.cos(a),
        dz = Math.sin(a);
      const tip = [dx * 2.3, 1.65, dz * 2.3];
      this.limb(p, C.leaves[0], [0, 0, 0], tip, 0.045);
      for (let j = 1; j < 6; j++) {
        const t = j / 6,
          x = tip[0] * t,
          z = tip[2] * t,
          y = Math.sin(t * 2) * 1.45,
          span = (1 - t) * 0.85;
        for (const side of [-1, 1])
          this.ball(
            p,
            C.leaves[(i + j) % 4],
            x - dz * span * side,
            y,
            z + dx * span * side,
            [0.4, 0.055, 0.17],
            0,
          ).rotation.y = a;
      }
    }
  }
  fountain(p) {
    this.cylinder(p, "#7b816c", 0, 0.3, 0, 1.65, 1.9, 0.6, 14);
    this.cylinder(p, "#619e97", 0, 0.63, 0, 1.45, 1.45, 0.03, 24);
    for (let i = 0; i < 12; i++) {
      const a = (i * 6.28) / 12;
      this.ball(
        p,
        "#a5a58b",
        Math.cos(a) * 1.6,
        0.69,
        Math.sin(a) * 1.6,
        [0.43, 0.35, 0.4],
      );
    }
    this.cylinder(p, "#c2ba95", 0, 1.3, 0, 0.15, 0.4, 1.5, 10);
    this.cylinder(p, "#c2ba95", 0, 2.1, 0, 0.7, 0.3, 0.25, 12);
    this.cylinder(p, "#8dc9c0", 0, 2.28, 0, 0.12, 0.13, 0.4, 8);
  }
  bench(p) {
    for (const x of [-1, 1])
      for (const z of [-0.25, 0.25])
        this.box(p, C.bark, x, 0.4, z, 0.18, 0.8, 0.18);
    this.box(p, C.wood, 0, 0.9, 0, 2.9, 0.2, 0.9);
    this.box(p, C.wood, 0, 1.45, -0.4, 2.9, 0.3, 0.16);
  }
  fire(p) {
    for (let i = 0; i < 8; i++) {
      const a = (i * 6.28) / 8;
      this.ball(
        p,
        "#777969",
        Math.cos(a) * 0.65,
        0.18,
        Math.sin(a) * 0.65,
        [0.25, 0.2, 0.25],
      );
    }
    this.limb(p, C.bark, [-0.5, 0.2, -0.25], [0.5, 0.2, 0.25], 0.13);
    this.limb(p, C.bark, [0.4, 0.24, -0.3], [-0.4, 0.24, 0.3], 0.13);
    this.cylinder(p, "#e69b38", 0, 0.65, 0, 0, 0.34, 1, 7);
    this.cylinder(p, "#f2d56e", 0.1, 0.55, 0.1, 0, 0.18, 0.65, 6);
  }
  elf(hat = "#c58b32", skin = "#dfa57b", coat = "#688667") {
    const p = new T.Group(),
      legs = [];
    for (const x of [-0.19, 0.19]) {
      const hip = new T.Group();
      hip.position.set(x, 0.63, 0);
      p.add(hip);
      this.box(hip, "#634f43", 0, -0.2, 0, 0.22, 0.43, 0.25);
      this.box(hip, C.dark, 0, -0.47, 0.08, 0.27, 0.17, 0.43);
      legs.push(hip);
    }
    this.cylinder(p, coat, 0, 0.8, 0, 0.29, 0.42, 0.65, 8);
    for (const x of [-0.4, 0.4]) {
      this.limb(p, coat, [x * 0.8, 1, 0], [x, 0.56, 0.08], 0.13);
      this.ball(p, skin, x, 0.55, 0.09, [0.13, 0.15, 0.13]);
    }
    this.ball(p, skin, 0, 1.33, 0, [0.43, 0.4, 0.37], 1);
    for (const s of [-1, 1])
      this.mesh(
        p,
        new T.ConeGeometry(0.16, 0.48, 4),
        skin,
        s * 0.47,
        1.42,
        0,
        [1, 1, 1],
        [0, 0, (-s * Math.PI) / 2],
      );
    this.ball(p, "#97562e", 0, 1.61, -0.08, [0.44, 0.15, 0.36], 1);
    this.ball(p, skin, 0, 1.33, 0.38, [0.14, 0.12, 0.16], 1);
    for (const x of [-0.15, 0.15])
      this.ball(p, C.dark, x, 1.43, 0.33, [0.045, 0.055, 0.035], 0);
    this.cylinder(p, hat, 0, 1.7, 0, 0.35, 0.52, 0.15, 10);
    this.mesh(
      p,
      new T.ConeGeometry(0.37, 0.95, 8),
      hat,
      0.04,
      2.1,
      -0.02,
      [1, 1, 1],
      [0, 0, -0.18],
    );
    this.box(p, C.wood, 0, 0.93, -0.4, 0.48, 0.48, 0.27);
    this.box(p, C.gold, 0, 1.09, 0.32, 0.13, 0.21, 0.07);
    return { root: p, legs };
  }
  batch(root) {
    root.updateMatrixWorld(true);
    const groups = new Map();
    root.traverse((m) => {
      if (!m.isMesh) return;
      let g = m.geometry.clone();
      if (g.index) {
        const plain = g.toNonIndexed();
        g.dispose();
        g = plain;
      }
      g.deleteAttribute("uv");
      g.deleteAttribute("uv1");
      g.applyMatrix4(m.matrixWorld);
      const list = groups.get(m.material) || [];
      list.push(g);
      groups.set(m.material, list);
      m.geometry.dispose();
    });
    const result = new T.Group();
    for (const [material, parts] of groups) {
      const geometry = mergeGeometries(parts, false);
      parts.forEach((g) => g.dispose());
      const m = new T.Mesh(geometry, material);
      m.castShadow = true;
      m.receiveShadow = true;
      result.add(m);
    }
    return result;
  }
  bridge() {
    const root = new T.Group();
    // A wooden footbridge follows the exact walkable strip in the shared collision model.
    for (let x = 47; x < 57; x += 0.45)
      this.box(root, C.wood, x, 0.16, 39.5, 0.42, 0.25, 3);
    for (const z of [38.1, 40.9]) {
      this.limb(root, C.bark, [47, 0.8, z], [57, 0.8, z], 0.07);
      for (const x of [47, 50, 54, 57])
        this.box(root, C.bark, x, 0.45, z, 0.16, 0.9, 0.16);
    }
    return this.batch(root);
  }
  environment() {
    const root = new T.Group();
    for (const spec of PROPS) {
      const p = new T.Group();
      p.position.set(spec.x, heightAt(spec.x, spec.z), spec.z);
      root.add(p);
      this[spec.kind](p, spec);
    }
    // Small meadow details are batched by material, not hundreds of draw calls.
    let seed = 29041;
    const rand = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 180; i++) {
      const x = 5 + rand() * 41,
        z = 7 + rand() * 48;
      if (
        PROPS.some((p) => Math.hypot(p.x - x, p.z - z) < 3) ||
        Math.abs(x - 32) < 2 ||
        (x > 13 && x < 19 && z > 24 && z < 34)
      )
        continue;
      const y = heightAt(x, z);
      this.ball(root, C.leaves[i % 4], x, y + 0.13, z, [0.22, 0.2, 0.2], 0);
      if (i % 4 === 0)
        this.ball(
          root,
          i % 8 === 0 ? "#e4c76d" : "#b4bdec",
          x,
          y + 0.35,
          z,
          [0.13, 0.13, 0.13],
          0,
        );
    }
    return this.batch(root);
  }
  villagers() {
    const root = new T.Group();
    for (const n of NEIGHBORS) {
      const elf = this.elf(n.hat, n.skin);
      elf.root.position.set(n.x, heightAt(n.x, n.z), n.z);
      elf.root.rotation.y = n.x;
      elf.root.scale.setScalar(0.82);
      root.add(elf.root);
    }
    return this.batch(root);
  }
  dispose() {
    for (const m of this.materials.values()) m.dispose();
    this.materials.clear();
  }
}

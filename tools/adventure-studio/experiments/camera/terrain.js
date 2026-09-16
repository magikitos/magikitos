import * as T from "three";
import ground from "../../../../public/assets/js/adventure/ground.js";
const { paintGround } = ground;
export async function makeTerrain(world, signal) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d"),
    chunk = document.createElement("canvas");
  chunk.width = chunk.height = 256;
  const c = chunk.getContext("2d");
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      paintGround(c, world, x * 256, y * 256);
      ctx.drawImage(chunk, x * 256, y * 256);
    }
    await new Promise((r) => setTimeout(r, 0));
    signal.throwIfAborted();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = T.NearestFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  const root = new T.Group(),
    surfaces = [];
  const mat = new T.MeshLambertMaterial({ map: texture, color: "#ffffff" });
  const floor = new T.Mesh(new T.PlaneGeometry(64, 64), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(32, 0, 32);
  floor.receiveShadow = true;
  root.add(floor);
  surfaces.push(floor);
  const beyond = new T.Mesh(
    new T.PlaneGeometry(1000, 1000),
    new T.MeshLambertMaterial({ color: "#6e8b51" }),
  );
  beyond.rotation.x = -Math.PI / 2;
  beyond.position.set(32, -0.05, 32);
  root.add(beyond);
  const river = new T.Mesh(
    new T.PlaneGeometry(8, 1000),
    new T.MeshLambertMaterial({ color: "#427f87" }),
  );
  river.rotation.x = -Math.PI / 2;
  river.position.set(52, 0.015, 32);
  root.add(river);
  const cliff = new T.Mesh(
    new T.BoxGeometry(14, 2.4, 12),
    new T.MeshLambertMaterial({ color: "#80765b", flatShading: true }),
  );
  cliff.position.set(15, 1.2, 20);
  cliff.receiveShadow = true;
  cliff.castShadow = true;
  root.add(cliff);
  const plateau = new T.Mesh(
    new T.PlaneGeometry(14, 12),
    new T.MeshLambertMaterial({ color: "#789255" }),
  );
  plateau.rotation.x = -Math.PI / 2;
  plateau.position.set(15, 2.41, 20);
  plateau.receiveShadow = true;
  root.add(plateau);
  surfaces.push(plateau);
  // The visible shallow steps cover a continuous physical ramp, avoiding stair jitter.
  const stepMat = new T.MeshLambertMaterial({ color: "#b39d72" });
  for (let i = 0; i < 12; i++) {
    const h = (12 - i) * 0.2;
    const step = new T.Mesh(new T.BoxGeometry(4, h, 0.5), stepMat);
    step.position.set(16, h / 2, 26.25 + i * 0.5);
    step.receiveShadow = true;
    root.add(step);
    surfaces.push(step);
  }
  const bridge = new T.Mesh(
    new T.PlaneGeometry(10, 3),
    new T.MeshBasicMaterial({ visible: false }),
  );
  bridge.rotation.x = -Math.PI / 2;
  bridge.position.set(52, 0.3, 39.5);
  root.add(bridge);
  surfaces.push(bridge);
  // One draw for restrained animated ripples, not a water simulation or reflection pass.
  const coords = [];
  for (let i = 0; i < 40; i++) {
    const x = 49.2 + (i % 3) * 2.1,
      z = 4 + i * 1.5;
    coords.push(x, 0.045, z, x + 0.7, 0.045, z);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(coords, 3));
  const ripples = new T.LineSegments(
    geometry,
    new T.LineBasicMaterial({
      color: "#bedace",
      transparent: true,
      opacity: 0.25,
    }),
  );
  root.add(ripples);
  return { root, surfaces, ripples };
}

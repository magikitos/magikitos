import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
export class CameraInput {
  constructor(runtime, canvas) {
    this.runtime = runtime;
    this.canvas = canvas;
    this.keys = new Set();
    this.pointers = new Map();
    this.abort = new AbortController();
    const controls = (this.orbit = new OrbitControls(runtime.camera, canvas));
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.65;
    controls.minDistance = 12;
    controls.maxDistance = 44;
    controls.minPolarAngle = T.MathUtils.degToRad(8);
    controls.maxPolarAngle = T.MathUtils.degToRad(72);
    controls.minZoom = 0.65;
    controls.maxZoom = 2.8;
    controls.touches.ONE = T.TOUCH.ROTATE;
    controls.touches.TWO = T.TOUCH.DOLLY_ROTATE;
    const options = { signal: this.abort.signal };
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        canvas.focus({ preventScroll: true });
        this.pointers.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
          moved: false,
        });
        if (this.pointers.size > 1)
          for (const p of this.pointers.values()) p.moved = true;
      },
      options,
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        const p = this.pointers.get(e.pointerId);
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6)
          p.moved = true;
      },
      options,
    );
    canvas.addEventListener(
      "pointerup",
      (e) => {
        const p = this.pointers.get(e.pointerId);
        this.pointers.delete(e.pointerId);
        if (p && !p.moved && e.button === 0)
          runtime.walkTo(e.clientX, e.clientY);
      },
      options,
    );
    canvas.addEventListener(
      "pointercancel",
      (e) => {
        this.pointers.delete(e.pointerId);
      },
      options,
    );
    window.addEventListener(
      "keydown",
      (e) => {
        if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
        const k = e.key.toLowerCase();
        if (
          [
            "w",
            "a",
            "s",
            "d",
            "arrowup",
            "arrowdown",
            "arrowleft",
            "arrowright",
            "q",
            "e",
          ].includes(k)
        ) {
          e.preventDefault();
          this.keys.add(k);
          runtime.path = [];
        }
      },
      options,
    );
    window.addEventListener(
      "keyup",
      (e) => this.keys.delete(e.key.toLowerCase()),
      options,
    );
    window.addEventListener("blur", () => this.clear(), options);
  }
  clear() {
    this.keys.clear();
    this.pointers.clear();
  }
  movement() {
    const k = this.keys,
      dx =
        Number(k.has("d") || k.has("arrowright")) -
        Number(k.has("a") || k.has("arrowleft")),
      dz =
        Number(k.has("s") || k.has("arrowdown")) -
        Number(k.has("w") || k.has("arrowup"));
    if (!dx && !dz) return null;
    const yaw = this.orbit.getAzimuthalAngle();
    return new T.Vector3(
      dx * Math.cos(yaw) + dz * Math.sin(yaw),
      0,
      -dx * Math.sin(yaw) + dz * Math.cos(yaw),
    ).normalize();
  }
  setCamera(camera) {
    this.orbit.object = camera;
    this.orbit.update();
  }
  dispose() {
    this.clear();
    this.abort.abort();
    this.orbit.dispose();
  }
}

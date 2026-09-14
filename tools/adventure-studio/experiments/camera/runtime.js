import * as T from "three";
import { Art } from "./art.js";
import { Models } from "./models.js";
import { CameraInput } from "./controls.js";
import { makeTerrain } from "./terrain.js";
import config from "./config.js";
import model from "../../../../public/assets/js/adventure/model.js";
import movement from "../../../../public/assets/js/adventure/movement.js";
import characters from "../../../../public/assets/js/adventure/characters.js";
const { MODES, PROPS, NEIGHBORS, STOPS, heightAt, makeScene } = config;
const { World, TILE } = model;
const { move, follow } = movement;
const { facing, characterFrame } = characters;
const radians = T.MathUtils.degToRad,
  degrees = T.MathUtils.radToDeg;

/** Disposable, memory-only scene. It imports geometry/navigation, never the game engine or saves. */
export class CameraStudy {
  constructor(canvas, onChange) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.abort = new AbortController();
    this.disposed = false;
    this.ready = false;
    this.world = new World(makeScene());
    this.actor = {
      x: 32 * TILE,
      y: 42 * TILE,
      direction: "down",
      walkDistance: 0,
    };
    this.path = [];
    this.heading = new T.Vector3(0, 0, 1);
    this.clock = 0;
    this.lastTime = 0;
    this.frames = [];
    this.cpu = [];
    this.lastReport = 0;
    this.mode = "hybrid";
    this.auto = false;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "default",
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#afc4ab");
    this.scene.fog = new T.Fog("#afc4ab", 65, 130);
    this.scene.add(new T.HemisphereLight("#fff0d1", "#566148", 1.8));
    this.sun = new T.DirectionalLight("#fff2d2", 2.0);
    this.sun.position.set(12, 48, 22);
    this.sun.target.position.set(32, 0, 32);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -40,
      right: 40,
      top: 40,
      bottom: -40,
      near: 1,
      far: 110,
    });
    this.sun.shadow.bias = -0.001;
    this.sun.shadow.normalBias = 0.12;
    this.scene.add(this.sun, this.sun.target);
    this.camera = new T.PerspectiveCamera(44, 1, 0.1, 240);
    this.camera.position.set(25, 28, 57);
    this.input = new CameraInput(this, canvas);
    this.input.orbit.target.set(32, 1, 36);
    this.setView({ elevation: 52, yaw: -18, distance: 34 });
    this.models = new Models();
    this.environment = this.models.environment();
    this.scene.add(this.environment);
    this.bridge = this.models.bridge();
    this.scene.add(this.bridge);
    this.villagers = this.models.villagers();
    this.scene.add(this.villagers);
    this.villagers.visible = false;
    this.elf = this.models.elf();
    this.elf.root.scale.setScalar(0.82);
    this.elf.root.visible = false;
    this.elf.root.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    this.scene.add(this.elf.root);
    this.sprites = new T.Group();
    this.illustrations = new T.Group();
    this.scene.add(this.sprites, this.illustrations);
    this.shadow = new T.Mesh(
      new T.CircleGeometry(0.45, 24),
      new T.MeshBasicMaterial({
        color: "#25352a",
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
    this.marker = new T.Mesh(
      new T.RingGeometry(0.35, 0.44, 32),
      new T.MeshBasicMaterial({
        color: "#fff0b8",
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.art = new Art(this.abort.signal);
    this.raycaster = new T.Raycaster();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    const signal = this.abort.signal;
    document.addEventListener(
      "visibilitychange",
      () => {
        this.input.clear();
        this.lastTime = 0;
        this.loop(!document.hidden);
      },
      { signal },
    );
    canvas.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        this.loop(false);
        this.onChange({
          error:
            "El navegador ha liberado la gráfica. Recarga esta prueba; tu partida no se ha tocado.",
        });
      },
      { signal },
    );
    this.resize();
  }
  async initialize() {
    const terrainPromise = makeTerrain(this.world, this.abort.signal);
    // Attach/dispose even if a parallel texture request fails first.
    const terrainTask = terrainPromise.then((terrain) => {
      this.terrain = terrain;
      if (this.disposed) this.disposeTree(terrain.root);
      else this.scene.add(terrain.root);
    });
    await Promise.all([
      terrainTask,
      (async () => {
        await this.art.initialize();
        await this.art.prepare(["person-0-down", "person-2-down"]);
      })(),
    ]);
    this.abort.signal.throwIfAborted();
    this.playerSprite = this.art.create("person-0-down", 2);
    this.sprites.add(this.playerSprite);
    this.neighborSprites = NEIGHBORS.map((p) => {
      const mesh = this.art.create("person-" + p.variant + "-down", 2);
      mesh.position.set(p.x, heightAt(p.x, p.z) + 0.02, p.z);
      this.sprites.add(mesh);
      return mesh;
    });
    this.ready = true;
    this.renderer.shadowMap.needsUpdate = true;
    this.updateActors(false);
    this.loop(!document.hidden);
    this.report();
  }
  loop(active) {
    this.renderer.setAnimationLoop(
      active && !this.disposed && this.ready ? (time) => this.tick(time) : null,
    );
  }
  resize() {
    if (this.disposed) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    if (this.camera.isPerspectiveCamera) this.camera.aspect = aspect;
    else {
      this.camera.left = -14 * aspect;
      this.camera.right = 14 * aspect;
      this.camera.top = 14;
      this.camera.bottom = -14;
    }
    this.camera.updateProjectionMatrix();
  }
  setView({ elevation, yaw, distance } = {}) {
    const orbit = this.input.orbit,
      target = orbit.target;
    const spherical = new T.Spherical().setFromVector3(
      this.camera.position.clone().sub(target),
    );
    if (elevation !== undefined)
      spherical.phi = radians(90 - T.MathUtils.clamp(elevation, 18, 82));
    if (yaw !== undefined) spherical.theta = radians(yaw);
    if (distance !== undefined)
      spherical.radius = T.MathUtils.clamp(distance, 12, 44);
    // Clear momentum so a preset is exact even just after a drag.
    orbit.enableDamping = false;
    orbit.update();
    this.camera.position
      .copy(target)
      .add(new T.Vector3().setFromSpherical(spherical));
    this.camera.lookAt(target);
    orbit.update();
    orbit.enableDamping = true;
  }
  projection(type) {
    if (!["perspective", "orthographic"].includes(type)) return;
    if ((type === "perspective") === !!this.camera.isPerspectiveCamera) return;
    const old = this.camera;
    this.camera =
      type === "perspective"
        ? new T.PerspectiveCamera(44, 1, 0.1, 240)
        : new T.OrthographicCamera(-14, 14, 14, -14, 0.1, 240);
    this.camera.position.copy(old.position);
    this.camera.quaternion.copy(old.quaternion);
    // Match framing at the orbit target, instead of jumping to a different scale.
    const radius = old.position.distanceTo(this.input.orbit.target);
    if (type === "orthographic")
      this.camera.zoom = 14 / (Math.tan(radians(22)) * radius);
    else {
      const matchRadius = 14 / (old.zoom * Math.tan(radians(22)));
      this.camera.position
        .copy(this.input.orbit.target)
        .add(
          old.position
            .clone()
            .sub(this.input.orbit.target)
            .setLength(matchRadius),
        );
    }
    this.input.setCamera(this.camera);
    this.resize();
    this.report();
  }
  async setMode(id) {
    if (!MODES[id] || this.disposed) return;
    const request = (this.modeRequest = (this.modeRequest || 0) + 1);
    this.onChange({ pending: id });
    try {
      if (id === "illustration" && !this.illustrations.children.length) {
        await this.art.prepare(PROPS.map((p) => p.sprite));
        this.abort.signal.throwIfAborted();
        if (!this.illustrations.children.length)
          for (const p of PROPS) {
            const mesh = this.art.create(p.sprite, p.height);
            mesh.position.set(p.x, heightAt(p.x, p.z) + 0.015, p.z);
            this.illustrations.add(mesh);
          }
      }
      if (request !== this.modeRequest || this.disposed) return;
      this.mode = id;
      this.onChange({ pending: null });
      this.environment.visible = id !== "illustration";
      this.illustrations.visible = id === "illustration";
      this.sprites.visible = id !== "volume";
      this.elf.root.visible = id === "volume";
      this.villagers.visible = id === "volume";
      this.renderer.shadowMap.needsUpdate = true;
      this.updateActors(false);
      this.report();
    } catch (error) {
      if (!this.disposed) {
        this.onChange({
          notice:
            "No se pudo cargar esta variante. Puedes seguir con la actual.",
          pending: null,
        });
        this.report();
      }
    }
  }
  quality(economy) {
    this.economy = !!economy;
    this.renderer.setPixelRatio(economy ? 1 : Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = !economy;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
    this.report();
  }
  stop(id) {
    const p = STOPS[id];
    if (!p) return;
    this.path = [];
    this.marker.visible = false;
    this.actor.x = p.x * TILE;
    this.actor.y = p.z * TILE;
    const target = new T.Vector3(p.x, heightAt(p.x, p.z) + 1, p.z - 5),
      delta = target.clone().sub(this.input.orbit.target);
    this.input.orbit.target.copy(target);
    this.camera.position.add(delta);
    this.input.orbit.update();
    this.updateActors(false);
    this.report();
  }
  goTo(x, z) {
    if (!this.ready || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    const target = { x: x * TILE, y: z * TILE };
    const path = this.world.path(this.actor, target);
    if (!path?.length) return false;
    this.path = path;
    const end = path[path.length - 1];
    this.marker.position.set(
      end.x / TILE,
      heightAt(end.x / TILE, end.y / TILE) + 0.05,
      end.y / TILE,
    );
    this.marker.visible = true;
    return true;
  }
  walkTo(clientX, clientY) {
    if (!this.ready) return;
    const rect = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new T.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((clientY - rect.top) / rect.height) * 2,
      ),
      this.camera,
    );
    this.scene.updateMatrixWorld(true);
    const hit = this.raycaster.intersectObjects(
      this.terrain.surfaces,
      false,
    )[0];
    if (hit) this.goTo(hit.point.x, hit.point.z);
  }
  updateActors(moving) {
    const x = this.actor.x / TILE,
      z = this.actor.y / TILE,
      y = heightAt(x, z);
    this.elf.root.position.set(x, y, z);
    this.elf.root.rotation.y = Math.atan2(this.heading.x, this.heading.z);
    this.elf.legs.forEach(
      (leg, i) =>
        (leg.rotation.x = moving
          ? Math.sin(this.actor.walkDistance / 7 + i * Math.PI) * 0.55
          : 0),
    );
    this.shadow.position.set(x, y + 0.035, z);
    const yaw = this.input.orbit.getAzimuthalAngle();
    const direction = facing(
      this.heading.x * Math.cos(yaw) - this.heading.z * Math.sin(yaw),
      this.heading.x * Math.sin(yaw) + this.heading.z * Math.cos(yaw),
    );
    if (this.playerSprite) {
      this.playerSprite.position.set(x, y + 0.04, z);
      this.art.pose(
        this.playerSprite,
        characterFrame(0, { ...this.actor, direction }, moving),
      );
      this.neighborSprites.forEach((mesh, i) =>
        this.art.pose(
          mesh,
          "person-" +
            NEIGHBORS[i].variant +
            "-" +
            facing(-Math.sin(yaw), Math.cos(yaw)),
        ),
      );
    }
    for (const group of [this.sprites, this.illustrations])
      if (group.visible)
        for (const mesh of group.children)
          mesh.quaternion.copy(this.camera.quaternion);
  }
  tick(time) {
    const start = performance.now(),
      elapsed = this.lastTime ? (time - this.lastTime) / 1000 : 0;
    this.lastTime = time;
    const dt = Math.min(elapsed, 0.05);
    this.clock += dt;
    const before = { x: this.actor.x, y: this.actor.y };
    const vector = this.input.movement();
    const moving = vector
      ? move(this.world, this.actor, vector.x * 64 * dt, vector.z * 64 * dt)
      : follow(this.world, this.actor, this.path, dt, 64);
    if (moving) {
      this.heading
        .set(this.actor.x - before.x, 0, this.actor.y - before.y)
        .normalize();
      const delta = new T.Vector3(
        (this.actor.x - before.x) / TILE,
        0,
        (this.actor.y - before.y) / TILE,
      );
      const wantedY = heightAt(this.actor.x / TILE, this.actor.y / TILE) + 1;
      delta.y = (wantedY - this.input.orbit.target.y) * Math.min(dt * 8, 1);
      this.input.orbit.target.add(delta);
      this.camera.position.add(delta);
    }
    if (!this.path.length) this.marker.visible = false;
    const turn =
      Number(this.input.keys.has("q")) - Number(this.input.keys.has("e"));
    if (turn)
      this.setView({
        yaw: degrees(this.input.orbit.getAzimuthalAngle()) + turn * dt * 65,
      });
    this.input.orbit.autoRotate = this.auto;
    this.input.orbit.autoRotateSpeed = 0.7;
    this.input.orbit.update(dt);
    this.updateActors(moving);
    if (this.terrain && !this.reduced) {
      this.terrain.ripples.position.z = Math.sin(this.clock * 0.6) * 0.16;
      this.terrain.ripples.material.opacity =
        0.23 + Math.sin(this.clock * 0.45) * 0.04;
    }
    this.renderer.render(this.scene, this.camera);
    if (elapsed > 0 && elapsed < 0.5) {
      this.frames.push(elapsed * 1000);
      this.cpu.push(performance.now() - start);
      if (this.frames.length > 90) {
        this.frames.shift();
        this.cpu.shift();
      }
    }
    if (time - this.lastReport > 350) {
      this.lastReport = time;
      this.report();
    }
  }
  inspect() {
    const sorted = [...this.frames].sort((a, b) => a - b),
      frame = sorted[Math.floor(sorted.length / 2)] || 0;
    return {
      ready: this.ready,
      disposed: this.disposed,
      mode: this.mode,
      projection: this.camera.isPerspectiveCamera
        ? "perspective"
        : "orthographic",
      elevation: 90 - degrees(this.input.orbit.getPolarAngle()),
      yaw: degrees(this.input.orbit.getAzimuthalAngle()),
      distance: this.camera.position.distanceTo(this.input.orbit.target),
      zoom: this.camera.zoom,
      actor: {
        x: this.actor.x / TILE,
        z: this.actor.y / TILE,
        height: heightAt(this.actor.x / TILE, this.actor.y / TILE),
        frame: this.playerSprite?.userData.frame,
      },
      path: this.path.length,
      auto: this.auto,
      economy: !!this.economy,
      pixelRatio: this.renderer.getPixelRatio(),
      frameMs: frame,
      cpuMs: this.cpu.reduce((n, v) => n + v, 0) / (this.cpu.length || 1),
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      textures: this.renderer.info.memory.textures,
      geometries: this.renderer.info.memory.geometries,
      imageBytes: this.art.bytes,
      viewport: { width: this.width, height: this.height },
    };
  }
  report() {
    if (!this.disposed) this.onChange(this.inspect());
  }
  disposeTree(root) {
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    root.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          materials.add(m);
          if (m.map) textures.add(m.map);
        }
    });
    for (const item of [...geometries, ...materials, ...textures])
      item.dispose();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.loop(false);
    this.resizeObserver.disconnect();
    this.input.dispose();
    this.disposeTree(this.scene);
    this.art.dispose();
    this.models.dispose();
    this.sun.shadow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

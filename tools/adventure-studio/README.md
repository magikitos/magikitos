# Local Studio

One working version. Open the Studio, arrange the scene, and stop.
It automatically reopens your work next time. There is no project chooser,
"new draft", named copy, or live-game editor.

## Start

From the game repository:

```sh
npm ci
npm run studio
```

Open http://127.0.0.1:47832. Node 22+, PHP with GD and esbuild are required.
The Studio never connects to the website, a database, GitHub or production.
It binds to loopback and writes only its own local working files.

River/kelihouse scenes are in the same selector. The gallery includes the picnic
bin and bottle/craft states. **Río** overlays current ellipses/vectors (px/s),
land/water arrival pairs and reach exits. This overlay is read-only: topology is
authored in each scene's `navigation` JSON and checked by `check-river-core.cjs`.
Normal props/paths/crops remain editable in the single Studio workspace.
Guest scenes reuse the owner's garden/interior templates; derived guest copies
and moored boats are not exposed as independently editable duplicate source.

Player parcel editing is a different tool, inside the game: it changes that
identity's allowed decoration, never the author's map or Studio workspace.

## One interface, two tools

**Mapa** and **Archivo de pruebas** share the Studio shell and navigation. Switching tools
does not reload the document or discard unsaved map edits. Map shortcuts and
rendering pause while experiments are visible.

- `/#map`: the one autosaved map workspace.
- `/#experiments/camera`: closed free-camera comparison (illustrated / hybrid / full 3D).
- `/#experiments/forest-scale`: preserved miniature-forest scale experiment.
- `/#experiments/conversation`: closed Conversar / Acercarse comparison, archived.
- `/ui/` now opens that archive inside Studio, never a second interface.

Experiments are registered in `experiments/registry.js`, each with its own
directory and active/archived status. The forest study composes the game's shared
physics, navigation, character animation, terrain and sprite loader; it does not
boot the game, load accounts, contact the website, send events or use a game save.
Its temporary position/proportion stays in memory while switching Studio tabs.
It cannot enter the map diff or overwrite the user's working scene.

The archived sample is read-only. Its private media remain in
`.local/adventure-studio/ui-lab` and are not bundled into a public clone. It is
sandboxed within the shared shell, with all assets scoped below
`/experiments/conversation/`; leaving the archive destroys its frame to stop
audio/animation. If that historical local sample is absent, Studio explains it
without downloading anything. The original archived files are never rewritten.

### Archived experiment: Cámara libre

The owner chose the existing fixed camera. This is preserved evidence, not ongoing
work or a dependency of the playable game. All three experiments are archived.

Three independently rendered variants of one small walkable clearing: current
billboard art, volumetric surroundings with pixel characters, and an entirely
geometric maquette. Orbit, inclination, perspective/orthographic projection,
mouse wheel/pinch zoom, camera-relative walking and a reachable raised lookout.

Its WebGL renderer is a separate, lazy bundle, never part of the game or main
Studio JS. The trusted local iframe only isolates DOM/lifecycle; it makes no game
API or persistence calls. Leaving releases it instead of running a hidden 3D scene.
The original map workspace and older experiments remain independent.

Run `npm run test:camera` for isolated browser/physics/budget checks. Read the
[comparison and feasibility report](experiments/camera/README.md) for measurements,
module boundaries and the substantial work still required before adopting 3D.

### Preserved experiment: Un bosque enorme

Three relative proportions (Cercana, Diminuta, Minúscula), five jump-to viewpoints,
walking/click-to-walk/rolling, camera pan and wheel/pinch zoom. Character pixels
and camera zoom remain unchanged when selecting relative proportions.
Trees are represented by monumental roots/trunk bases; a coast continuing beyond
the scene suggests a river too large to circumnavigate. There are no human cottages.
Doors are visual concepts here, not implemented interiors or new missions.

**Arte y escala** lazily opens a separate art-direction illustration and twelve
modular sprites: six found-material homes and six forest elements. The illustration
is explicitly labeled as concept art, not a screenshot of the playable prototype.
Source images and complete built-in image-generation prompts are in
`experiments/forest-scale/art/` and `prompts.json`.

Startup mechanically packages the two sprite sheets into
`.local/adventure-studio/experiments/forest-scale/`, preserving the generated alpha
and immutable originals. Those preview packs only load when opening the experiment;
the larger concept image only loads in its art view. No experiment assets are
included in game releases.

Run `npm run test:experiments` for isolated browser checks of the shared shell,
all three scale presets, routes, lifecycle, archive, lazy art, five viewport sizes
and unchanged game source/user workspace.

## Arrange objects

Choose a scene, select a placed object or vegetation, and drag.
The inspector supports coordinates, native-pixel snapping, discrete scale
and horizontal mirroring where the art supports them. There is no rotation control:
rotating a bitmap cannot create another top-down perspective. Existing authored
orientations still render correctly. Doors, actors and critical animated props have
protected transforms. Co-located pieces (table, lighter, vase) can move as one group.

Drag the background or hold Space to pan. Wheel or pinch to zoom.
Arrow keys nudge; Shift multiplies the step by four. Cmd/Ctrl-Z and
Cmd/Ctrl-Shift-Z undo/redo the last 100 changes, including crops, paths and bodies.
Cmd/Ctrl-S saves immediately; otherwise edits save after a short pause.

## Gallery and variants

Open **Galería de elementos** in the Elements pane. Search by family/category, choose
a specific variant or **Variada · fija por objeto**, and press **Colocar**.
The object appears at the viewport centre, selected for dragging. The inspector's
variant selector changes only its artwork; quest rules and IDs remain intact.
Auto uses a deterministic scene/object hash, so a reload never shuffles the map.

The gallery includes the new woodland collection and retained compatible forest
props. Homes are not offered inside interiors. Ferries, stairs and the quest knife
are inspectable artwork but cannot be added as incomplete gameplay objects.
Planters/crates placed as entities inherit the reusable pushing capability.

**Retirar** supports added props and nonfunctional decorative objects. It refuses
quest objects, entrances, products, actors and other functional entities.
Additions/removals/variants share undo, redo, autosave and the one reviewed diff.
No map change is applied live to the game. See [the collection contract](../../docs/WOODLAND-KIT.md).

## Edit paths

Choose an outdoor scene and switch from **Elementos** to **Caminos**.

- Select a road on the map or in the list; drag its circular points.
- **Insertar punto** then click a segment to add a bend. **Borrar punto** removes
  the selected bend (a road needs at least two points).
- **Nuevo camino**: click its points, then **Terminar** or Enter. Esc cancels;
  Backspace removes the last unfinished point.
- **Borrar camino** removes the selected road. All committed edits support the
  same undo/redo and autosave as objects; nothing is applied to the game.
- Hold Space or activate **Mano** to pan. Wheel/pinch zoom; a pinch cancels the
  pending single-pointer gesture without accidentally drawing or moving a point.
- Coordinates/snapping use tile units (16 native pixels). Arrow keys nudge the
  selected point; Shift multiplies the step by four.

Paths are scene `paths` polylines, not image strokes. Their width, edges and
material remain shared renderer rules, so junctions keep the game's appearance.
During a drag the line previews instantly; releasing rebuilds the ground once.
The Studio freezes scenery: changing a road never redistributes the forest.
Water, walls, bridges, buildings and collisions do not move with a path. Inspect
those separately before applying a proposal; drawing over water is not a bridge.

A paths-only edit (including deleting every road) appears in **Ver cambios**,
`studio:diff` and exports as `paths: {before, after}`. Concurrent source topology
edits require explicit review; indices are never guessed or silently merged.

## Crop images

Select an object and open **Recorte del sprite**. Drag the green corners or
enter integer native-pixel values. **Ajustar al dibujo** finds its visible pixels.
The checkerboard indicates transparent space; the orange cross is the foot anchor.

A crop belongs to the **sprite definition**, so all instances of that furniture
share it. It does not change the source image, the object's position, scale or
physical body. Cropping moves the frame window and its foot anchor together.
Changing a source asset remains a separate art operation.

The editor reconstructs the uncropped native canvas from editor-only art packs.
The game never loads those preview packs or scans image pixels at startup.

## Collision bodies

**Colisión · cuerpo físico** shows the collision independently in blue.
Offsets and dimensions are in native pixels relative to the object's foot.
Existing furniture bodies are editable; derived doors, stairs and actors are
protected. The renderer and physics both apply the object's supported transform.

Do not crop a tree canopy to "fix" the trunk collision. A tree's visible canopy
and its physical trunk intentionally have different sizes.
Turning on collision inspection also shows architectural walls and door thresholds.

## Tell the agent

> He cambiado las escenas.

The agent runs:

```sh
npm run studio:diff
node tools/adventure-studio/review.cjs --full
```

The first command prints a concise before/after diff; `--full` includes proposed
scene JSON. `/api/diff` and **Exportar diff** provide the full review payload.
The agent reviews and edits the source scenes/asset definitions, then rebuilds
and tests. There is deliberately **no apply or deploy endpoint** in the Studio.

When the source changes, a three-way comparison drops edits already applied,
keeps nonconflicting changes, and preserves conflicts for explicit review.
A stale browser tab cannot overwrite a newer save: revisions are concurrency
tokens, not separate user-facing drafts.

Generated vegetation is frozen in the reviewed scene proposal so moving a table
cannot inadvertently regenerate the forest. Behaviors and rules remain intact.
When transferring positions, apply only changed placement fields: do not copy
unchanged, inherited behavior bodies into the source as redundant overrides.
Interior exits link to exterior portal IDs (`arrivalAt`), and saved entrances use
the same IDs, so relocating a house does not leave its return point behind.
Always validate reachability and entry/exit after placing a building.

## Local working files — preserve these

- `workspace.json`: the one editable version.
- `snapshots/`: immutable source baselines, identified by content hash.
- `history/`: recovery copies, not a user-facing draft system.
- `imported-drafts/`: one-time backup of the previous Studio data on this Mac.
- `art/`, `build/`: generated editor previews and bundle.
- `experiments/`: generated isolated experiment preview packs.
- `ui-lab/`: the preserved comparison laboratory and local media.

All live below `.local/adventure-studio/`, ignored by Git.
**Never delete the whole directory as build cleanup.** Scene builds do not touch
`workspace.json`, snapshots, history or the Lab.

The server validates Host, Origin, a per-process write token, payload size,
scene/entity identifiers, supported transforms, sprite crops and collision
dimensions. Writes are atomic. Two tabs cannot silently overwrite each other.

## Scope

The active **Laboratorio → Duendes** experiment presents four character families,
an equal-scale forest comparison and the planned action catalogue. See its
[guide](experiments/duende-cast/README.md). It never edits this workspace or the game.
Trazo y vida is now archived: **2× integrated reduction and selective motion** were
approved; see the [decision](../../docs/art-direction/DEFINITION-MOTION.md).
Earlier camera, scale and conversation experiments remain in the same shell.

The Studio edits objects, sprite variants/crops, collision bodies and outdoor paths.
It adds reviewed family templates and safely removes decorations. It does not paint
water, invent quest behaviors, change destinations or edit rewards.
Architectural walls remain declarative scene data. The shop preview is the base
room; live product displays are generated by the game's browser-side layout.

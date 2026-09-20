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

River/shared-clearing scenes are in the same selector. The gallery includes the picnic
bin, ground bottle, collectable twigs and cleaning-leaf plants. **Río** overlays current ellipses/vectors (px/s),
land/water arrival pairs and reach exits. This overlay is read-only: topology is
authored in each scene's `navigation` JSON and checked by `check-river-core.cjs`.
Normal props/paths/crops remain editable in the single Studio workspace.
Guest scenes reuse the owner's garden/interior templates; derived guest copies
and moored boats are not exposed as independently editable duplicate source.

Shared construction is a different, API-authorized in-game tool. It changes
permitted community clearings, never the protected adventure or Studio workspace.

## One tool

El Studio es el **Mapa** y nada más. Los cinco laboratorios archivados —cámara libre, escala del
bosque, conversar/acercarse, trazo y vida, y el reparto de duendes— se borraron enteros el
17-sep-2026 por decisión del dueño: eran evidencia conservada de decisiones ya tomadas, y esas
decisiones viven donde tienen que vivir, en el arte y en la documentación de dirección. Con ellos
se fueron su pestaña, su registro, sus rutas, sus 27 MB de material de comparación y sus cuatro
comprobaciones de navegador.

Lo aprobado que SIGUE mandando: **2× con reducción integrada y movimiento selectivo**, en
[la decisión de trazo y vida](../../docs/art-direction/DEFINITION-MOTION.md); la cámara del juego
es FIJA; y Ascua es el protagonista con los otros once duendes como vecinos.

## Arrange objects

Choose a scene, select a placed object or vegetation, and drag.
The inspector supports coordinates, native-pixel snapping, continuous scale (25–300% where allowed)
and horizontal mirroring where the art supports them. There is no rotation control:
rotating a bitmap cannot create another top-down perspective. Existing authored
orientations still render correctly. Doors, actors and critical animated props have
protected transforms. Co-located pieces (table, lighter, vase) can move as one group.

Shift/Cmd/Ctrl-click on the map or object list toggles individual selections.
Shift-drag empty ground selects a rectangle. **Selección múltiple** provides the
same operation without a keyboard: tap objects to add/remove them, draw a box
from empty ground, or drag an already-selected object to move the whole group.
Arrow nudges also move the group; one undo restores the complete operation.
Translations clamp as a group at map boundaries, preserving relative spacing.

Backspace/Delete removes the selected decorations and gallery additions. Inputs
keep their normal text editing, and functional objects remain protected. A mixed
selection removes only its permitted objects and keeps protected ones selected.

Drag the background or hold Space to pan. Wheel or pinch to zoom.
Arrow keys nudge; Shift multiplies the step by four. Cmd/Ctrl-Z and
Cmd/Ctrl-Shift-Z undo/redo the last 100 changes, including crops, paths and bodies.
Cmd/Ctrl-S saves immediately; otherwise edits save after a short pause.

You can edit several scenes before asking the agent to apply them. Changes are
stored per scene in the same workspace; choosing another scene does not discard
them. Finish pending path/fence drawings before switching (unfinished previews
are not saved). Before closing, use **Guardar ahora** or wait for **Guardado
automático**. The reviewed diff includes all edited scenes. Applying only some
of them keeps the others pending, including sprite crops. After the agent updates
the source, reload the Studio tab before continuing; stale revisions cannot
overwrite newer work. Prefer one editing tab at a time.

## Gallery and variants

Open **Galería de elementos** in the Elements pane. Search by family/category, choose
a specific variant or **Variada · fija por objeto**, and press **Colocar**.
The object appears at the viewport centre, selected for dragging. The inspector's
variant selector changes only its artwork; quest rules and IDs remain intact.
Auto uses a deterministic scene/object hash, so a reload never shuffles the map.

The gallery includes the woodland collection, resident library and forest props.
**Recogibles** contains **Palo recogible**, **Planta culilimpia** and **Botella tirada**.
They export reusable behaviors, not inert decorations. When incorporating new
twigs/plants the agent appends their stable resource IDs as described in the
[authoring contract](../../data/aventura/REFACTOR.md#recogibles-en-el-studio).
Moving existing pickups never changes IDs or collected state. Homes are not offered inside interiors. Ferries, stairs and the quest knife
are inspectable artwork but cannot be added as incomplete gameplay objects.
Planters/crates placed as entities inherit the reusable pushing capability.

**Retirar** supports added props and nonfunctional decorative objects. It refuses
quest objects, entrances, actors and other functional entities.
Additions/removals/variants share undo, redo, autosave and the one reviewed diff.
No map change is applied live to the game. See [the collection contract](../../docs/WOODLAND-KIT.md).

## Entradas de casas y salidas (20-sep-2026)

Selecciona una casa, la taberna, el taller o la salida de un interior y el inspector enseña
**Entrada · por dónde se cruza la puerta**: la franja azul del mapa que abre la puerta al pisarla
andando hacia ella, en casillas relativas al pie naranja (ΔX, ΔY, ancho, alto), y el punto azul
donde se llega al salir. Por defecto es **automática** (el compilador la deriva del pie y del
cuerpo, como siempre). Si el dibujo de una casa tiene la puerta a un lado y «no cuadra», cambia
los valores o **arrastra la franja azul** en el mapa: se guarda como `entrance` en la escena y
`data/aventura/world.php` la convierte en el mismo umbral y llegada que una puerta derivada, así
que el motor, el contrato del bosque vivo y las pruebas no notan la diferencia. Límites: hasta 12
casillas del pie, de ¼ a 2 casillas de ancho, de 1 a 8 píxeles de alto; las escaleras no admiten
entrada dibujada (su rellano sale de su cuerpo). **Volver a la entrada automática** la borra. El
inspector avisa si la franja cae sobre un cuerpo o agua. Mover la casa arrastra su franja con
ella, tanto la automática como la dibujada. Paridad PHP/JS: `check-door-geometry.cjs`; el editor
en navegador, `npm run test:studio-entrance`.

## Continuous fences

**Vallas** starts a single connected fence: click/tap its corners, then **Guardar
trazado** or Enter. Horizontal, vertical and diagonal sections share corner posts;
intermediate posts are spaced automatically. The end of another fence attracts
the pointer for alignment. Leave a gap where the player needs to pass.

Select a fence and choose **Editar trazado** to drag corners, click a segment to
insert a point, or click beyond the end to extend it. Backspace removes the
selected corner (otherwise the last one); Esc cancels the pending edit. The
entire finished polyline uses normal undo, autosave, diff and source review.
**Valla continua** is also available in the gallery.

The data is an anchor plus `fence.points` in relative tile coordinates, not
overlapping rotated sprites. The shared game/Studio renderer keeps wooden posts
upright and depth-sorts individual spans. Physics follows the thin fence line,
not its enclosing rectangle. Geometry/render parts are cached. Resize by moving
vertices, not by stretching a bitmap. Up to 64 vertices and 256 tiles per line;
all vertices must stay inside the scene. This edits authored scenery, not the
API-authorized community building system or its costs/permissions.

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
Interior exits link to exterior portal IDs (`arrivalAt`), and saved return points use
the same IDs, so relocating a house does not leave its return point behind. The door's
own `entrance` (the strip that opens it) is edited in the inspector, see «Entradas».
Always validate reachability and entry/exit after placing a building.

## Local working files — preserve these

- `workspace.json`: the one editable version.
- `snapshots/`: immutable source baselines, identified by content hash.
- `history/`: recovery copies, not a user-facing draft system.
- `imported-drafts/`: one-time backup of the previous Studio data on this Mac.
- `art/`, `build/`: generated editor previews and bundle.

All live below `.local/adventure-studio/`, ignored by Git.
**Never delete the whole directory as build cleanup.** Scene builds do not touch
`workspace.json`, snapshots or history.

The server validates Host, Origin, a per-process write token, payload size,
scene/entity identifiers, supported transforms, sprite crops and collision
dimensions. Writes are atomic. Two tabs cannot silently overwrite each other.

## Scope

The Studio edits objects (individually or in groups), sprite variants/crops,
collision bodies, continuous fences and outdoor paths.
It adds reviewed family templates and safely removes decorations. It does not paint
water, invent quest behaviors, change destinations or edit rewards.
Architectural walls remain declarative scene data. Every room is what its scene
file says: nothing in the forest is generated from a remote catalogue.

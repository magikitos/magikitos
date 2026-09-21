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

⛔ **UNA SOLA FRANJA ARRIBA** (21-sep-2026, decisión del dueño: «quita cosas estúpidas
que pillan espacio en la pantalla como toda la barra de cabecera y los botones gordos
de guardar ahí en el medio»). La marca, la barra de proyecto y la navegación eran tres
filas que se comían 180 píxeles de mapa; ahora hay una. A la izquierda, el selector con
TODAS las escenas y, al lado, **las conectadas**, con flechas para las vecinas del mapa
y una casa para los interiores: sus destinos y nombres proceden de las salidas/puertas
y textos actuales, sin otra lista que mantener. Un clic cambia de escena; al volver se
recuperan el zoom y el encuadre de esa sesión. A la derecha solo queda lo que hace
falta saber: si está guardado, cuántos cambios hay y el botón de guardar ya. El
guardado es automático de todos modos; no se exporta ningún diff a mano, porque el
agente lo lee de `/api/diff`. Los cambios de distintas escenas
se conservan juntos y siguen guardándose automáticamente.

**Ocultar árboles / Mostrar árboles** filtra los árboles de ambas familias,
incluidas sus variantes, los colocados manualmente y los delimitadores de copas. Las flores, arbustos,
helechos, setas y casas permanecen. Un árbol oculto no se puede seleccionar ni
mover/borrar accidentalmente; desaparece también de la lista y de la superposición
de colisiones. Es una vista del editor: no borra datos, no entra en deshacer/diff,
no cambia la física ni se aplica al juego. La preferencia se recuerda en este
navegador, separada del archivo de trabajo. Pruebas: `npm run test:studio-navigation`.

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

Open **Galería de elementos** in the Elements pane. Search by family/category and choose
a specific variant or **Variada · fija por objeto**. **Drag the card onto the map** and it
lands exactly where you drop it, snapped to the current step — that is the normal way
(owner, 21-sep-2026: "quiero hacer directamente drag de elementos desde la barra lateral,
no que se añadan en el centro y yo tener que moverlo"). **Colocar en el centro** stays for
the keyboard. A new copy carries no body of its own: it inherits the element's. The inspector's
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

### Delimitadores

La categoría **Delimitadores** ofrece 16 piezas originales: arboledas en perspectiva 2.5D y rocas
musgosas, cada material con dos tramos horizontales, dos verticales y cuatro esquinas.
Cada tramo termina de forma natural por ambos lados: se puede dejar suelto, dejar
un paso, alternar materiales o solapar ligeramente sus extremos para alargarlo.
No es un marco obligatorio ni un tile recortado. Las esquinas están dibujadas como
una formación curva completa, no ensambladas cruzando dos rectas. Para cambiar de
lado usa las variantes ┌ ┐ └ ┘; no gires un bitmap para inventar otra perspectiva.

Elige la pieza y su longitud/orientación explícita, pulsa **Colocar** y ajusta
posición/escala. El ancla está en el centro. Un solape moderado de los remates
(aproximadamente 2–4 casillas al 100%, según la pieza) suele bastar: compruébalo al
zoom del juego. Puedes combinarlas libremente; no hay encaje automático forzado.
El filtro de árboles oculta las copas, pero deja las rocas. Si está activo, vuelve
a **Mostrar árboles** para colocar copas y verlas.

Son elementos fijos, no empujables, del catálogo compartido del juego y Studio.
Cada tramo tiene cuerpos conservadores (tres en las arboledas verticales, siguiendo sus raíces); cada esquina tiene dos cuerpos que siguen
su L y dejan libre el hueco interior. La escala y el reflejo transforman también
los cuerpos. Antes de aplicar colocaciones se comprueban los pasos y las salidas:
un delimitador no debe cerrar una conexión a una escena vecina.

Todo queda en el único archivo de trabajo habitual, con deshacer, borrado,
guardado y diff. Guardar en Studio no publica nada: el agente revisa el diff,
aplica las colocaciones y verifica el mapa antes de generar una nueva entrega.

- Catálogo compartido: `data/aventura/elements.json`; paquetes:
  `data/aventura/assets/delimiter-grove.json` y `delimiter-rock.json`.
- Originales, recortes, coordenadas, hashes y prompts:
  [rocas](../../data/aventura/art/delimiters) y
  [arboledas 2.5D](../../data/aventura/art/forest-market).
- `catalog.js` expone las mismas familias y variantes que el juego, sin catálogo
  paralelo. Los identificadores originales se conservan para las colocaciones guardadas.
- Reconstrucción técnica: `php tools/adventure-studio/prepare-delimiters.php` (rocas)
  y `php scripts/prepare-forest-market.php` (arboledas).
  Conserva originales, limpia únicamente el mate y verifica extremos sin cortar.
- El empaquetador habitual prepara dos paquetes **2× / reducción integrada**,
  cargados bajo demanda por material. El Studio usa su caché local de ese mismo
  empaquetador. No hay escaneo alfa al dibujar.
- Pruebas: `npm run test:studio-delimiters`. El navegador usa un workspace temporal,
  nunca el archivo de trabajo del dueño.

La noche y el corrillo de cuentos se anclan a `story-fire`: al mover la hoguera,
`scene-anchors.js` resuelve su centro y el del fuego desde la entidad, tanto en
Studio como en el juego. No hay coordenadas de ambiente duplicadas que actualizar.

## Cuerpo y entrada de un elemento (21-sep-2026)

⛔ **SON DEL ELEMENTO, NO DE LA COPIA** (decisión del dueño: «esos valores deben ser relativos a
ese elemento, en TOOODAS sus instancias, no solo la que estoy editando»). Un cartel tiene un
cuerpo; los doce carteles del bosque tienen ESE cuerpo. Antes cada copia llevaba el suyo escrito
encima, así que ajustar uno no arreglaba los otros once.

Selecciona un elemento y pulsa **Editar en el mapa**. Mientras el editor está abierto manda él:
arrastrar el fondo ya no mueve el mapa —así una caja se dibuja sin que el suelo se escape debajo—
y la vista se acerca al elemento. Arrastra dentro de una caja para moverla, de una esquina o un
lado para redimensionarla; las flechas la empujan (con Mayús, cuatro pasos) y ⌫ la borra. Los
mismos cuatro números están en el panel para escribirlos a mano. **Añadir caja** da hasta seis
—un arco con dos patas y el hueco libre en medio—, y **Entrada** añade la franja por la que se
cruza una puerta. `Enter` guarda, `Esc` cancela, **Volver al original** deshace lo tanteado.

Lo que se guarda va a la VARIANTE de la familia en `data/aventura/element-families.json`
(`solids`, `entrance`) y de ahí lo heredan todas sus copias, las puestas y las que pongas después;
el panel dice cuántas son antes de tocar nada. Si el elemento aún no tiene familia, se escribe en
todas sus copias del bosque a la vez, en todas las pantallas, y el panel también lo dice. Al
guardar se RETIRAN los cuerpos sueltos que cada copia llevaba encima: si no, la copia antigua
seguiría ganando y el cambio no se vería.

La entrada sigue siendo la franja que abre la puerta al pisarla andando hacia ella, en casillas
relativas al pie, y `data/aventura/world.php` la convierte en el mismo umbral y llegada que una
puerta derivada, así que el motor, el contrato del bosque vivo y las pruebas no notan la
diferencia. Límites: hasta 12 casillas del pie, de ¼ a 2 casillas de ancho, de 1 a 8 píxeles de
alto; las escaleras no admiten entrada dibujada (su rellano sale de su cuerpo). Paridad PHP/JS:
`check-door-geometry.cjs`; el editor en navegador, `npm run test:studio-entrance`.

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

Bodies are drawn in blue on the map and edited there, per ELEMENT — see «Cuerpo y
entrada de un elemento». Offsets and sizes are tiles relative to the object's
foot, and the renderer and physics both apply the object's supported transform,
so what you drag on a scaled or mirrored copy is what the game gets.

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
scene JSON. `/api/diff` provides the full review payload; the **Cambios** chip in the
scene strip shows the same thing on screen.
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

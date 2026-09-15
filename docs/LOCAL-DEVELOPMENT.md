# Local development and polish

## Safety boundary

These changes are local only. No SSH/VPS operations, production import, database
migration, commit, push or deployment is part of the tooling. The user's existing
DDEV database and media are sufficient. Missing local media should be diagnosed
locally, never fetched from production automatically.

The authoritative game working tree is the public game repository. The website
remains its own private repository. The preview serves its own
static shell, engine, CSS, world data and translations. The optional local
website supplies only JSON APIs and public media; it never supplies HTML to
the game. The separate repositories share a documented API, not source code.

## Commands

```sh
npm ci
npm run dev
npm run studio
npm test
npm run test:browser
npm run test:studio
npm run test:experiments
npm run screenshots
npm run studio:diff
npm run test:native
npm run test:api:local
npm run install:local
# For the no-website regression, another terminal:
GAME_PORT=47838 npm run dev:offline
# Then:
npm run test:boundary
```

Game: http://127.0.0.1:47834/aventura; Studio: http://127.0.0.1:47832;
installed same-origin integration: https://magikitos.ddev.site/aventura.
Studio has Mapa and Laboratorio tabs. The active isolated scale experiment is at
http://127.0.0.1:47832/#experiments/forest-scale; the previous A/B UI experiment is
archived in the same shell at `/#experiments/conversation`. These do not alter the
game, map workspace or saved progress. See the [Studio guide](../tools/adventure-studio/README.md).
Run servers in separate terminals. No package download occurs during a server
start; install the declared development dependencies explicitly with `npm ci`.
Alternatively set `WORLD_ESBUILD` to an installed esbuild binary.
Browser scripts support `PLAYWRIGHT_MODULE` for an existing local installation.

The build creates `.local/build/releases/ID/` (six static pages, game bundles,
fonts/license and native packs), an atomic current pointer and a compiled-world
test fixture, plus
`public/assets/aventura/` (native content-addressed sprite packages).
Source art is not served by the preview. The Studio compiles its own full native
previews into its private local directory for non-destructive recropping.

## Visual foundation

- `ground.js`: deterministic native-pixel grass/path/water materials, computed
  once per bounded cached terrain chunk. Paths are a union, not stacked strokes.
  Visible chunks are pinned: zoom-out can exceed the old 24-chunk cache without
  rebuilding the screen every frame. Unneeded chunks are evicted with a bounded
  viewport-aware budget. Material calculations hoist row/lattice work out of pixel loops.
- `water.js`: sparse, world-anchored slow ripples. No terrain invalidation each frame.
- `interior-ground.js`: cached wood boards, stone foundations and a painted,
  non-walkable garden around the cutaway. Negative chunks are valid presentation.
- `interiors.js`: plaster/timber walls, roof-cut edges, woven rugs, window light
  and open south thresholds with low stone steps.
- Scene `walls`: footprint rectangles in tiles, shared with physical collisions.
- `house` and `attic`: a two-level interior linked by automatic stairs.
- `cottage`: still the small one-bed house with the lighter, table and vase.
- `interior-details`: eight independent original furniture/architectural sprites.

The reference study in `docs/art-direction/` is concept art, not a screenshot
or a promise that every feature shown there is already playable. External
reference images are not bundled in the repository.

## Camera and input

Wheel and two-finger pinch adjust one world scale: terrain, actors, decorations,
hit testing and movement all share the same coordinate system.
The default outside view is the maximum interactive zoom; zoom-out stops at the
larger of the preferred minimum and the scale required to cover the viewport.
Interiors deliberately do **not** scale up to fill the viewport: that made a tiny
house and its inhabitants enormous. Maximum scale is 1.5 CSS pixels per native
pixel below 600 CSS pixels of width, and 2 otherwise; room zoom-out stops at 70%.
Reading an activity never adds magnification indoors. The full room is centered
on any axis where it fits; larger rooms follow the player with a 16-pixel framing
margin. Around it, cached garden/foundations fill the visible canvas, not black
bars. This is a cutaway presentation, not an extension of walkable room geometry.
Taps outside the physical room are inert.

`scene-frame.js` owns camera limits and visible chunk ranges, shared by following,
rendering and terrain-cache pinning. Physics still uses the original room bounds.
Debug `inspect().bounds` reports actual runtime dimensions: the workshop can grow
when its optional JSON product catalogue arrives.

Camera position is clamped after following, dragging and resize. A pointer gesture
becomes a drag after 8 CSS pixels; only a completed tap sets a destination. Dragging
pauses travel and detaches the camera; the contextual bottom-right button recenters.
Pinch gestures cancel walking and suppress both release taps. Wheel/pinch preserve
the focus point when detached. Double taps and double Space still request one roll;
held Space runs. Tap travel chooses pace from route distance, not screen pixels.
See [mobility and Brizno](MOBILITY-BRIZNO.md) for thresholds and regression tests.

Transitions have no loading modal: the current scene stays rendered while the
destination prepares. Nearby door destinations are prewarmed as the player approaches, without polling
the server or loading every scene. Data-saver connections skip prewarming.
Initial startup paints the actual terrain while the native sprite packs arrive.
A real startup failure still shows a visible error.

## Portals

Doors use narrow thresholds at the physical entrance. The compiler sets
`entryDirection: -1` for exterior entry (up) and `+1` for interior exit (down).
Standing still, retreating or passing sideways cannot activate them. Movement
substeps carry the intended direction, including keyboard, rolling and tap
navigation; vertical motion must dominate or equal horizontal motion.
`portalPath` routes taps to the front before crossing vertically and uses an
exact final waypoint, not a snapped navigation-grid center.

Stairs retain spatial arrival protection: a landing occupied on arrival is
suppressed until the player leaves it. This latch is not needed on directional
doors, so resuming a save in a doorway cannot require stepping back first.
There is no blind timer during which a narrow doorway could be crossed.

Stairs cover the full front landing up to their physical face, allowing lateral
approaches and preventing a player from standing just past the active area.
Travel still prepares a valid destination before committing inventory or fares.

An interior exit uses `{type: "travel", scene: "overworld", arrivalAt: "human-door"}`
(with its own exterior portal ID), not a second copy of the building coordinates.
The offline compiler resolves and validates the reference after deriving all
portal geometry. Saved entrances store `{scene, portal}`; `portals.js` resolves the
current arrival when returning. Moving a building in Studio therefore moves its
threshold, normal exit and resumed-save return together. Coordinates in a former
entrance snapshot are not used; the scene's linked exit is the fallback.

## Cropping and physical geometry

Asset definitions may contain `crop: [x, y, width, height]` in native-canvas pixels.
The offline builder removes isolated source debris **before fitting** an object,
then trims transparent margins after native preparation. It preserves
`nativeSize`, `trim`, `crop` and adjusted `anchor` in frame metadata.
Actors retain fixed animation canvases.

The original artwork is immutable. An anchor can legitimately lie outside a
cropped frame. Cropping cannot silently shift an object or resize its collision.
Bodies use exact transformed pixel bounds rather than expanding to whole tiles;
a spatial grid indexes furniture, vegetation and architectural walls, while moving
actors keep live bounds.
Navigation still uses a conservative grid and validates physical substeps.
It checks live residents and full collision bodies along every planned segment;
click intention and dynamic rerouting are documented in [navigation](NAVIGATION.md).

## Regression checks

Pure tests cover scene reachability, item-order independence, wallet transactions,
saved needs, geography, shoreline footprints, animated transport, modular assets,
camera coverage, crop anchors, Studio validation, conflicts and rebase.

The browser suite uses fresh isolated browser storage and a temporary Studio
workspace, never the user's working edits. It exercises seven desktop/tablet/
phone viewports, native touch pinch, taps, wheel limits, stairs both ways, lateral
approach immunity followed by deliberate door exits, ferry movement lock and fare,
crop/body editing and autosave/reload. `npm run test:studio` additionally exercises
path dragging, insertion/deletion, complete road creation/removal, validation,
undo/redo, saved diffs, mobile/tablet layouts and pinch cancellation in an isolated
workspace. No source scene is modified by these browser tests.
Screenshots are generated under `.local/screenshots/`.
`npm run test:journeys` tests ground-versus-object clicks, static/resident detours
and close-without-reopening on desktop, tablet and mobile. Its scene exists only
in an intercepted test response; neither game nor Studio scenes are edited.
`npm run test:zoom` checks the wider automatic starting view, orientation/resize,
manual zoom override and complete map coverage from 320px phones to 3440px monitors.
It preserves the old closest manual view and never changes the player's position.
Screenshots are written to `.local/zoom-review/`.

The regular website, live checkout and account minting are not mutated by these
tests. Optional forms which need external human-proof services are not bypassed.

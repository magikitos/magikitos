# Local polish review · 2026-09-13

## Try it

- Game: http://127.0.0.1:47834/aventura
- Studio: http://127.0.0.1:47832
- Preserved UI Lab: http://127.0.0.1:47832/ui/

These are local processes, not deployments. Restart with `npm run dev` and
`npm run studio` from this repository; the community APIs use
the existing local DDEV website, while the world can also run offline. No production data is needed.

## Delivered

- One autosaved Studio workspace, crop handles/numeric inputs/alpha fit,
  independent pixel-precise collision bodies, undo/redo, reviewed diffs and
  conflict protection. No live apply endpoint.
- Previous Studio placements incorporated in the source scenes; prior data
  retained for recovery. At handoff, the current workspace has no unapplied
  scene edits, sprite edits or conflicts.
- Offline source-debris cleanup and tight native frames, with stable foot
  anchors and immutable original art. No browser pixel scan on game startup.
- Modular original interior artwork, warmer floors and timber/plaster walls,
  depth-sorted partitions and walk-through stairs linking the house to an attic.
- Calmer grass, unified earthen paths, layered teal water and subtle ripples.
  The exterior map has not been expanded. Outdoor cliffs/terraces remain
  concept direction; there is no general-purpose elevation editor yet.
- Shared wheel/pinch zoom, camera coverage constraints, gesture arbitration,
  precise indexed collisions and spatial portal arrival protection.
- Scene-level lazy sprite loading, deduplicated/prewarmed requests, bounded
  asset retention and visible terrain chunks pinned against cache thrashing.
  Scene changes keep rendering rather than showing a loading modal.
- Reproducible build, tests, original art study and reusable asset prompts.

Superseded generated pack files were moved to the local safety backup
`/tmp/magikitos-polish.I1ylLi/obsolete-packs/`; original source artwork and the
user's Studio work were not removed. Current packs are reproducible.

## Verification actually run

- `npm test`: 98 collision-safe interaction routes; all recipe ingredient
  orders; reward/fare rules; saved needs; 34,403 dry standing points; eight-way
  rolling; portal substeps; modular asset loading; camera coverage; collision
  spatial index versus brute force; Studio validation/rebase/recovery; native
  cropping/anchors; account-modal challenge behavior.
- `npm run test:browser`: Chrome, isolated storage and local-only requests.
  Viewports: 320×568, 390×844, 844×390, 768×1024, 1024×768, 1440×900, 2560×1440.
  Wheel limits, actual two-finger touch events, taps, stairs both ways, lateral
  exits, animated ferry/immobilized passengers/fare, Studio crop/body autosave
  and reload, and rejected cross-origin Studio writes.
- All six translated game routes start successfully. Studio checked at
  390/768/1440 widths without horizontal overflow; retained UI Lab responds
  without browser exceptions.
- Visual inspection of outdoor, zoomed-out, house, attic, cottage, phone and
  Studio screenshots. Generated under `.local/screenshots/`.
- PHP syntax checks, `git diff --check`, and a credential-pattern scan of
  present tracked/untracked text files (no matches). This is not a full
  security audit of repository history.

## Performance sample, not a device guarantee

Warm local DDEV + headless Chrome, 1440×900:
ready in 358 ms normally and 642 ms with 4× CPU throttling in one measured run.
The normal run had one 84 ms startup long task; the throttled run had
289/113/52 ms tasks. Zoom-out no longer caused continuous terrain rebuilding.

The complete native PNG library is 244,971 bytes across 26 packages
(301 frames). The starting outdoor scene loads most outdoor packs; this is
**scene-level**, not per-object viewport streaming. Other interiors load when
needed. Full source images are not served to the game.

These numbers are local samples, not 4G measurements or physical iPhone/Android
testing. Actual Safari/iOS testing and a production release review remain
necessary before treating this as a release candidate.

## Completed runtime separation

The game now owns a static six-language shell and native JSON-fed activities.
No website HTML, CSS or script bundles are loaded into it. The private engine
copy, PHP adventure views, capture interceptors and HTML-fragment endpoint have
been retired with a recoverable local backup. The host mounts a verified,
immutable static artifact before website bootstrap.

See [the completed boundary](REPOSITORY-BOUNDARY.md), [API](API.md) and
[local development](LOCAL-DEVELOPMENT.md). Identity, ratings and guardian retain
the website's existing server-side validation through JSON endpoints.
Protected success paths are browser-tested with mocks, not live account/vote/
model writes. The standalone offline world remains playable without the API.

The performance sample above predates the final extraction and is retained as
such; it is not a measurement of the new build. No production host was contacted,
no production DB imported, and no changes committed, pushed or deployed.
## Final extraction verification

The final static/JSON build passed the pure suite, all seven viewport regressions,
twenty-five native activity/viewport combinations, six local API locales and the
no-website/protected-action boundary suite. The private static mount also passed
its PHP-only test with no database/session functions loaded. No obsolete world
hooks remain in normal website source or compiled JavaScript.

A new local sample after extraction measured **252 ms to ready**, or **501 ms
with 4× CPU throttling**, in headless Chrome at 1440×900. Startup long tasks were
123 ms normally and 361 ms with throttling; these are measurements, not a claim
of zero main-thread cost or a physical-device/4G guarantee. Native sprite requests
and metadata transferred about 303 KB in that run; the complete PNG library is
still 244,971 bytes. Assets remain scene-loaded, not downloaded at source size.

Private superseded game source is recoverable at
`/tmp/magikitos-api-split.jC2p25/retired-web-source/`. The user's Studio workspace
has no pending scene/sprite changes or conflicts after automatic rebase.

## Interior framing and ground polish — follow-up

This pass responds to the oversized human-house interiors and the flat green
oval visible beside the barbecue. Local installed artifact:
`579e9a1e3a5961445e36`. No production action.

- Removed both authored flat ground ellipses and their renderer loop. Paths now
  remain part of the single ground-material raster, never covered by a solid
  clearing decal. Fire bounce also fades to zero instead of drawing a hard oval.
- Reduced grass shade contrast, added restrained path pebbles and shoulder
  grasses. Native-pixel materials remain deterministic and cached.
- Separated physical indoor geometry from camera presentation. Small rooms
  no longer force magnification to cover tall/wide screens; a painted garden
  and foundation surround a centered cutaway. Larger rooms still follow the
  player. Outdoor coverage constraints are unchanged.
- Reorganized cottage, human house and attic into distinct, navigable furniture
  groupings. Added a reading chair, ceramics and attic craft details using
  existing modular sprites; still one bed and the original lighter/table/vase
  in the small cottage. Door/stair locations, recipes and rewards are unchanged.
- Wood grain, woven rugs, timber/plaster partitions, window-light shafts,
  roof-cut edges and open stone-stepped thresholds give the houses more
  material detail. The old block in front of the exit is gone.
- Camera clamp, render coverage and cache pinning share `scene-frame.js`.
  `interior-ground.js` owns the cached indoor material pass; scene furniture and
  walls stay declarative and editable in Studio.
- Corrected a discovered visitor interaction bug: a distant tap must approach
  before calling the visitor's handler. The handler now lives in the shared
  arrival dispatcher, respects a held inventory object, and the summoned
  guardian is included in click picking.

### Verification for this pass

- `npm test`: 105 collision-safe interaction routes; the existing geography,
  recipes, rolling, needs, save, art and Studio suites; new cutaway/visitor
  interaction tests. Camera tests cover seven scenes × seven viewports × six
  zoom requests, including bounded negative presentation chunks and unchanged
  physical room limits.
- `npm run test:browser`: previous seven outdoor viewports plus **five indoor
  scenes × four viewports × both zoom limits**, raster-edge checks, six locales,
  stairs both ways, lateral exits, ferry animation and isolated Studio editing.
  The workshop's JSON catalogue is allowed to settle before measuring zoom:
  product enrichment can independently change the room's dimensions.
- `npm run test:native`: all 25 activity/viewport combinations passed.
- `npm run test:boundary`: offline movement/saves, protected-action mocks,
  visitor conversation and ratings, plus the six static DDEV routes and the
  separate normal website passed. No live account/vote/model writes.
- Reviewed current screenshots in `.local/screenshots/room-polish/`, including
  house/cottage on phone, tablet and desktop, attic, barbecue and night cove.
  Regenerate with `node scripts/review-room-polish.cjs`.
- Additional end-to-end checks against the installed DDEV artifact at widths
  390/768/1440: touch the relocated lighter, walk to it, collect it, close its
  dialogue and leave the cottage. All three passed in isolated browser saves.
- Studio rebuilt with the same renderer, original UI Lab retained. Its single
  workspace rebased to revision 16 with no pending edits or conflicts.
- `git diff --check` passed in both repositories.

No new image downloads: the entire PNG library is still **244,971 bytes**.
A quiet local headless Chrome sample measured 230 ms to ready normally and
484 ms at 4× CPU throttling; maximum recorded long tasks were 121/268 ms.
This is not a physical-phone or network benchmark. Sprite requests/metadata
transferred 303,031 bytes in that run; static terrain remains browser-computed.

The pre-pass game source is recoverable from
`/tmp/magikitos-room-polish.j0eNyx/game-before.tgz`. The installed local host
retains its earlier immutable artifact as well. User saves were not reset.

## Studio placement handoff and plain paths — 2026-09-14

Applied the user's revision-49 Studio positions: **15 entities and 5 scenery
objects in overworld**, exactly as saved. An independent semantic comparison
against the archived source confirmed that no other overworld property changed;
the other 397 scenery placements were preserved, not regenerated. No sprite
crops, transforms, collision bodies, behaviors or rewards were changed.

Removed the alternate bright path-core tone and the recent bright pebble
clusters. The soil core now stays uniform through noise cells and terrain chunk
boundaries; the existing path shape/edge treatment is preserved.

Moving the buildings exposed duplicated interior return coordinates. Four
interior exits now reference their exterior portal by `arrivalAt`; the offline
compiler derives actual coordinates from that door. Saved entrances store
scene/portal IDs and resolve the current arrival instead of retaining a stale
position. New regression coverage checks relocated buildings, saved returns,
invalid references and uniform path-core pixels.

Reviewed snapshot/workspace and pre-change source are archived at
`/tmp/magikitos-studio-apply.wQwnIa/before.tgz`. Studio's normal three-way rebase
recognized the applied positions without clearing its workspace/history.
This handoff remains local only.
Verification passed: `npm test`, `npm run test:browser` (including actual entry,
save/reload and return through the three relocated open buildings), and
`npm run test:boundary`. Visually reviewed the revised path and picnic placements.
Studio is at revision 51 with no pending changes or conflicts; preview and DDEV
both serve `3945ce3706306630f4d4`. Nothing was committed, pushed or deployed.

## Directional doors and visual paths — 2026-09-14

- Exterior doors require upward movement at a narrow physical threshold; interior
  exits require downward movement. Idle, sideways and retreating movement is
  inert. Stairs retain their landing behavior. The shared movement callback
  covers walking, navigation and rolls at collision-safe substeps.
- Door taps approach from the front, finishing at an exact threshold waypoint.
  Segment validation ignores the moving player, including when that player
  already occupies the door endpoint; other actors and colliders still block it.
- Studio has separate **Elementos / Caminos** modes. Road vertices can be
  dragged, inserted, deleted or nudged; whole polylines can be created/deleted.
  Preview overlays avoid rerasterizing the terrain on each pointer move.
- Roads use the existing scene `paths` data and renderer material. Vegetation,
  water, buildings and physical barriers are not implicitly rearranged.
- The same single autosaved workspace, undo/redo, review diff and export cover
  roads. Empty arrays mean intentional removal of all paths. Validation bounds
  coordinates/topology and concurrent source edits are reviewed atomically.
- Removed the rotation UI. Supported scale and mirroring remain; existing
  authored orientations are preserved. No legacy data or source assets removed.
- Applying entity proposals now copies only changed placement fields, avoiding
  redundant inherited collision overrides when simply moving furniture.

Verification: `npm test` (including eight directional doors and path validation/
rebase tests), `npm run test:browser` (including lateral immunity and tapped
round trips on phone/desktop), and `npm run test:studio` pass. The latter uses
an isolated workspace for drag/insert/delete/create, invalid coordinates,
undo/redo, autosave/reload, diff export and pinch cancellation at desktop,
tablet and mobile sizes. Screenshots: `studio-paths-*.png` under
`.local/screenshots/`. The source hash is checked unchanged after editing.

The user's Studio remains one version, revision 52, with no unapplied edits
or conflicts after rebasing the derived door geometry. No road edits from the
tests were applied to source. Local preview and DDEV use artifact
`cf53b7cf5519a1273ca3`; the Studio bundle has been rebuilt in place.
Pre-change recovery archive: `/tmp/magikitos-doors-paths.B0QnXC/before.tgz`.
No deployment, Git push, production access or data import.
Final integration checks also pass: `npm run test:native`,
`npm run test:boundary`, and a fresh-browser smoke check against the running
main Studio and DDEV mount. The real Studio opens in path mode without making
it dirty; the installed DDEV page serves the verified artifact above.

## Integrated Studio experiments and miniature forest — 2026-09-14

Studio now has one shell with **Mapa / Laboratorio** tabs. The previous
Conversar / Acercarse comparison is a closed, labeled archive inside that shell,
not a separate navigation experience. Its original local files and private media
are preserved unchanged; archive resources are scoped, and leaving the archive
destroys its sandboxed frame to stop audio/animation.

The new active experiment, `/#experiments/forest-scale`, is an independent
walkable forest. It has no human cottages: six new found-material homes (boot,
stump, leaf shelter, mushroom, log workshop and flowerpot), six oversized forest
sprites and a separately labeled art-direction illustration. All three generated
originals and complete built-in image-generation prompts are retained under
`tools/adventure-studio/experiments/forest-scale/`.

Three relative proportions preserve the protagonist's pixel dimensions and the
camera zoom. Five viewpoints, normal walking, rolls, panning, wheel and native
pinch support direct comparisons. The shared game primitives provide physics,
navigation, animation, terrain and sprites; the experiment has no game boot,
account, website API, saves, inventory, events, purchases or missions.
Tree/fern imagery keeps higher source resolution than furniture, with independent
design-unit normalization so image detail cannot silently change collisions.

New images load only when the experiment opens, and the concept illustration
only in the art view. Switching to the map or gallery stops experimental rendering.
Map shortcuts are scoped to the map. The Studio's missing font references have
been removed; it uses the existing system-font fallback without failed requests.

Verified:
- `npm run test:experiments`: three presets, 75 connected viewpoint routes,
  five desktop/tablet/mobile/orientation sizes, keyboard/click movement, independent
  zoom/proportion changes, real two-pointer pinch, lazy gallery, archived A/B,
  and clean lifecycle. An unsaved map edit survives entering the experiment,
  autosaving, returning and reloading in an isolated test workspace.
- `npm run test:studio`: path editing, autosave/diff and responsive regression.
- Studio placement/crop/rebase and path validation suites, plus syntax/diff checks.
- Fresh browser smoke checks on the running main Studio, no browser exceptions.
  Screenshots: `studio-forest-*.png`, `studio-experiment-archive.png`.

The user's working map remains at revision 62 with its existing overworld path
proposal intact and no conflicts. Those edits have not been applied to the game.
No game scene, release pointer, website, database or production was changed.
Pre-change recovery archive:
`/tmp/magikitos-studio-experiments.xiR7M6/before.tgz`.

## Woodland collection and core review · 14 September 2026

The full current hand-off, art sources, contracts, limits and measured checks are in
[WOODLAND-KIT.md](WOODLAND-KIT.md). This supersedes earlier art-package counts and
active-experiment notes above. Fixed camera retained; the Studio archive is preserved.
71 new sprites and one illustrated backdrop are integrated, locally cut out with
explicit owner approval. Original masters remain unchanged.
Natural interiors, stable family variants, shared-hull ferry, subtle picnic gestures,
pushable saved objects and contact latches are implemented and tested.
DDEV and preview use `a19858c4cf8858ddeb08`; Studio revision 64 has no pending diffs.
No production deployment or production import.

## Picnic detail and animation · 14 September 2026

[PICNIC-POLISH.md](PICNIC-POLISH.md) records the latest local pass: clearer Taramundi
knife and foot-side lighter, five modular picnic props, authored human gestures,
fixed-foot rendering and browser raster checks. Preview/DDEV now use
`baf9e39511aacef0fc91`; Studio revision 66 is clean, with the Picnic gallery available.
Exact built-in image prompts and original masters are preserved. No production changes.

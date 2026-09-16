# Woodland kit and interaction polish · 14 September 2026

This document records the initial woodland pass. Its old byte counts and original
character size below are historical measurements, superseded by
[Ascua and the 2× contract](art-direction/DUENDES.md) and
[current release verification](ASCUA-RELEASE.md). The fixed camera, six locales,
separate website and one Studio workspace are retained. Experiments are archived.

Latest picnic refinement: [PICNIC-POLISH.md](PICNIC-POLISH.md), including the new
props, authored human animation and current local artifact. Counts below describe
the initial woodland pass unless explicitly updated.

## Art direction and resolution

71 new isolated sprites plus one interior context illustration were generated with the
built-in image tool. No CLI/API fallback was used. Originals, exact subject prompts,
native sizes and anchors are in `data/aventura/art/woodland-kit/`.
`prompts.json` records the shared style, each subject, reference roles, native target
and reviewed silhouette preparation. The Taramundi photo is a shape/material reference,
not copied lettering. Trees use this project's earlier trees as edit references.

A generous source master is useful for future crops and scale changes, but is NOT a
runtime texture. Every asset is reduced offline to its intended native pixel canvas,
trimmed, palette-quantised and packed. This avoids oversized downloads and browser alpha
scans. Pixel density is independent of world size: mushrooms are 40–46 pixels tall,
the main character remains 24×32, canopy trees retain 302×428 / 368×440 source-native
targets. Nearest-neighbour rendering scales the whole world together.

The kit provides log, weathered boot, leaf, mushroom and pot homes; daisy, bell and
meadow flowers; dry clover and ferns; edible/scarlet mushrooms; willow/bark crates and
planters; walnut/leaf/bark beds; twig tables, cupboards, chests, shelves, stoves,
acorn lamps, seed vases, organic windows, stairs, chairs, stools, easels, lecterns,
craft baskets and benches; two branch bridges and two leaf/bark boats.
Not every alternative is placed at once: the Studio gallery is the collection.

### Reproduce the reviewed cutouts

The owner explicitly authorised local background removal. It changes only the matte:
original PNG hashes are recorded alongside the prepared RGBA images. The first workshop
and daisy originals had painted checkerboards; separate built-in background-only edits
(`*-keyed.png`) were preserved before keying. No handwritten reconstruction of the subject.

```sh
php scripts/prepare-woodland-cutouts.php home-log-workshop tree-oak-grounded
node scripts/build-woodland-kit.cjs
npm run build
php scripts/audit-woodland-art.php
php scripts/review-woodland-anchors.php
```

The regular matte profile removes saturated magenta and a two-source-pixel adjacent
fringe. The separately reviewed foliage profile also removes desaturated magenta from
tiny canopy gaps; it is never applied to violet flowers. Full silhouette margins and
reasonable background coverage are mandatory. Source-edge clipping is an error.
Local cutouts never cause trees or houses to fade behind the player.

71 sprites produce 35 family packs. All current game art, including actors, earlier
props and the background, is 351 sprites / 58 packages, approximately 763 KB of PNG.
This is the whole library, not an initial download. Review captures measured about
583 KB of PNG for the outdoor scene, 213 KB for the leaf interior and 160 KB for
the cottage. JSON/JS/fonts and optional content media are separate. Masters are not
copied into the static release.

## One source of truth for families

- `element-families.json`: category, label, placement template and safety policy.
- `art/woodland-kit/prompts.json`: artwork variants, native size/anchor and optional crop.
- `build-woodland-kit.cjs`: explicit authoring command producing `elements.json` and
  independent `assets/woodland-*.json`. It retires replaced frame definitions, never
  original art. It does not call an image service.
- `elements.js`: shared family/variant resolution for game and Studio.

`artVariant: "auto"` selects a stable hash of scene ID + object ID; reloads do not
shuffle artwork. An explicit variant is stable too. A sprite without an explicit
variant uses its declared default. State-dependent `visuals` still take priority.
Visual variation never changes quest logic, the protagonist or a saved object ID.

The normal build does not regenerate authoring metadata. When applying a Studio crop
on a generated woodland frame, transfer its native crop into the matching manifest
asset as well as the reviewed frame definition before regenerating the catalogue.
Do not edit a master PNG to change collision. Crops belong to a sprite variant;
positions and bodies belong to scene objects. Aliases such as bedside-table/workbench
reuse a table design; explicit variant selection is preferable for new placements.

## Pushable props

`pushable: true` is a reusable entity capability. Planter and crate families opt in.
The physical rectangle is the same `solid` body used by navigation and Studio.

- Walking against a prop pushes it along the dominant movement axis.
- Clicking/tapping it chooses a reachable side, walks there and pushes one tile.
- Both inputs call the same substep collision resolver. Rolls do not push.
- No pulling, chain pushing, water crossing, pushing through another actor, or blocking
  a doorway/spawn. These are deliberate limits for the first puzzle capability.
- Only changed positions are saved as `objects[sceneId][objectId] = {x,y}` in native
  world pixels. Unknown, invalid, overlapping or unsafe saved placements are discarded.
- Occupancy counters and the collision index are updated incrementally; a push does
  not regenerate scenery, rebuild terrain or write to an API/database.

Scenery is decoration; author a movable puzzle object in `entities`, not `scenery`.
The clearing contains a willow crate and the art clearing a movable planter for testing.

## Contact and doors

After a collision-triggered conversation closes, its object stays latched until the
player actually moves away. Merely releasing/repressing a key does not reopen it.
Small `edgeSlide: true` props can guide the feet around a nearby corner, with the normal
collision test at every step. They never become nonsolid. Large objects and portals
do not receive this assistance. Explicit clicks still intentionally interact again.

Door thresholds remain narrow and directional. New art anchors were reviewed at native
resolution against the actual openings; door movement, return locations and saves use
the existing source-linked portal IDs. The leaf refuge moved away from the picnic so
its large roof cannot intercept the knife tap.

## Interiors, ferry and ambient people

`interior.outline` is a normalised polygon shared by the floor, walls, light clipping
and physical navigation. Inset bounds keep exits consistent when the shop grows.
Boot and stump rooms have their own silhouettes; other rooms use softened cutaways.
Furniture uses natural materials, windows are branch-framed and mats are woven leaves.
The exterior illustration is blurred once and baked into cached ground chunks.
Its arrival invalidates only that scene's provisional terrain, not every frame.
The small backdrop cache is bounded; it is not a fullscreen per-frame blur.

The ferry uses the same hull at the dock and in transit. `boat-art.js` layers the actual
captain/protagonist at authored seats and clips their lower bodies behind the gunwale.
Travel remains finite, atomic and unplayable inside the boat. The old occupied-ferry
pack was retired; its original illustrations remain available in source history.

`ambient-actors.js` now plays authored smoking/conversation/sipping poses from one
scene-lazy native pack. A shared source registration canvas and fixed lower-body
layer keep seated legs/feet stable. Reduced motion uses the idle pose without smoke.
See [PICNIC-POLISH.md](PICNIC-POLISH.md); the previous cut-and-shift head rig is removed.

## Verified locally

- `npm test`: recipes, saves, rewards/fares, doors, routes, shoreline geometry,
  rolling, asset loading, crops, Studio validation/rebase, additions/variants/removals,
  movable bodies and original-image invariants.
- `check-woodland-browser.cjs`: keyboard/touch pushes, reload and contact latch at
  desktop, tablet, mobile portrait and mobile landscape.
- `check-picnic-browser.cjs`: complete knife/lighter/mushroom/twig recipe, first and
  repeat meal, exact five-hour hunger boundary, departing humans, five viewports.
- `review-woodland-browser.cjs`: sixteen scene/device captures, no JS errors, no
  source-master downloads. Output is local and untracked: `.local/woodland-review/`.
- Game regression browser: seven outdoor viewports, twenty interior combinations,
  six locales, wheel/pinch, doors/stairs both ways, ferry and editor crop safety.
- Gallery browser: additions, explicit variants, deletion/undo/redo, autosave/reload,
  review diff, source isolation and five viewports.

Future puzzle triggers, weight plates, pushing chains and furniture rotations are
not smuggled into this pass. Add them as concrete capabilities when a scene needs them.

## Initial woodland hand-off (before the picnic refinement)

Preview and DDEV both serve artifact `a19858c4cf8858ddeb08`.
Studio was restarted with the new family gallery; revision 64 contains no pending
scene/sprite edits or conflicts after preserving/rebasing the previous single workspace.
The user's game save was not reset. Reload existing Studio tabs after the restart.

The same push/save/contact suite also passed on the actual DDEV mount.
Native content checks passed 25 activity/device combinations against local data;
boundary checks passed the six mounted locales, offline startup, shared identity,
mocked protected writes and the absence of website HTML/runtime in the game.
All production systems and balances were untouched.

Archive-only QA note: the camera/scale experiments completed their assertions, but
the two older test harness processes stalled during Chrome shutdown and were stopped.
Their cleanup order was corrected; that change is not counted as a verified rerun.
The game, native-content, boundary, gallery, paths and woodland suites exited normally.

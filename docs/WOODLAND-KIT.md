# Arte modular del bosque

Contrato vigente del kit, compartido por juego y Studio. Decisión visual:
[2× integrado y animación selectiva](art-direction/DEFINITION-MOTION.md).
Personajes: [Ascua](art-direction/DUENDES.md), [cien NPC](ISLET-AND-RESIDENTS.md).

## Art direction and resolution

The original modular artwork was generated with the built-in image tool. Originals, exact subject prompts,
native sizes and anchors are in `data/aventura/art/woodland-kit/`.
`prompts.json` records the shared style, each subject, reference roles, native target
and reviewed silhouette preparation. The Taramundi photo is a shape/material reference,
not copied lettering. Trees use this project's earlier trees as edit references.

A generous source master is useful for future crops and scale changes, but is NOT a
runtime texture. Every asset is reduced offline to its intended native pixel canvas,
trimmed, palette-quantised and packed. This avoids oversized downloads and browser alpha
scans. Texture definition is independent of world size: `pixelRatio: 2` preserves
logical geometry; instance scale affects artwork and collision together. Cropping
preserves anchors. Do not enlarge low-resolution prototypes to create giant trees.

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

The manifest and tests report current package sizes; do not copy old library totals
into design guides. Only prepared scene/action packs load, never source masters.

## One source of truth for families

- `element-families.json`: category, label, placement template and safety policy.
- `art/woodland-kit/prompts.json`: artwork variants, native size/anchor and optional crop.
  An optional `source` selects an explicitly reviewed replacement cutout while
  retaining stable family/variant IDs used by saved constructions.
  Optional `pack` splits a large variant into its own lazy package without
  splitting the gallery family. Castaño and sauce use this: four canopy variants
  share one gallery selector, but the two new species are fetched independently.
- `build-woodland-kit.cjs`: explicit authoring command producing `elements.json` and
  independent `assets/woodland-*.json`. It retires replaced frame definitions, never
  original art. It does not call an image service.
- `elements.js`: shared family/variant resolution for game and Studio.

`artVariant: "auto"` selects a stable hash of scene ID + object ID; reloads do not
shuffle artwork. An explicit variant is stable too. A sprite without an explicit
variant uses its declared default. State-dependent `visuals` still take priority.
Visual variation never changes quest logic, the protagonist or a saved object ID.

The chestnut and willow masters were generated with the built-in image tool,
using the existing oak as a style reference. Their original alpha is preserved;
source hashes and silhouette bounds are in `woodland-kit/cutouts/*.json`, and full
prompts in `woodland-kit/prompts.json`. They use the same 2× integrated bake and
subtle canopy wind as the existing trees. Both packs together add about 476 KB
to the complete library, not to every scene; the total PNG budget stays 10.5 MB.

Continuous authored fences are the exception to sprite assembly: `fences.js`
renders upright textured posts and rails from a tile-relative polyline. Cached
geometry drives artwork bounds, span depth and narrow collision bodies in both
game and Studio. A connected line shares its corner posts at every angle. This
does not introduce a new player construction recipe or bypass API validation.

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
- Both inputs call the same substep collision resolver.
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

## Interiors and ambient people

The tavern uses three inward-facing gatherings, with fifteen or sixteen residents.
Authored `neighbors[].lookAt` is a tile-coordinate pair; `radius: 0` keeps a
conversation/fishing spot still. Gatherings derive their own facing points.
Table `attachments` are scene-lazy sprites with local **native-pixel** offsets
and optional scale. They follow the parent's position and scale, including in
Studio, rather than duplicating world coordinates for every plate.

`art/world-polish/catalog.json` owns the reviewed tavern settings, bamboo,
walnut boat and grounded herb planter. Built-in image generation supplied the
masters; `php scripts/prepare-world-polish.php` prepares alpha and frame metadata,
then `npm run art:catalog` and `npm run build` produce native packs. The discarded
underside planter is not used: its stable `violetas` variant now selects the low
grounded bowl, preserving existing player objects. Original art remains available
for recovery; source files are never delivered to browsers.

`interior.outline` is a normalised polygon shared by the floor, walls, light clipping
and physical navigation. Inset bounds keep exits consistent when the shop grows.
Boot and stump rooms have their own silhouettes; other rooms use softened cutaways.
Furniture uses natural materials, windows are branch-framed and mats are woven leaves.
The exterior illustration is blurred once and baked into cached ground chunks.
Its arrival invalidates only that scene's provisional terrain, not every frame.
The small backdrop cache is bounded; it is not a fullscreen per-frame blur.

Sailing is player-controlled in the bottle boat. Its current rules and controls
are documented in [SHARED-FOREST.md](SHARED-FOREST.md).

`ambient-actors.js` now plays authored smoking/conversation/sipping poses from one
scene-lazy native pack. A shared source registration canvas and fixed lower-body
layer keep seated legs/feet stable. Reduced motion uses the idle pose without smoke.
See [PICNIC-POLISH.md](PICNIC-POLISH.md); the previous cut-and-shift head rig is removed.


Verification: `npm test`, `npm run test:woodland`, `npm run test:gallery` and
`npm run test:picnic-animation`. Use `npm run review:woodland` for scene captures.
Current delivery: [RELEASE.md](RELEASE.md).

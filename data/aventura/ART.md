# Original adventure artwork

## Current: woodland family collection (14 September 2026)

71 new sprites plus an interior context illustration, generated with the built-in
image tool, then locally cut out with the owner's explicit permission.
Masters and prompts: [woodland-kit](art/woodland-kit/prompts.json).
Full source/pack/crop workflow, native-resolution policy and review:
[WOODLAND-KIT.md](../../docs/WOODLAND-KIT.md).

The collection replaces house, tree-base, wild mushroom, furniture, bridge, boat
and knife artwork while retaining the protagonist. 35 family packs carry the
new variants. The full current runtime library is 351 sprites in 58 packs, about
763 KB of PNG; scene loading downloads a subset. The old occupied-ferry pack and
superseded frame definitions were retired; original art was preserved.

## Historical: modular harbor, picnic, island, rolling, needs and doors (13 September 2026)

Built-in imagegen generated four original sheets, retained in `art/generated/`:
`harbor.png`, `picnic-neighbor.png`, `shore-garden.png`, `skewer-items.png`.
These add the ferry, jetty, cold/lit barbecue, hungry/happy seated duende, island
trees, coastal planting, sandstone, shells, basket, twig, skewer and setin icon.
The existing protagonist was not redesigned. Style references were this project's
woodland and neighbor sheets, not copyrighted game art.

Additional built-in sheets: `art/generated/roll.png` (five directions × four
forward-tuck poses, mirrored for the three left headings) and
`art/generated/building-doors.png` (closed inaccessible cottage/fisher, open
tavern/workshop/human house). Identity retained from the original protagonist.
The original open cottage and fountain remain unchanged.
Runtime roll poses live in `assets/actor-0-roll.json`; building states stay in
each building's own package. No flat canvas rotation substitutes for directional art.

New independent modules: `actor-0-needs` (four pee and four poop poses),
`needs-props` (broad-leaf plant, inventory leaf, bedside table, vase and temporary
traces), `ferry-aboard` (four rowing poses with both duendes seated).
Sources are `art/generated/{needs-poses,needs-props,ferry-aboard}.png`, prepared
through the same authorized PHP/GD offline cutout. All originals are retained.
Explicit crop windows on the props prevent adjacent plant pixels bleeding into
the leaf icon; boat poses have authored waterline anchors to avoid oar-induced jitter.
Pee uses the authored waist/lean/relief poses plus a tiny native-pixel stream;
poop has crouch, effort, leaf wipe and recovery poses. No rotation of a standing
sprite substitutes for either action.

Exact final prompts and reference roles: [ART-PROMPTS.md](ART-PROMPTS.md).
Mode: built-in tool, not CLI/API fallback.

Source sheets are separate from runtime assets. `assets/*.json` defines independent
modules; each actor and each building has its own definition. The build expands
animation templates, crops, fits, quantizes and packs each module separately.

Runtime: **301 sprites, 26 independent packages, 244,971 PNG bytes in total**, plus
metadata. The whole library is not fetched for every scene. A manifest points to
content-hashed PNG/JSON pairs in `public/assets/aventura/packs/`.
There is no monolithic runtime atlas and no image scanning at startup.

```sh
php scripts/prepare-adventure-art.php harbor picnic-neighbor shore-garden skewer-items
php scripts/bake-adventure-atlas.php
```

The generated backgrounds were prepared using the previously authorized local
PHP/GD cutout pipeline. Originals remain untouched. Binary alpha removes backgrounds;
trees and houses do not fade when the player walks behind them.

## Native crops and Studio

The following paragraph describes the earlier interior pass; its sprites are now
replaced by the woodland family collection. The crop contract below is current.

The `interior-details` module adds eight original objects: cupboard, stove,
upstairs, arched window, dresser, armchair, downstairs and kitchen rack.
The full brief and the separate environment study live in
[art direction](../../docs/art-direction/PROMPTS.md). The study is concept art;
the furniture is integrated into the house, cottage and new attic.

The offline packer removes isolated source-cell fragments **before fitting**
so a speck beside a bed or fountain cannot shrink and offset its actual artwork.
A frame definition may then specify `crop: [x, y, width, height]` in its original
native `size` canvas. The packer tightly trims the retained visible pixels and
adjusts the anchor, without changing their world position.

Frame metadata includes `nativeSize`, `trim` and `crop` for reconstruction.
The foot anchor may lie outside a cropped frame; this is intentional.
Animated people retain fixed native canvases for consistent poses.
Collision bodies are independent scene data, never inferred from opacity.

The Studio builds separate uncropped native previews for editing. Its image
inspection runs only in the editor; the game downloads already-baked art.
Original source images are never overwritten by cropping.

## Historical art passes

The following notes describe previous outputs, not the current runtime packaging.

## Previous: neighbor variety and puzzle objects (12 September 2026)

The built-in image tool added `moss-neighbor.png`, `ivory-neighbor.png` and
`puzzle-props.png` in `art/generated/`. The first has deep brown skin, silver hair
and a curled green pointed hat; the second has pale freckled skin, dark hair and a
wide sideways cream pointed hat. Both have directional articulated poses.
The protagonist remains unchanged. Props: book on lectern, brass lighter, cooked
mushroom and canvas sack. Exact prompts are appended to [ART-PROMPTS.md](ART-PROMPTS.md).

Preparation uses the same authorized PHP/GD background cutout, preserving originals.
Explicit crop windows (now in assets/*.json) avoid adjacent cells. The fountain's native
size increased from 44×38 to 66×58.
The packed runtime atlas contains **227 sprites, 139,126 bytes**, plus JSON:
six characters × eight directions × four poses, and 35 scenery/item sprites.
No runtime image editing, scans or original-sheet downloads.

Regenerate selected cutouts locally:

```sh
php scripts/prepare-adventure-art.php moss-neighbor ivory-neighbor puzzle-props
php scripts/bake-adventure-atlas.php
```

## Previous pass: pointed hats and articulated walking (12 September 2026)

Built-in image generation produced four original character sheets (five views × four
poses) and twelve woodland/workshop decorations. Selected sources are retained at
`data/aventura/art/generated/{player,elder,neighbor,guardian,woodland}.png`.
The exact prompt set is in [ART-PROMPTS.md](ART-PROMPTS.md).

The generator returned RGB sheets with painted neutral backgrounds. With the owner's
permission, `scripts/prepare-adventure-art.php` removes only the edge-connected neutral
background using PHP/GD, retaining enclosed cream clothing and white hair.
Original sheets remain unchanged; results are stored as `art/*-cutout.png`.

The new artwork is integrated: four pointed-hat variants × eight orientations ×
four poses (128 character frames), twelve new decorations and 24 retained scenery
sprites. Left-facing views mirror the corresponding right-facing artwork; diagonals
have their own poses. Frames share scale and foot anchors. Walking uses traveled
distance, not a floating body offset.

`scripts/bake-adventure-atlas.php` crops, nearest-neighbor resizes, cleans isolated
sheet marks on two furniture sprites and packs a 256-entry indexed PNG with binary
alpha. This previous pass packed **164 sprites, approximately 110 KB**, plus JSON metadata.
No original sheets or runtime pixel scans. Alpha removes sprite backgrounds only:
trees and buildings no longer fade when the player walks behind them.

Retained source artwork:

- `art/forest.png`: six forest sprites, build input only.
- `art/buildings.png` and `art/props.png`: buildings, furniture and interaction props.
- `art/duende-prototype.png` and `art/duendes.png`: historical
  character prototypes, not build inputs or runtime downloads.

Generated using the imagegen skill and built-in image tool; no external game art
was supplied as reference. The exact current prompts are in
[ART-PROMPTS.md](ART-PROMPTS.md). The following prompts document historical passes,
not the current pointed-hat design.

## Second art pass (11 September 2026)

Generated original raster assets using the imagegen skill's built-in image tool; no external game artwork was used as an input. Art direction: warm 16-bit top-down village, teal foliage, ochre roofs, wood and cream highlights, transparent backgrounds, fixed isolated sprite grids. The new character brief emphasizes large sideways pointed ears, a round nose, chestnut hair, teal clothing and an ochre scarf, without a recognizable existing game costume. Neighbors vary in hair, complexion and clothing. These sheets contain directional poses, not an articulated walk cycle.

Generation identifiers: buildings `exec-a0e0a53c-c118-4850-a31f-fa14ea07a9bc`, props `exec-232eb51f-599b-4edf-9a01-3cbd50ebf573`, duendes `exec-03c40b5c-ec09-42ce-8b84-8bacacd3e5ca`. Source PNGs are retained in the repository for reproducible baking; the private tool-cache location is not required.

## Forest prompt

Use case: stylized-concept. Asset type: production sprite atlas for an original cozy top-down browser pixel-art adventure, 1536x1024 PNG, genuinely transparent background. EXACT GRID: 3 columns by 2 rows of equal 512x512 cells, no dividers, no text. One isolated fully visible object CENTERED in each cell with at least 48px transparent margin on every edge. TOP LEFT: broad round lush oak with layered clustered foliage and short visible trunk, TOP MIDDLE: tall leafy hornbeam with rounded tapering crown and visible trunk, TOP RIGHT: low rounded leafy shrub with a few tiny cream flowers. BOTTOM LEFT: charming hollow old tree stump with moss, BOTTOM MIDDLE: cluster of three rounded mossy stones, BOTTOM RIGHT: cluster of three apricot-brown capped mushrooms with cream stems. True carefully crafted chunky 16-bit pixel art as if authored on 64x64 pixels per cell and nearest-neighbor enlarged 8x, crisp pixel squares and stair-step contours, no antialias, no painterly fine detail. Warm forest palette limited to deep teal-green shadows, moss green, golden lime sunlit leaves, warm umber trunks, cream highlights and terracotta. View is overhead three-quarter top-down 2D adventure perspective, looking down onto the foliage but seeing trunk front. Light from upper left, harmonized palette and pixel scale across every asset. No ground patches, no bases, no cast shadows, NO background illustration, no characters, no interface, no labels, no logos. Objects must be disconnected by real transparent space so each exact cell can be used independently as a game sprite. Lovingly detailed silhouette, inviting relaxing magical forest atmosphere, original artwork.

## Character prompt

Use case: stylized-concept. Asset type: original playable character sprite sheet, transparent PNG 1024x1024. A beautifully designed tiny friendly woodland duende for a cozy top-down 16-bit pixel adventure. Exact 4-column by 4-row grid, sixteen isolated full-body sprites, each centered in its 256x256 cell with feet on the same baseline and consistent head and body sizes. COLUMN 1 faces camera (south), COLUMN 2 faces right (east), COLUMN 3 faces away (north), COLUMN 4 faces left (west). ROW 1 idle standing, ROW 2 walking left leg forward with opposite arm swing, ROW 3 neutral walking passing pose, ROW 4 walking right leg forward with opposite arm swing. In all frames the same character: pointed elf ears extending sideways, soft round cheeky smiling face, warm peach skin, a tousled curved cinnamon auburn hair tuft with golden tips, NO hat, NO hood, NO weapons, teal short coat with little brass buttons, mustard neckerchief, brown satchel on back, plum trousers, little dark brown walking boots. Head roughly half the character height, expressive dark brown eyes, rounded silhouette, slim little body. Art direction: meticulously hand-pixelled GBA-era RPG sprite quality, 24px wide x32px high logical pixel character, crisp stepped pixels enlarged to the sheet, rich but tightly controlled 24-color palette, warm outline rather than solid black, charming clean shading, lit from upper left. View is slightly overhead 3/4 top-down adventure game perspective, not flat frontal portrait. TRUE TRANSPARENT BACKGROUND, no floor, no ground, no shadow, no scenery, no grid lines, no text. No resemblance to any existing named character, completely original Magikitos design. Must be usable directly as an animation atlas.
# Current policy · 14 September 2026

The active contract is [2× integrated definition and selective motion](../../docs/art-direction/DEFINITION-MOTION.md)
and [Ascua / eleven neighbors / compact reusable poses](../../docs/art-direction/DUENDES.md).
These supersede the earlier size, character counts and prototype prompts retained
below as provenance. All characters now wear pointed hats. The current library is
619 frames in 73 lazy packages; masters are not runtime assets.

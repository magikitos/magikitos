# Cats — original sprite masters

Generator: built-in imagegen. Originals are preserved; local alpha preparation is authorized. Art uses the game's approved 2x offline integrated reduction. Runtime animation uses registered sprite frames, not independent GIF elements.

## Walking revision · 16 September 2026

`walk-catalog.json` preserves the exact prompts and identity/coat references.
Five new `sources/*-walk.png` masters each contain eight directional views
and four walking phases (32 frames). The coat edits preserve the ginger gait.
`prepare-adventure-cats.php` removes only the authorized background matte and
registers every frame on the same 64×64 logical canvas, anchor (32,58), before
the standard 2× integrated bake. No per-frame fit/crop or runtime alpha scan.
The old masters remain as source history; only their idle and pickup poses are
shipped alongside the new walking poses. The unused old walking frames are not
included in the new packs. Total cat frames therefore remain 240, not 400.

A second visual review replaced the four rear-facing poses with dedicated
`sources/*-rear.png` masters (four columns, one row), making left/right hind paws
alternate clearly. `rear-catalog.json` records that iteration. Rear registration
uses one shared scale/bottom baseline for the whole strip, never per-frame fits
or mirrored fur markings. These replace four frames per pack; they add no runtime
frame count. All approved masters remain preserved.

`review-cats.cjs` produces native-renderer gait and carried-hero contact sheets
under `.local/cat-review/`. Eight directional mouths retain the existing carried
hero attachment. Actual capture/drop input and long travel are checked in three
browser viewports by `check-cats-browser.cjs`.

## Ginger cat / first master

Use case: stylized-concept. Asset type: production sprite sheet for an original cozy top-down woodland adventure. Create exactly 8 columns and 6 rows of the SAME handsome ginger tabby cat with cream paws, amber eyes, expressive ears and curved tail. Fixed elevated three-quarter orthographic camera, matching a detailed warm hand-painted pixel-art adventure. Each cell is a square; cat centered, identical size and ground registration in every cell, fully contained with generous clear margin. Columns facing down, down-right, right, up-right, up, up-left, left, down-left. Row 1 standing alert neutral; row 2 walking first footfall; row 3 walking passing pose; row 4 walking opposite footfall; row 5 lowering head to gently pick something up; row 6 walking with head slightly raised and mouth gently closed around an INVISIBLE soft object (draw no carried object). Cute natural cat anatomy, neither kitten nor giant tiger. Consistent anatomy and markings. Crisp readable paws and face, no blur, no grid lines, no text, no shadows or ground plane, no scenery, genuinely transparent background. Cat only: no duende, no human. Exact regular 8x6 layout; no pose crossing a cell boundary.

## Ascua carried / protagonist reference

Reference: `data/aventura/art/cast/sources/ascua-walk.png` (identity only).
Use case: identity-preserve. Asset type: registered game sprite sheet, exactly 8 columns and 2 rows. Preserve the reference protagonist Ascua: pointed orange stitched cap, brown tousled hair, pointed ears, teal-blue short jacket, ochre scarf, brown trousers and boots. Each cell shows the same FULLY CLOTHED adult fantasy duende suspended by the SEAT of his trousers, bottom raised, torso bending downward, both arms and both legs dangling down, frightened wide eyes and surprised mouth. A cat will hold the fabric at his bottom, but DO NOT DRAW THE CAT or any support: only the hanging duende. It is gentle comic slapstick, no injury, no bare bottom. Columns facing down, down-right, right, up-right, up, up-left, left, down-left, fixed elevated three-quarter orthographic view. Row 1 dangling still, row 2 slightly different dangling limbs for gentle sway. Same proportions, scale and registration, centered in each cell, no clipped hats/hands/feet, empty generous margins. Detailed warm crisp painted pixel-art matching the reference, no blur, no lettering, no grid, no scenery or shadows; genuinely transparent background. This is not standing, crawling or crouching: the pants seat is the highest point, head and extremities hang below it.

# Woodland polish · original art direction

Generated with the built-in image tool. Concept study, not a screenshot of the implemented game. External references were inspected for general composition/material principles only; none were included in the generated scene.

## Woodland materials

Use case: stylized-concept. Asset type: original art-direction reference for Magikitos, a cozy top-down 2D pixel-art browser adventure. Create one carefully composed environment study, landscape. Actual orthogonal top-down three-quarter RPG camera, NOT isometric. No text, UI, logos, signatures or watermarks. An original verdant woodland village at the edge of a deep turquoise lake: warm sand-colored winding earthen paths merge naturally into a little grassy fountain clearing; a small slate-roofed human cottage has timber beams and warm plaster, simple asymmetry and crafted detail; a mossy low rock terrace with a short walkable stone stair introduces height without clutter; lake banks have layered soil, pebbly wet sand, clear shallows and calm dark teal depths with sparse broad ripples. Trees use coherent clustered foliage and varied species. A tiny pointed-hat duende in ochre and teal gives scale, no resemblance to an existing named character. Sunset warmth in grass, cool water, earthy moss greens, slate lavender shadow, cream lit edges. Strict pixel clusters and legible silhouettes, as if meticulously drawn at 480x320 logical resolution then nearest-neighbor enlarged, no painterly noise, no smooth gradients. Strong composition, open walking lanes, visual quiet between detail clusters. A small inset cutaway study of the cottage interior shows timber-framed plaster walls, a stair to a cozy attic, one patchwork bed, a tidy table and ceramics; same perspective, no labels. Entirely original layout and assets, borrowing only general principles of readability and material separation from classic top-down games. This is concept reference, not a screenshot of completed code.

## Interior objects

Reference inputs are this project's own `props.png` and `woodland-cutout.png`, for palette and material consistency.

Use case: stylized-concept. Asset type: production interior sprite sheet for an original cozy top-down 2D pixel adventure. The supplied project images are STYLE REFERENCES ONLY for warm oak wood, moss/teal fabric, restrained cream highlights and carefully clustered pixels. Generate NEW original architectural furniture, do not redraw anything from the input. Orthogonal three-quarter overhead RPG perspective, front faces and top surfaces visible, vertical front edges horizontal, NOT isometric, not perspective converging into distance.
EXACT sheet: 4 columns by 2 rows on a genuinely TRANSPARENT background, one isolated object per equal cell, generous clear gutters, no floor tiles, no ground patch, no shadows outside each object. All 8 fully visible with nothing overlapping.
TOP ROW left to right:

1. A tall handcrafted oak cupboard with slightly crooked rounded crown, small brass knobs, two closed doors and a little folded cloth on one ledge.
2. A small cast-iron forest-green stove with a short chimney, one rounded kettle and warm tiny embers.
3. A honey-oak stair flight seen straight from its bottom looking upward, six broad wooden treads receding upwards in top-down perspective, slender side railings; width about half its height. No doorway, room or floor attached.
4. A recessed arched window with cream curtains tied back, thick dark oak frame, muted blue glass and a little flower pot on its sill; a wall-mounted isolated prop.
   BOTTOM ROW left to right:
5. A squat oak dresser with uneven stacked ceramics, books and folded towels, small cute green ceramic jug.
6. A low patchwork teal-and-ochre upholstered armchair, wood legs, facing down, seat visible from above.
7. A wooden open stairwell going down, dark rectangular opening bounded by oak rails and descending visible wooden treads, same design vocabulary as top row stairs.
8. A modest wall-mounted row of hooks with copper saucepan, spoon, dried herb bunch and blue dishcloth, integrated into one horizontal oak rack.
   True pixel art, visually authored at roughly 48x64 native pixels per object, enlarged with nearest neighbor. Crisp stepped outlines in dark warm brown, sculpted large shadow clusters, no fine dithering/no blurry lighting. All objects have the same light from top left. Each cell background must be alpha zero, not a painted checkerboard or gray square. No characters, symbols, writing, grid lines, logos, watermarks, or random extra objects. Warm, lived-in, hand-crafted, readable silhouettes. Intended to be cropped and scaled to native sprites by the game's offline pipeline.

## Alpha preparation and integration

The generation and the background-only edit both returned painted checkerboards,
not real transparency (the corner alpha was measured). The existing offline
`prepare-adventure-art.php interior-details` pipeline removed only light neutral
background pixels connected to the sheet boundary. Original generated images
are retained unchanged. The final cutout is
`data/aventura/art/interior-details-cutout.png`.

The sheet becomes eight separate frames in the independent `interior-details`
pack. The browser downloads the baked native pack, never the large source sheet.
Validate the native-size silhouette and the alpha channel before accepting new
AI-generated art; a checkerboard shown in a preview is not proof of transparency.

## Reusable art brief for future scenes

Keep the protagonist's ochre hat and teal clothing exclusive. Use fewer, larger
pixel clusters; shadows are warm brown on timber and cool blue-green on water.
Keep walkable space visually quiet. Add detail in coherent groups: ceramics on
a dresser, herbs beside the stove, reeds at shallow banks. Show a front-facing
stair landing clearly; it must connect to a real traversable threshold.

For each new modular asset prompt, specify: role, orthogonal camera, native
pixel size, foot anchor, light direction, palette, silhouette, independent
transparent frame and explicit exclusions. Do not ask a generator to draw an
entire scene when the deliverable is a reusable object. Never include third-party
game screenshots in shipped assets.

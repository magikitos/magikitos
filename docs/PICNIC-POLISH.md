# Picnic refinement · 14 September 2026

Local only. No push, deployment, VPS access, production data import or account balance change.
The installed preview/DDEV artifact is `baf9e39511aacef0fc91`.
The existing player save is retained, including the permanent picnic departure.

## Visible changes

- Broader, clearer Taramundi knife: ochre handle, black burned stripes, two red rings,
  bright open blade with no lettering. Native target 48×30, previously 36×30.
- Readable coral-orange lighter, native 25×20, now at tile **18.8, 47.2** on the
  grass beside the smoking man's shoe. The original pickup ID and reusable item stay.
- Guacamole, potato crisps, lemonade, orange soda and a portable speaker on the blanket.
  They use individual native assets and the existing `picnicFed` visibility condition.
  Decorative colliders are small; both tools remain approachable and collectible.
- Authored smoking, conversation and sipping poses with quiet pauses. No GIF or video
  is downloaded. The cigarette produces just a few faint, short-lived smoke pixels.
- Studio gallery category **Picnic**: snacks, drinks and speaker, with explicit variants.
  Tools remain non-placeable quest items; moving the existing scene item still works.

The recipe, five-hour hunger timer, reusable tools, first reward, travel fares,
six locales, fixed camera and controls are unchanged. New dressing is only scenery;
it does not invent consumable items, extra rewards or website events.

## Source art and prompts

Generated with the **built-in image_gen tool**, not CLI/API fallback. The original
project picnic sheet was the identity/style reference for the two human pose sheets;
the earlier knife illustration was the design reference for its readability edit.

**Exact prompts, input roles and every saved output path:**
[`data/aventura/art/picnic-polish/prompts.json`](../data/aventura/art/picnic-polish/prompts.json).

Seven isolated object masters are retained in `data/aventura/art/woodland-kit/`:
`knife-taramundi-readable.png`, `picnic-lighter-coral.png`,
`picnic-guacamole.png`, `picnic-potato-chips.png`, `picnic-lemonade.png`,
`picnic-orange-soda.png`, `picnic-speaker.png`.

Two four-pose masters are retained in `data/aventura/art/picnic-polish/`:
`picnic-smoker-poses.png` and `picnic-friend-poses.png`.
The earlier knife and picnic originals are also retained.

The owner-authorised local pipeline only prepares alpha/cutouts and native packing,
not a replacement design. Existing alpha is preserved; generated magenta mattes are
removed with the shared cutout helper. Source hashes accompany the prepared PNGs.
No source-resolution image is included in the static release.

## Animation contract

- `assets/picnic-humans.json` owns all eight frames in one scene-lazy package.
- `preserveCanvas: true` keeps a fixed source registration rectangle before native
  baking. Independent silhouette fitting must not resize or recenter each pose.
- Each actor uses one native size and anchor across all poses; atlas trimming adjusts
  the anchor without changing the actor's world position.
- `ambient-actors.js` declares durations, independent phases and the smoke interval.
  It chooses a frame from render time, without timers, canvas allocation or pixel readback.
- The idle lower body is clipped below an authored waist seam; the active upper pose
  is clipped above it using the shared `drawArtwork` native transform. This prevents
  tiny generated drawing differences from making seated feet slide.
- Reduced motion uses the still idle pose and no smoke. Collision never depends on
  animation. The previous manually shifted head/painted-mouth rig has been removed.
- The browser raster test checks **pixel-identical lower bodies** across every pose.

Current full library: **362 sprites / 62 packages / 788,081 PNG bytes**.
This pass adds **24,952 PNG bytes** versus the prior 763,129-byte library. These are
the complete library totals, not initial download sizes; packs stay scene-lazy.
Original generation masters are authoring inputs only.

## Reproduce and inspect

```sh
php scripts/prepare-picnic-actors.php
php scripts/prepare-woodland-cutouts.php knife-taramundi-readable picnic-lighter-coral picnic-guacamole picnic-potato-chips picnic-lemonade picnic-orange-soda picnic-speaker
npm run art:catalog
npm run build
php scripts/review-picnic-art.php
npm run test:picnic-animation
npm run test:picnic
npm run install:local
```

QA output (untracked): `.local/picnic-review/native-art.png`,
`rendered-poses.png`, `animation-report.json`, `studio-gallery.png`.
Scene/device captures: `.local/woodland-review/picnic.png` and `picnic-mobile.png`.

Verified locally:
- `npm test`: all core suites pass, including 118 safe routes, save/recipe/ferry,
  pointer/keyboard, shoreline, crop registration, Studio and original source hashes.
- `test:picnic`: the complete pointer-driven recipe, departure, save/reload and
  repeated hunger pass at five desktop/tablet/mobile/orientation sizes, both in the
  standalone preview and on the installed DDEV mount.
- `test:picnic-animation`: real Chrome rendering, distinct poses, fixed feet and one
  animation pack; also passes against the installed DDEV artifact.
- `test:browser`: seven viewports, twenty interior combinations, six locales,
  doors/stairs, ferry and isolated Studio edits all pass.
- `test:gallery`: placement, variants, undo/redo, autosave/reload, source isolation
  and five viewports pass.
- Sixteen visual captures pass with no JS errors or source-master downloads.
- Main Studio restarted and inspected: Picnic gallery visible, no JS errors, revision
  **66**, no pending scene/sprite edits or conflicts. Existing workspace preserved.

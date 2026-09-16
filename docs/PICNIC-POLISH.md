# Arte y animación del picnic

Guía de autoría vigente; ubicaciones y recogibles están en las escenas.
Manta y comida son piezas independientes: tortilla, nachos triangulares,
guacamole, bebidas y altavoz. Navaja y mechero son herramientas; la botella del
suelo se recoge aparte. Los humanos y la manta desaparecen al cocinar la primera
brocheta; los utensilios no recogidos siguen disponibles.

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

Verificar con `npm test`, `test:picnic-animation`, `test:picnic` y `test:gallery`.
Resultados de publicación: [RELEASE.md](RELEASE.md).

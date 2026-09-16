# Continuous controls, cats and docks — release record

Historical record: superseded by the [adaptive touch release](RELEASE-TOUCH-2026-09-16.md).
In particular, always-visible controls below describe this older artifact, not
the current input-adaptive presentation.

Published and verified on 16 September 2026 at <https://magikitos.com/aventura>
and its five translated routes, under the owner's continuing deployment request.

- Artifact: `10bbdd2662e705765cc8`, 391 allowlisted static files.
- Game runtime: `9162beafa9e8ea907ac654deca6d7929fb7d5532`, including cat/dock
  commit `34c1ae5acf24ee67f297cd7ea1e4f88768761a88`.
- Website pointer: `9bd2bf6e84d6b5963c65ad436c43f51aadbdfb09`.
- Manifest SHA-256: `eb9b5bac81def84c59d3c443995e5054540a106cd9da7e21275af09042157701`.
- API/schema/identity/economy unchanged. Subsequent documentation/test commits
  do not alter these runtime bytes.

## Player-facing changes

Always-visible circular eight-way joystick on the right and held turbo on the
left, on foot and afloat. Sliding a held pointer changes direction continuously;
two independent fingers can steer and accelerate. Recenter lives in the middle
of the joystick. Held controls survive river seams and automatic dock crossings;
release/cancel/focus loss clears them safely. Keyboard remains available.

Outside dialogue clicks close it and keep their original movement/interaction
meaning. Compact landscape dialogue leaves both controls accessible. Foot speed
is 72/190 world px/s, rowing 82/205 before currents. The rapid core is 240 px/s,
so the intended current setback remains meaningful even with turbo.

Outdoor zoom-out ends at the geometric map-coverage limit, not a fixed percentage;
initial/max zoom are unchanged. The DOM does not scale. Visible terrain stays
pinned in the bounded chunk cache. Indoors keep their painted cutaway framing.

All A* consumers share visibility simplification: unobstructed destinations are
one straight segment; obstacle routes lose redundant tile-center bends. Geometry
still validates the full body/hull. The player's dynamic lookahead is bounded
to 48 px and movement substeps to 2 px; longer routes do not cause a full-length
collision scan every frame. Tiny endpoint roundoff cannot stall arrival.

Five coats of cats now have independent four-phase walking cycles in all eight
directions, including dedicated rear paw sheets. Carry drops are sought 880–1240
px away, five times the previous radius, with distance-based timeout and bounded
replanning. Embark/disembark are directional crossings at all eleven docks, not
buttons or proximity triggers. [Shared forest](SHARED-FOREST.md) documents the core.

## Verification

- Full `npm test`, art/cutout validation, 237 collision-safe routes, 224 river
  checks, 261 foundation assertions and real-terrain construction parity.
- Main Chrome suite: seven viewports, six locales, interiors/doors, recipe,
  dock approach and isolated Studio crop/diff/autosave. Maximum outdoor zoom
  reaches actual coverage and does not churn the terrain cache.
- `npm run test:world-controls`: held eight-sector changes, central dead zone,
  two-thumb run/row, cancellation, center recenter, same-click dialogue travel,
  wheel/pinch limit and unchanged UI scale, continued hold across river seams.
  Sizes: 1440×900, 768×1024, 390×844, 844×390.
- Real river suite in preview and DDEV: all eleven docks in both directions,
  click and direct movement, no idle/side entry or bounce, currents, seams,
  save/reload. Cats carry ~878 px measured from the protagonist's capture offset,
  with input lock, safe release, grace and reload at three sizes. Hedge puzzle
  push/reset/bowl/seeds and incidental-obstacle journey tests also passed.
- All six direct-origin HTML responses matched the artifact byte-for-byte.
  Public edge application HTML matched with only Cloudflare's own security
  insertion. JS/CSS/manifest/contract hashes, six-language API, flat art, protected
  endpoints and normal website passed.
- Public Chrome desktop/tablet/mobile passed real walking, joystick + left
  turbo via two simultaneous touch pointers, automatic landing, lazy assets,
  no overflow and cat capture/long carry/reload. Every non-GET/HEAD request was
  blocked, including nine injected Cloudflare security POSTs in the release smoke.
- No claim of physical iPhone/iPad/Safari certification. Visual evidence/logs
  remain local under `.local/controls-review`, `.local/production-controls`,
  `.local/cat-review` and `.local/world-controls-*.log`.

## Deployment and preserved state

Verified archive staged before activation. A fast-forward-only update changed
only the website's static pointer; no reset, database command, migration, seed,
cache flush or media overwrite was performed. The intermediate cat-only artifact
`501bbe7fe140bb410033` was staged but never activated on production.

DDEV uses the same final artifact. Studio's single workspace rebased to revision
78 with zero conflicts; the owner's edits were preserved. Existing player saves,
the three clearly labelled example accounts and their nine constructions remain.

Previous production artifact `5edee0b7c4ff56a83a81` remains available. Recovery is
a reviewed forward pointer change to a verified artifact, never restoring an old
database over new player progress. The unrelated VPS development checkout was
not touched.

## Art provenance

Image generation produced the directional cat gait and rear-paw corrections;
authorized local cropping/alpha preparation preserves every original. Exact
prompts, references and registrations are retained in `data/aventura/art/cats/`
(`PROMPTS.md`, `walk-catalog.json`, `rear-catalog.json`). Only reduced 2× modular
packs ship. Controls themselves are lightweight CSS/SVG, not new bitmap downloads.

# Adaptive touch controls — release record

Published and verified on 16 September 2026 at <https://magikitos.com/aventura>
and all five translated routes, with the owner's explicit deployment request.

- Artifact: `49cef729900e43397250`, 391 allowlisted static files.
- Game runtime commit: `c7d30d5bfe5f336a797c5e2614a78235b8aaed90`.
- Website activation commit: `d6189e83ff19156640e6266c0e5b9e35743582b7`.
- Manifest SHA-256: `bb1039e45691fb57faf5a8e014138e5a71b01e4cd8c15948d8c48368cf7e7d7f`.
- API, schema, identity, economy, art and saves unchanged. Documentation-only
  commits after these do not change the published runtime bytes.

## Behavior and implementation

Joystick and turbo start hidden in static HTML. Initial touch presentation uses
`pointer: coarse`, no `any-pointer: fine` and positive `maxTouchPoints`.
`input-modality.js` then follows trusted Pointer Events and keyboard input,
repeatedly, not with one-shot listeners. Touch shows the joystick; genuine
mouse/pen or gameplay keyboard input hides it. Mouse movement cannot interrupt
active fingers. Compatibility mouse events do not flip touch mode, and typing
or composing inside a form is not treated as a switch to keyboard gameplay.

`world-controls.js` remains responsible for continuous eight-way direction and
pointer capture. Left-hand turbo appears only while that joystick has an active
direction. Releasing direction, entering the central dead zone, cancellation or
focus loss also disarms turbo, even if the other finger remains held down.
Held space still runs/rows with keyboard movement. Speeds and navigation are
unchanged by this release.

Recenter is a sibling of the joystick, so it remains available on desktop when
the joystick is hidden. On touch it occupies the joystick's center. Dialogue,
listening and building clearance adapts to whether touch controls occupy space.
There are no new bitmap downloads, analytics events or per-frame modality checks.

## Verification

- Full `npm test`: core, navigation, art, collision, river, construction,
  contracts and immutable installation checks passed.
- New `npm run test:input-mode`: static capability combinations, repeated
  touch/mouse/keyboard switching, synthetic event rejection, active-finger
  arbitration, form composition, no duplicate presentation writes and safe
  focus loss. Browser suite includes JS-disabled first paint, desktop, mobile,
  tablet and simulated hybrid profiles, two-thumb input and recenter without a
  joystick. All passed locally and against production.
- `test:world-controls`: real touch pointers through all eight directions,
  two-thumb run/row, dead zone, release, cancellation, recenter, same-click
  dialogue dismissal/travel, wheel/pinch map-only zoom and held input over river
  seams. Passed at 1440×900, 768×1024, 390×844 and 844×390.
- River regression: all eleven docks in both directions at three viewport
  sizes. Main browser regression: seven sizes, six locales, interiors, doors,
  recipe and isolated Studio crop/diff/autosave. All passed.
- Repo-boundary suite: independent static startup/movement/save without web/API,
  mocked identity/human-proof/guardian/rating behavior, six DDEV HTML shells,
  normal website and absence of the old HTML adapter. Both copies of OpenAPI
  remain identical, version `2026-09-16`.
- Production: all six direct-origin HTML responses matched the artifact bytes.
  Public-edge application HTML matched allowing only Cloudflare's own security
  insertion; asset/manifest/contract hashes, flat art, protected API, localized
  bootstrap and normal website passed. Walking, rowing, simultaneous steering
  and turbo, automatic landing, lazy assets and no overflow passed at desktop,
  tablet and mobile sizes. Separate live modality suite passed all four profiles.
- Public browser checks blocked every non-GET/HEAD request; zero application
  writes were sent. Nine Cloudflare security POSTs were also blocked during the
  release smoke. No players or world objects were created for these tests.

This is Chrome automation, not physical Safari/iOS/Android/Surface certification.
Hybrid tests simulate capability queries while sending browser input. Evidence
is local under `.local/touch-mode-*.log`, `.local/modality-review/` and
`.local/production-controls/`. Maintenance findings and device gaps are in
[the health review](HEALTH-AND-NEXT-STEPS-2026-09-16.md).

## Deployment and preserved state

The archive and installer were hash-verified, then the immutable release was
staged as the website owner without activating it. The live tracked tree was
checked before a fast-forward-only update whose sole change was
`public/game/current.json`. No database commands, migration, import, seed,
cache purge, media overwrite or save reset were performed.

DDEV serves the same artifact. Studio's single workspace stays at revision 78
with zero conflicts and the owner's changes intact. Existing saves and the
three explicitly labelled example accounts with their nine constructions remain
untouched. The unrelated VPS development checkout was not changed.

Previous artifact `10bbdd2662e705765cc8` remains available for existing clients
and recovery. Rollback means a reviewed forward pointer change to a verified
artifact, never restoring an old database over players' progress.

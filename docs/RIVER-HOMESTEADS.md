# River and kelihouses — implementation log

**Historical release, superseded by [Shared Forest](SHARED-FOREST.md).** Private
parcel discovery/editing and the twig-paddle recipe described below are no longer
live features. This document preserves what was actually shipped on 15 September.

Approved scope, 15 September 2026. Subsequently published with explicit owner
authorization; see [production evidence](RELEASE-RIVER-2026-09-15.md). This log
describes the implementation and its boundaries, not future feature promises.

## Decisions

- Existing ferry NPC stays as a nostalgic neighbour giving the bottle hint.
  Remove fares and the scripted two-passenger crossing, not the neighbour.
- Human picnic moves to the northwest. Humans leave only after the skewer has
  been made. Cooking and setin rewards remain; neither gates river travel.
- One reusable half-plastic-bottle craft: knife (retained), bottle, two twigs,
  two broad leaves. Twigs become renewable counted items. Materials cannot be
  lost because humans leave or because a save is interrupted.
- Playable currents, safe setbacks and repeated attempts. No health, damage
  meter, fuel, reflex rhythm or item loss. Arrow pad bottom right while boating.
- Continuous exploration through authored river reaches, optional detours,
  the existing island, personal parcels and other people's jetties.
- One editable kelihouse per web identity. Saving also updates its public
  appearance; no separate publish button or live editing for visitors.
- Public snapshots exclude inventory, private progress, credentials and email.
  Visitors cannot alter or take objects. Reuse existing anonymous/claimed web
  identity; the device ID is not authorization. Owner changes are revisioned.
- ALL persistence/authorization backend code belongs in the PRIVATE WEBSITE
  repo. The public game has the documented API client and approved asset data
  only. This supersedes the earlier suggestion of a game-repo server.
- Preserve all 100 NPCs. Only the present protagonist gets essential boating
  animation; no expansion of every NPC's pose repertoire. No Forest Book.
- Keep the established camera, 2x integrated art, selective motion, optional
  content API and normal website. Studio remains a single local workspace.

## Delivery checklist

- [x] Shared validated river, vessel and parcel definitions.
- [x] Private web API, local schema, ownership/concurrency/idempotence tests.
- [x] Anonymous/claimed identity reuse, private save and conflict recovery.
- [x] Picnic, renewable materials, craft, clue NPC; preserve existing saves.
- [x] Vessel locomotion, currents, hull geometry, safe transitions/reload.
- [x] River art, protagonist rowing, five playable reaches and islet detour.
- [x] Personal exterior/interior, editing, stock, protected access and variants.
- [x] Public snapshots, river jetties, paged discovery and read-only visits.
- [x] Studio scenes/gallery/path editing and read-only navigation review overlay.
- [x] Six locales, keyboard/touch/zoom/pan, bounded scene/asset loading.
- [x] Core, security, browser, offline, conflict and multi-profile verification.
- [x] Install in DDEV, visual review and operations/API/art documentation.

## Starting state

Production started at artifact `fe26c8158651ab28d10c`. Both repositories were clean
at the start. Docker was recovered with owner approval in the previous turn:
DDEV, six static shells, 167 local API checks and actual browser movement at
1440x900, 768x1024 and 390x844 passed. Old release notes describing Docker as
still blocked are historical. No data import/reset is needed for this work.

## Try locally

- Game / actual private-web API: https://magikitos.ddev.site/aventura
- Standalone game preview: http://127.0.0.1:47834/aventura
- Authoring Studio: http://127.0.0.1:47832/#map

Existing saves are retained. For the whole picnic discovery, use a fresh browser
profile rather than resetting the owner's progress. The bin and tools remain
obtainable after the humans leave. Remo's clue sends you to the bottle; take a
knife, bottle, two twigs and two broad leaves to the dock. The boat has no fare.

Remontar: willow reach → reed junction (islet detour) → rapids → roots → neighbour
jetties → own island. Currents are visible through drifting strokes. At the rapids,
rowing into the strong central stream pushes you back; the bank offers a generous
tested remanso. No death, health or resource penalties. Disembark at marked jetties.

Your garden/interior use one committed layout, with an in-memory edit transaction
and Cancel/Save, not multiple named drafts. Save makes the layout public. The
house shell/terrain/dock are authored foundations, not freely movable player
objects; the ten stock families have curated variants. Visitors use the same
templates, hydrate a saved snapshot and return to the original river jetty.

## Module and authoring boundaries

`river-navigation.js` owns hull geometry/vector fields/substepped motion;
`river.js` owns input/boarding/travel. Quests remain JSON behaviors. The old paid
ferry controller/compositor is removed, including its obsolete localized fares.
`homestead-layout.js` is pure placement validation, `homestead.js` owns editing
and visits, `river-neighbors.js` resolves public river addresses, `cloud-save.js`
owns debounced synchronization/conflict recovery. See [API protocol](GAME-SAVE-API.md).

All 100 NPC identities remain. Only Ascua received a new rowing sheet: eight
directions × four poses. Three new art masters (rower, picnic bin, bottle/craft)
were generated with the imagegen skill; exact prompts, references and original
masters are preserved in `data/aventura/art/river/catalog.json` and `sources/`.
The authorized local alpha pipeline is `scripts/prepare-adventure-river.php`.
Runtime art is baked at 2x integrated density. The rowing pack loads on boarding,
not at forest startup; no source-image scan runs in the browser.

Scene topology uses `navigation.landings`, `currents` and `exits`, in tiles except
current vectors in pixels/second. Edit those authored JSON definitions and run
the geometry suite. Studio's **Río** checkbox visualizes them; it deliberately
does not claim to drag-edit vector fields. Studio edits authored templates once,
excluding derived guest scenes and moored boats. No public authoring endpoint.

## Verification and corrections from review

- Full `npm test`: art/crops, terrain/collision, 179 safe interaction routes,
  doors, legacy gameplay, 100 residents, Studio diffs and immutable installs pass.
- River suite: 63 checks, including full-hull landings, actual upstream remanso
  traversal through every reach, frame-rate independence, recipe and save recovery.
- Parcel suite: 34 JS/PHP parity cases plus every half-tile of editable ground
  checked against the actual scene floor; no water/cutaway corners can be furnished.
- Private web: 20 storage/ownership/merge/recovery checks and 15 actual HTTP/auth
  checks. HTTP testing caught and fixed missing router registrations.
- Cloud tests cover lost responses across reload, offline changes without false
  conflicts, competing edits, fresh devices, account switch, local recovery,
  failed-destination rollback, visitor isolation and token separation.
- Browser: controls/current/travel/reload/edit/save/river-jetty visits at
  1440×900, 768×1024 and 390×844. The general suite additionally covers seven
  viewport sizes, six locales, door/stair round trips, craft and Studio edits.
- Boundary/offline suite and 167 local public-API checks pass. No production
  requests were needed. Successful browser writes use mocks; the HTTP suite
  creates/removes precisely scoped local fixture sessions and profiles.

The rapids' initial safe margin was too narrow; the vector fields were narrowed
without weakening the centre's push. Parcel bounds were moved inside the real
island/rounded floor. Large trees were moved away from the jetties' visual access;
the picnic bin and approach were spaced apart. New action buttons share the game
palette and 44px touch targets instead of browser-default buttons.

## Operations and honest limits

Installed local and production artifact: `2757a9112b5f30945023`.
Both API-contract copies match.

Local migration `4229_game_profiles.sql` was first applied after backup at
`../magikitos/.local/backups/before-game-profiles-20260915.sql.gz`. The authorized
production release subsequently applied the same migration with the VPS migration
runner and its separate pre-migration backup. No user progress was reset. Local
test identities were removed; the live browser smoke sends no mutation requests.

Cloud snapshots are bounded but client-authored, not an anti-cheat economy. No
terrain uploads, live collaboration, avatar expansion, Forest Book, trading,
competitive rewards or new story quests. Those remain future decisions.
Publication coordinates the private migration/API/router and reviewed game
artifact. Do not deploy either half alone. Exact commits, verification and
recovery constraints are in the linked production ledger.

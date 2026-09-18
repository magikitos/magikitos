# Private adventures, shared forest

Current contract: **2026-09-18**, mirrored in both repositories as
`docs/world-api.openapi.json`. PHP, identity, database and authorization belong
only to the private website. The public game consumes JSON and ships no backend.

## Separate authorities

- `game_profiles`: private, client-authored location/adventure snapshots, CAS and
  recovery. They are **not** a source of spendable construction materials.
- `game_accounts`: server-authoritative materials, reusable tools, reward flags,
  recipe knowledge, game setines and limited social trust.
- `game_community_*`: public object snapshots, ownership, revisions, reversible
  history and deduplicated eligible human use. No private parcels remain live.

Existing website bearer authentication is reused. A device UUID is not a credential.
Identity creation is explicit (connect or first build), never a scene-load side effect.
The game currency never changes website reputation, checkout money or events.

## Endpoints

All paths are relative to `/api/world/`; no locale is required. JSON is bounded
to 32 KiB, and the shared IP limit is 120 requests/minute. Build writes additionally
have a 12/minute author limit. Rejected requests do not debit materials.

| Endpoint | Authority and result |
| --- | --- |
| GET game-state | Bearer: own active profile and private recovery metadata |
| POST game-save | Bearer: private snapshot CAS; shared object positions are rejected |
| POST game-restore | Bearer: activate owned archived profile, preserving displaced one |
| GET game-account | Bearer: own account; lazily initializes an empty/frozen-legacy account |
| POST game-action | Bearer: reviewed scene/entity/action command, never a supplied balance |
| GET community?zone=… | Public bounded snapshot; optional bearer adds `mine` |
| POST community-build | Bearer: place/move/remove transaction and updated account/snapshot |
| POST community-use | Bearer: explicit human use of a usable object; no NPC calls |

`parcels` and `parcel` public discovery endpoints are removed. Public object DTOs
contain kind, variant, position, rotation, revisions, age, heritage and public
author name/handle; never email, internal user ID, inventory or private progress.

Private profiles contain only `id`, `revision` and `state`; recoveries contain
`id`, `revision` and `updatedAt`. `game-save` accepts `profileId`, `baseRevision`,
`operationId` and `state`, never a parcel. Local puzzle-object positions belong in
`state.objects`; authored shared props are controlled only by the live service,
excluded from client saves and rejected by PHP if a caller supplies them anyway.

## Transactions and retry

Actions use `operationId`, `baseRevision`, `scene`, `entity`, `action`. Construction
also uses `zone`, `zoneRevision`, `operation` and an object descriptor. Moving and
removing require its current revision. IDs are 32 lowercase hexadecimal characters.
Keep and resend the **identical request** after a lost response; changing data under
the same operation ID is rejected. Account receipts retain the latest 32 operations;
older replays still fail stale revision checks rather than charging twice.

Server lock order is users → accounts → zone → objects. Identity merging uses the
same user-lock order. Definition, knowledge, journey prerequisites, costs, inventory
bounds, real terrain mask, footprint, surface type, overlaps, forbidden spots,
trace neighbourhood, connected access, quotas, author and heritage are checked
**on the server**. The browser's green preview is guidance, never permission.

A piece may also **require a tool** it never spends (a rake opens paths and lasts
for ever): that is `gameAuthorityMatches`, the same question that already guarded a
corner, asked about the piece. And a piece may declare `removeCost` instead of a
refund, because taking a path away is sowing grass over it rather than picking it up.

The initial release forbids all foreign modifications, regardless of claimed trust.
Heritage blocks even owner removal. Age alone does not confer heritage: minimum
28 days and 10 distinct eligible visitors are required. Only contacted accounts at
least seven days old count, once per object, excluding its author. Trust is bounded;
it does not yet grant foreign-editing privileges. This is deliberately conservative,
not a claim to solve Sybil resistance or make automatic moderation infallible.

## Local-first and migration

Private saves debounce for 10 seconds; unchanged states do not write. Local action
outbox: at most 192 commands, one exact in-flight request, no frame/movement events.
Construction is online/acknowledged only; an uncertain response remains durable
across reload and must resolve before a different placement. Offline browsing,
walking and private progress work; shared building requires the API.

Conflicting private saves require an explicit local/remote choice and keep three
bounded local recovery copies. Session changes archive pending commands instead
of attributing one person's play to another. Account reconciliation cannot mint
materials from local inventory. Do not start a very long offline resource-gathering
session after the 192-command synchronization warning: the outbox is bounded.

If a queued object has since been removed, the API's explicit
`404 unknown_action` is terminal. The same applies to `409 requirements_not_met`
when an offline recipe no longer applies to the authoritative state (for example,
an already-lit fire). Its exact command and owner are first saved in
`magikitos.adventure.actions.rejected`, then the queue continues. This local
recovery archive holds at most 192 records; a full/unwritable archive keeps the
command pending. Ordinary HTTP 404s, network failures and authorization failures
are not discarded. Reconciliation uses the authoritative account, never a reset
or a replacement balance. `scripts/check-river-ddev-browser.cjs` exercises the
removed-mushroom queue, conserved tools/money, reload and actual online dock
crossings with disposable identities against local PHP/WebSocket services.

Migrations **4230** (authority/community tables) and **4231** (cutover snapshot and
merge recovery) are additive. 4231 freezes existing active server saves exactly
once; only this immutable copy may initialize pre-existing balances. Future
`game-save` requests cannot modify that snapshot or mint materials.

Browser-only pre-cutover games preserve a local recovery snapshot and replay a
bounded set of existing quest/tool entitlements through normal validated commands.
Arbitrary client material counts/setines are not imported. Old boat owners retain
navigation and receive oars; unfinished cooking/tool progress remains recoverable.
Old private layouts are retained **privately** for recovery, never published as
communal objects without an explicit construction transaction.

Identity merge archives both authoritative accounts before joining unlocks and
resource bitsets. Overlapping materials and balances use max, not sum; construction
authorship transfers. Account deletion removes private data and nulls public author
references rather than demolishing the shared forest. Anonymous cleanup retains
identities with game progress or constructions.

## Security boundary and operation

This is server-authoritative crafting, **not server-simulated movement**. The API
validates finite pickups, recipes, prerequisites, timers and budgets. It does not
prove a browser really walked past a cat or physically reached a pickup. A modified
client can automate valid personal actions, but cannot invent counts, build on
protected ground or bypass ownership/heritage with an arbitrary API call. Paid
trading or competitive prizes would require additional anti-abuse design.

NPC activities are local atmosphere and never award social trust. Human usage is
a capped aggregate, not an analytics events feed. No socket or live-presence loop.

Moderator recovery is CLI-only in the private repository:
`php scripts/restore-community.php HISTORY_ID EXPECTED_OBJECT_REV --apply`.
Inspect the history and take a backup first. Restore validates current geometry,
uses CAS and records another immutable history entry; if removal refunded materials,
restoration reclaims them from the original owner. It is not publicly routed.

## Verification

Game: `npm test`, `node scripts/check-cats-browser.cjs`,
`node scripts/check-community-browser.cjs`, `npm run test:mobility`,
`npm run test:api:local`, `npm run test:boundary`.

Private web/DDEV: `scripts/check-community.php`,
`scripts/check-community-concurrency.php`, `scripts/check-game-profiles.php`,
`scripts/check-game-http.php`. Temporary fixtures clean up only their own IDs/zones.

Production examples use `scripts/seed-community-examples.php --apply-labelled-examples`:
only three dedicated `bosque-ejemplo-*` accounts, visibly labelled as game tests.
All rewards and placements use the public HTTP API. Sessions are revoked afterward;
the examples remain. Never borrow a real person's identity for synthetic play.

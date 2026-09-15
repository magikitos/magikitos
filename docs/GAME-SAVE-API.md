# Private progress / public kelihouses

Published with owner authorization, 2026-09-15; see
[release evidence](RELEASE-RIVER-2026-09-15.md). The executable contract is mirrored in both
repos as `docs/world-api.openapi.json`. Backend code and schema are private-web
owned; the public game contains its client, data and validation UX only.

## Endpoints

No `lang` needed. Existing bearer authentication and explicit-origin rules apply;
device UUID is never authentication. Maximum JSON body: 32 KiB. Shared game
limit: 120 requests/minute/IP, using the website's file-backed limiter.

| Endpoint | Input | Result |
| --- | --- | --- |
| GET game-state | Bearer | Own active profile or null; owned merge-recovery metadata |
| POST game-save | Bearer; profileId, baseRevision, operationId, state, parcel | Atomic private save and automatically public layout |
| POST game-restore | Bearer; profileId, currentId, baseRevision | Activate owned archived profile; preserve current one |
| GET parcels | Optional opaque cursor | At most 8 public addresses and nextCursor |
| GET parcel | id | Public owner name/handle and saved layout only |

First save: `profileId: null`, `baseRevision: 0`. Later: acknowledged ID/revision.
IDs and operation IDs are 32 lowercase hex characters. Keep and retry the
**identical** pending operation after a lost response, including reload. The
server keeps 16 receipts and locks the owner's row. CAS rejects stale revisions
with 409; different data under an existing operation ID is rejected too. A late
replay returns current profile plus original `acknowledgedRevision`: differing
revisions require conflict resolution.

## Local-first lifecycle

The browser persists locally immediately and coalesces dirty cloud saves over
10 seconds, not each frame. Unchanged states do not write. Explicit parcel save
flushes immediately. Offline work stays local; online retries the same receipt.
Opening a scene does not mint an identity; explicit connection/parcel save reuses
the website's controlled anonymous-identity flow when needed.

A fresh device restores its owner's save. Competing local/remote progress prompts
for a choice; three bounded local recovery copies remain available. Switching
accounts cannot silently upload the previous person's game. Merge preserves both
profiles; restoring one archives the other. Account deletion removes its profiles;
game progress excludes an account from automatic anonymous recycling.

`parcel: null` means no home yet. Autosave cannot clear an established parcel with
null. Both spaces share a maximum of 48 registered objects, stock limits, legal
variants and a half-tile grid. Solids cannot overlap; dock/path/door are protected;
walkable access is checked. Backend validation uses `game-contract.json` from its
reviewed installed artifact, never a browser-supplied schema. PHP/JS validators
run identical placement fixtures.

## Public by saving, not live

Every saved layout is public automatically. DTO: profile ID, revision, public
owner name/handle and layout. Never email, internal user ID, inventory, purse,
traces, credentials or private progress; no arbitrary HTML, URLs or uploads.

Visitors receive a snapshot; later owner edits appear on a later visit. No
sockets, live-presence loops or polling. Three river jetties sample addresses
once per session; the neighbour list pages through the rest. Visitors cannot move
or collect furniture; visitor movement never overwrites their own saved position.

Progress is bounded but client-authored: **not a cheat-proof competitive economy**.
The game purse cannot award/spend website reputation, money or ledger entries.
No movement analytics or events-table writes are introduced.

## Verification

```sh
node scripts/check-cloud-save.cjs
GAME_TEST_WEB_ROOT=../magikitos node scripts/check-homestead-layout.cjs
node scripts/check-river-browser.cjs
```

Private web: `ddev exec php scripts/check-game-profiles.php` and
`ddev exec php scripts/check-game-http.php`. They use temporary local fixtures,
not the owner's account, then remove those exact identities/sessions. The browser
suite mocks protected writes; PHP HTTP tests exercise actual local routing,
authorization, validation and persistence.

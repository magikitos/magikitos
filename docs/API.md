# World JSON API

The private website owns this interface. The public game consumes it without
PHP templates or private JavaScript. Machine-readable schema:
[world-api.openapi.json](world-api.openapi.json).

## Transport and ownership

Same-origin default: `/api/world/`. Every content GET requires `lang`:
`es|en|de|fr|it|pt`. Responses are JSON, no-store and nosniff.
Public content uses existing publication/translation rules. IDs identify a
piece **together with kind and language**; a voice ID identifies the recording,
not its dictionary term. A region/category slug is an identifier, not HTML.

No resource returns HTML, CSS, scripts or authored game scenes. Explicit
private-save/shared-world endpoints return validated game data, never executable assets.
URLs are public website/media links; the browser accepts only HTTP(S) URLs on
its configured website origin. A missing local media file is not fetched from
production. Missing translations produce an empty collection or 404, not
silent content in another language.

## Reads

| Resource | Parameters beyond lang | Result |
| --- | --- | --- |
| GET bootstrap | none | locale, website destinations, capability flags, public Turnstile site key, limits |
| GET discover | kind; round (1+); exclude (comma-separated piece IDs) | Up to six playable pieces from existing content pulse, including its exploration selection |
| GET item | kind; id; optional voice (expressions only) | One published piece; selected voice must belong to that term/language |
| GET browse | kind; cursor; q; category or region | Up to 24 pieces and nextCursor |
| GET index | kind | Category index for stories/jokes; region index for expressions |
| GET catalog | kind=art; cursor | Up to 24 flat colouring sheets; nextCursor |
| GET guardian-thread | lang; term_id; optional bearer | The caller's existing conversation; opening it never creates an identity |
| GET csrf | optional bearer | csrf_token for subsequent guardian POST |

Kinds are `cuento|chiste|expresion`. A cursor is an integer offset, starting at
zero, maximum 10000; `null` means the end. Search is manual submission, not
a query per keystroke. Story/joke search reuses title/transcription search.
A category cannot be combined with q. Regions apply only to expressions;
categories apply only to stories/jokes. Expression q and region can combine. A region-filtered result samples a voice
from that same region; a term without a voice there remains a text-only result.

Discovery exclusions are bounded to the last 500 unique positive IDs; the game
retains 400 heard IDs per kind/language. Discovery deliberately uses the shared
pulse service, not a replacement random/top-one SQL query. Content pools are
requested per gathering and read once, not per NPC or on a timer.

### Piece DTO

```json
{
  "id": 123, "voiceId": null, "kind": "cuento", "lang": "es",
  "name": "Nombre público", "handle": "handle-publico", "authorUrl": "/u/handle-publico",
  "title": "Título", "summary": "Texto plano",
  "url": "/cuento/slug", "audio": "/assets/audios/cuentos/es/archivo.ogg",
  "duration": 123.4, "region": null, "regionSlug": null,
  "category": "bosque", "rating": null
}
```

Examples are illustrative, not guaranteed database records. Duration is in
**seconds**, including expression voices converted from milliseconds.
Audio, authorUrl, voiceId, category and region can be null. Rating is the
existing aggregate mean or null. No email, internal user ID, session, private
moderation fields or unpublished contributor data is exposed by public DTOs.
Names/titles/summaries are plaintext; clients must not interpret them as HTML.

Art is a single flat catalogue: each Sheet exposes id, localized title,
non-null image (master) and thumb (300px derivative or master fallback).
There is no collection selector, collection object or intermediate collection UI.
The gallery loads thumbs; selecting a sheet loads its master. Printing links to
the localized art hub in bootstrap.destinations.art. The artwork URL is shared
across locales, so it is not cached under separate language-specific image keys.
The shop is NOT exposed here: `kind=products` was removed on 17 September 2026
(owner's decision). The forest used to serve the whole shop catalogue — name,
price, stock, picture and buy URL — to furnish the workshop with one bench per
figure. The shop lives on the website, reachable from the menu and the footer;
Carmen's workshop stays as a place and stops being a display case.

## Explicit writes

JSON object bodies only, maximum 32 KiB. Unsupported field types/malformed JSON
are rejected before calling business services. The server—not the client—
validates permissions, proof, targets, limits and reputation changes.

| Resource | Body | Behavior |
| --- | --- | --- |
| POST identity | locale; optional create:boolean; optional turnstile_token | No create: reports existing user or null, never mints. create:true: existing controlled contributor-identity flow |
| POST vote | tipo=cuento/chiste/voz; id:int; lang; setas:int; device_id; turnstile_token | Delegates to existing rating service (1–5), deduplication and author reputation accounting |
| POST guardian | lang; term_id:int; texto; csrf_token; turnstile_token | Existing guarded conversation service, maximum 300 characters; may create a contributor on this explicit action |

The guardian saves conversation and may invoke the website's paid model
service. Its reply is plaintext; publication and the large expression editor
remain on the website. The game discloses the save/identity behavior before
submission. The guardian thread is private to the current identity. Expressions/guardian are
part of the broader website API, not an active game section.

Authorization: `Authorization: Bearer SESSION_TOKEN`, matching the website.
Returned `token` values are adopted centrally. Never put tokens in URLs,
artifacts or game saves. Device ID alone does not authenticate anyone.

The game loads its own Turnstile client only when an explicit protected action
needs it. The **public** key comes from bootstrap; the secret and verification
stay server-side. Empty local site keys do not add a production bypass: the
existing backend verification service remains authoritative.
An interactive challenge temporarily lifts an existing native dialog and
restores it on success, failure or cancellation. Tokens are not reused between
writes. Provider configuration follows the
[official Turnstile widget documentation](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/).

Existing limits remain: identity mint 10/hour before the shared identity cap;
ratings and guardian enforce their existing limits/proof/abuse budgets; CSRF
refresh uses its existing limit. Public world reads additionally allow
240 requests/minute/IP with Retry-After. Limits use the website's file-backed
limiter, not the events table.

## Cross-origin clients

Same-origin browsers are the default. If an Origin header is present it must
match the website origin or an exact entry in private
`WORLD_API_ALLOWED_ORIGINS` (comma-separated). No wildcard credentials.
OPTIONS advertises only that endpoint's method, explicit headers and
credentials. Native clients without Origin still need the same auth/proof;
absence of Origin is not permission.

Mobile app packaging and a platform-specific human-proof/login flow require
a later client implementation; never bypass verification to make an app work.

## Browser storage interface

| Key | Owner / meaning |
| --- | --- |
| magikitos_session | Shared website authentication token; logout observed immediately |
| magikito.discovery.device_id | Shared device UUID; not authentication |
| mgk_heard_KIND_LANG | Last 400 heard piece IDs |
| magikitos.autoplay | Playback preference |
| magikitos.setas | Local rating display cache, keyed tipo:lang:id; server remains authoritative |
| magikitos.adventure | Game-only progress, position, needs, inventory and local purse |
| magikitos.adventure.home | Single committed owner layout |
| magikitos.adventure.sync | Owner, revision, pending receipt and bounded recovery copies; no token |

⛔ **THE GAME DOES SEND GAMEPLAY TELEMETRY, AND THIS PAGE USED TO SAY IT DID NOT** (21-sep-2026,
review). `public/assets/js/adventure/telemetry.js` posts to `/api/world/telemetry` with
`sendBeacon`: `game_start`, `game_first_act`, `game_minute`, `game_scene`, `game_milestone`,
`game_listen`, `game_contribute`, `game_account`, `game_stuck`, `game_where` (a coarse heat map,
at most 40 cells of 32 world px — two tiles — per scene, ordered by time spent) and `game_end`.
Each event carries the device id from `magikito.discovery`, a per-session UUID and the website
session token when there is one — so it is attributable to an account, not anonymous. Queue capped
at 50 events (`MAX_QUEUE`), flushed every 15 s (`FLUSH_MS`) and on `pagehide`; coming back from
the back/forward cache starts a new session. The endpoint is in the OpenAPI contract. A false privacy claim is worse than no claim: if this behaviour should change,
change the code, not this paragraph.

Existing sessions are read at startup to restore progress; user creation stays explicit. The
private website's existing independent analytics behavior is unchanged.

## Errors and tests

400 invalid query/body, 403 origin/proof/permission, 404 missing or wrong-language
public item, 405 method, 429 rate limit, 503 unavailable. Domain write services
may return their existing precise status/error. Common envelope:
`{"ok":false,"error":"invalid_locale"}`. CSRF success returns only
`{"csrf_token":"…"}`; guardian-thread preserves its existing thread DTO.

Local contract checks: `npm run test:api:local`. They only use a local host,
perform public reads/identity reads and deliberately rejected writes.
Browser tests mock successful identity/rating/guardian writes. Private-web DDEV
game tests create temporary fixture identities/sessions and remove only those
fixtures; no emails, votes, orders or model calls.

## Private adventures and shared construction

`game-state`, `game-save`, `game-restore`, `game-account`, `game-avatar`,
`game-action`, `community`, `community-build`, `community-use`, `community-mine` and
`community-defuse` need no `lang`.
`game-avatar` chooses which playable duende the account is: the body carries only
a `variant`, validated against the installed release's `live.avatars`, and the
forest ticket signs whatever is stored so everyone sees the same body.
See the save protocol below and the mirrored OpenAPI. Authorization and
persistence live exclusively in the private website, not this repository.

## Save protocol and server authority

Current contract: **2026-09-18**, mirrored in both repositories as
`docs/world-api.openapi.json`. PHP, identity, database and authorization belong
only to the private website. The public game consumes JSON and ships no backend.

### Separate authorities

- `game_profiles`: private, client-authored location/adventure snapshots, CAS and
  recovery. They are **not** a source of spendable construction materials.
- `game_accounts`: server-authoritative materials, reusable tools, reward flags,
  recipe knowledge, game setines and limited social trust.
- `game_community_*`: public object snapshots, ownership, revisions, reversible
  history and deduplicated eligible human use. No private parcels remain live.

Existing website bearer authentication is reused. A device UUID is not a credential.
Identity creation is explicit (connect or first build), never a scene-load side effect.
The game currency never changes website reputation, checkout money or events.

### Endpoints

All paths are relative to `/api/world/`; no locale is required. JSON is bounded
to 32 KiB, and the shared IP limit is 120 requests/minute. Build writes additionally
have a 12/minute author limit. Rejected requests do not debit materials.

| Endpoint | Authority and result |
| --- | --- |
| GET game-state | Bearer: own active profile and private recovery metadata |
| POST game-save | Bearer: private snapshot CAS; shared object positions are rejected |
| POST game-restore | Bearer: activate owned archived profile, preserving displaced one |
| GET game-account | Bearer: own account; lazily initializes an empty/frozen-legacy account |
| POST game-avatar | Bearer: which playable duende this account is; the id is validated against the installed release's `live.avatars` |
| POST game-action | Bearer: reviewed scene/entity/action command, never a supplied balance |
| GET community?zone=… | Public bounded snapshot; optional bearer adds `mine` |
| POST community-build | Bearer: place/move/remove transaction and updated account/snapshot |
| POST community-use | Bearer: explicit human use of a usable object; no NPC calls |

`parcels` and `parcel` public discovery endpoints are removed. Public object DTOs
contain kind, variant, position, rotation, revisions, age, heritage and public
author name/handle; never email, internal user ID, inventory or private progress.

The chosen duende lives on the account (`game_accounts.avatar`), never inside a
private profile: profiles are restorable from older copies, and a restore must not
change a player's body. It is NULL until somebody says; the forest ticket draws
once, deterministically per account, and signs whatever is stored, so everyone sees
the same body. Choosing also fills `users.gender` when it is still `U`; the draw
never does, because being dealt a face is not a statement about yourself.

Private profiles contain only `id`, `revision` and `state`; recoveries contain
`id`, `revision` and `updatedAt`. `game-save` accepts `profileId`, `baseRevision`,
`operationId` and `state`, never a parcel. Local puzzle-object positions belong in
`state.objects`; authored shared props are controlled only by the live service,
excluded from client saves and rejected by PHP if a caller supplies them anyway.

### Transactions and retry

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

### Local-first and migration

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

### Security boundary and operation

This is server-authoritative crafting, **not server-simulated movement**. The API
validates finite pickups, recipes, prerequisites, timers and budgets. It does not
prove a browser really walked past a cat or physically reached a pickup. A modified
client can automate valid personal actions, but cannot invent counts, build on
protected ground or bypass ownership/heritage with an arbitrary API call. Paid
trading or competitive prizes would require additional anti-abuse design.

NPC activities are local atmosphere and never award social trust. Human usage is
a capped aggregate, not an analytics events feed. The live forest DOES keep a socket
(`wss://magikitos.com/bosque`, `docs/forest-protocol.json`): what has no socket is this
community/construction API, which is plain authenticated HTTP.

Moderator recovery is CLI-only in the private repository:
`php scripts/restore-community.php HISTORY_ID EXPECTED_OBJECT_REV --apply`.
Inspect the history and take a backup first. Restore validates current geometry,
uses CAS and records another immutable history entry; if removal refunded materials,
restoration reclaims them from the original owner. It is not publicly routed.

### Verification

Game: `npm test`, `node scripts/check-cats-browser.cjs`,
`npm run test:construction-permits`, `npm run test:mobility`,
`npm run test:api:local`, `npm run test:boundary`, `npm run test:transitions`.

Private web/DDEV: `scripts/check-community.php`,
`scripts/check-community-concurrency.php`, `scripts/check-game-profiles.php`,
`scripts/check-game-http.php`. Temporary fixtures clean up only their own IDs/zones.

Production examples use `scripts/seed-community-examples.php --apply-labelled-examples`:
only three dedicated `bosque-ejemplo-*` accounts, visibly labelled as game tests.
All rewards and placements use the public HTTP API. Sessions are revoked afterward;
the examples remain. Never borrow a real person's identity for synthetic play.

## Setómetro in the forest (21 September 2026)

The balance beside the tavern opens the daily pair and global ranking as native game
activities. It exposes no collaborative/session mode, website HTML or embedded page.

- `GET /api/world/setometro?lang=es`: server day and two `{id,title,score}` concepts.
- `GET /api/world/setometro-ranking?lang=es&cursor=0`: up to 24 concepts, offset and nextCursor.
- `POST /api/world/setometro-vote`: lang, day, winner_id, loser_id, csrf_token and human-proof token.

The private adapter delegates to the existing daily vote service: same score system,
CSRF/human-proof gates, per-IP/per-identity quotas and website reputation accounting.
It additionally rejects stale/invented pairs (409) and bounds adapter attempts.
**No inventory is awarded or spent.** Ranking scores are not the mushrooms in the bag.
The existing website service permits three daily requests, not a persistent once-only
vote per day. The client remembers a confirmed choice locally and never automatically
retries a POST with an ambiguous outcome. Clearing that local receipt is not an
authorization bypass; the server's shared quotas still apply.

Read-only production tests never submit synthetic votes. Mocked browser tests exercise
submission, cancellation, duplicate clicks, stale day, quota errors and pagination.

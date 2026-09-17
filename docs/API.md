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

No gameplay analytics events or play tracking are sent by the game. Existing
sessions are read at startup to restore progress; user creation stays explicit.
The private website's
existing independent analytics behavior is unchanged.

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

`game-state`, `game-save`, `game-restore`, `game-account`, `game-action`,
`community`, `community-build` and `community-use` need no `lang`.
See [save protocol](GAME-SAVE-API.md) and the mirrored OpenAPI. Authorization and
persistence live exclusively in the private website, not this repository.

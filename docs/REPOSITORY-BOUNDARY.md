# Completed game / website boundary

Current game/website ownership. Deployment evidence: [RELEASE.md](RELEASE.md).

## Ownership

| Public game repository | Private website repository |
| --- | --- |
| Static HTML shell, six locales, engine, scenes, rules, rendering, audio UI, native activities | Public content queries, content pulse, publication rules, identity, authorization, rating accounting, guardian service |
| Original modular art, offline compilers, Studio and regression tests | Normal website, full forms/editors, account, checkout and admin |
| Local-first save, device ID, private progress, shared construction UI | JSON API under `/api/world/`; private profiles/authoritative materials/public objects; static artifact mount |

The game stays at `/aventura` and five translated routes. The home page does
not change. The game’s shell does not run the website bootstrap, database,
session or views. PHP/GD in this public repo are **offline authoring/build
tools**, not a game runtime dependency.

## What was removed

The private website's editable engine, scenes, sprite packs, game Studio,
adventure views, view-capture interceptors and game build steps have been
retired. The `/api/world/content` HTML-fragment endpoint is gone. Website
modules no longer carry `MagikitosWorld` navigation branches or `world:mount`
listeners. A normal website view can no longer be captured into the game.

The game neither parses website HTML nor loads website CSS, Font Awesome,
global/social bundles, cart code, audio-player code or recording editors.
Activity DOM is created locally from whitelisted JSON fields using text nodes.

## Runtime

1. The public game build emits six static pages and content-addressed assets.
2. The host serves one reviewed immutable release under `/game/releases/ID/`.
3. The browser starts the local world and lazily loads sprite packs.
4. Optional JSON calls enrich physical gatherings with published content.
5. Explicit actions use existing website services through the documented API.

The Node preview can run with `--offline`: no website, PHP server or database
is needed to walk, interact, cook, travel, save progress or edit scenes.
API failure affects the requested community activity, not the world.

## Integration contract

See [API contract](API.md) and [OpenAPI](world-api.openapi.json).
Identity is shared by the documented session token, not by importing website
JavaScript. Browser storage works across the game and website when hosted on
the **same origin**. Separate preview ports deliberately have isolated storage.

The existing pulse selector still supplies six-item discovery batches and its
exploration slots. The game performs no analytics collection, play-count writes,
movement streaming. Bounded game snapshots use the separate private save API,
not analytics/events. See [save contract](GAME-SAVE-API.md).

Offline progress is local and untrusted. Spendable construction materials and game
setines have their own server-authoritative account. Website reputation, content
ratings and real-money checkout remain separate. See [authority](GAME-SAVE-API.md).

Full reading, printing, purchasing, recording, account management and other full
editing open explicit normal-website links in a new tab. They are not hidden
modals or embedded pages. Expressions are not exposed in the game; the broader API retains website services
without requiring game scenes for them.

## Release boundary

`npm run build` creates `.local/build/releases/ID/` and a current pointer.
`npm run install:local` validates every file's hash and path, rejects extra
files/symlinks, installs an immutable local DDEV artifact and atomically changes
its pointer. Previous installed releases are retained. No editable engine,
Studio, raw source art, database or secrets are shipped to the host.

The private `src/game-release.php` is only a static mount before bootstrap.
It serves GET/HEAD, handles trailing slash canonicalization, rejects other
methods and returns a controlled 503 if its release is missing. The website
service worker bypasses game routes and release assets so its HTML cache cannot
resurrect the retired adapter.

This is a completed JSON-only browser-runtime separation. Native iOS/Android
packaging, platform permissions and app-store distribution are different future
projects; a portable client/API does not claim those apps have been built.

## Verification

`npm test`, `npm run test:browser`, `npm run test:native`,
`npm run test:api:local` and `npm run test:boundary` cover this contract.
Protected writes are mocked in browser tests: no user accounts, rating records,
paid guardian calls or orders are created by them.

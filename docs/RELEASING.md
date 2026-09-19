# Releasing the independent game

Development commands never deploy. A release needs explicit owner authorization,
reviewed commits in both repositories when the API changes, and an immutable artifact.
The initial Ascua release needed no migration. The shared-forest release requires
additive migrations 4230 and 4231 in the private website; no production DB import.

## Git identity

Use `gh-personal` (`alvarofranz`) for GitHub, and the SSH alias
`github.com-alvarofranz` for Git transport. Check both independently.
Git author and committer must use the personal identity documented in `AGENTS.md`;
SSH/GitHub authentication does not determine the email stored in a commit.
The 16 development commits previously attributed to the work email were
consolidated with the owner's explicit authorization on 16 September 2026.
The original lore commit is preserved. Recovery copies stay LOCAL, never pushed.
Details: [current release ledger](RELEASE.md).

For a **static-game-only** activation, after staging the verified release, a
guarded `git merge --ff-only` of the exact reviewed website commit is sufficient:
require a clean tracked tree and restrict the incoming diff to the pointer and
documentation (and inert test/authoring scripts when reviewed). This avoids the general website pipeline's unrelated Composer,
database backup, cache purge and media-ownership steps. If application code,
schema or website assets change, use the normal website pipeline instead.

## Build and verify

1. Run `npm test`, `npm run test:ascua`, browser/Studio and boundary tests.
2. `npm run build` emits `.local/build/releases/ID` and `current.json`.
   `tools/artifact.cjs` validates every path, checksum and all six routes.
3. Install into DDEV with `npm run install:local`; test the actual static mount
   and optional API. The local installer refuses a target without DDEV config.
4. Review/commit/push the **public game repository from its own cwd**. Never
   resolve a public push refspec against the private website repository.

## Install, then activate

`tools/install-release.cjs` is the same verified installer used locally. Its
explicit `--stage-only` mode installs one complete immutable directory without
touching the current pointer. It refuses unexpected files, invalid hashes and
symlink targets. A failed stage preserves the installed release and pointer.
Verified release directories are set to 0755 and public files to 0644: the
static web server need not run as the PHP/release owner. This also avoids
`mkdtemp`'s private 0700 directory surviving the atomic rename. No source or
private-directory permissions are changed.

Transfer the reviewed artifact and a Node bundle of this installer to a scoped
temporary directory on the host. Do not copy source masters or Studio into a
public directory. Run it as the website owner:

On macOS, create the transfer archive with `COPYFILE_DISABLE=1 tar
--no-xattrs --no-mac-metadata`. Finder/AppleDouble files are not game assets and
the allowlisted installer correctly rejects an archive that contains them.

```sh
node install-release.cjs /absolute/staging/ID /absolute/website --stage-only
```

The website tracks **only** `public/game/current.json`, not `releases/` binaries.
After the corresponding ID is staged and checked, deploy its reviewed pointer,
static mount and API through the website's normal main-branch pipeline. Never
activate a pointer whose directory is missing. Do not reset or build in somebody
else's dirty dev clone; DDEV is a valid isolated place for the website asset build.

`--activate` explicitly switches a standalone host's pointer by atomic rename;
the coordinated website deployment uses its tracked pointer instead.
Old releases are retained for open browsers and rollback. No recursive prune
is part of deployment. Browser and website service-worker caches do not own
the immutable game's lifecycle.

## Smoke and rollback

For shared forest, stage the artifact and apply reviewed/checksummed 4230/4231
migrations with the VPS migration runner **before activating the API and pointer**.
Keep its database backups. The cutover snapshot freezes old import candidates once.
Check both OpenAPI copies, identity lifecycle, CAS/retry tests and public DTOs.
Do not roll back a database over new player writes. A code/pointer rollback retains
additive tables and needs a conscious plan for newer saves; old clients cannot
spend or mint the new account via game-save.

- Confirm the remote website commit, selected ID and release checksum inventory.
- Fetch all six routes: exact static HTML, 200, no PHP warnings, correct hashed
  JS/CSS/manifest. Verify resource requests and walking in fresh desktop/mobile
  browser profiles without writing real identity, vote, chat or purchase data.
- Check normal home, stories, jokes and public API DTOs remain available.
- Record both commits, ID and checks in the release ledger.
- Use `node scripts/check-release-live.cjs ORIGIN RELEASE_DIRECTORY` for the
  read-only public smoke. With Cloudflare JavaScript Detections, verify the
  origin HTML separately byte-for-byte; the public smoke permits only its one
  final security-script insertion and blocks even its challenge POSTs. Do not
  disable production protection to satisfy a byte comparison.
- Keep the previous website commit and previous game release. Rollback is a
  reviewed revert of the pointer/API deployment, pushed and deployed normally;
  for the first extraction the old commit restores the old PHP-mounted game.
  Never erase an existing game save, database or media volume to roll back code.

Game materials/setines now have separate server authority. Local private snapshots
remain untrusted and cannot mint construction resources. Do not connect game currency
to website reputation, paid goods or competitive rewards without a separate review.

## Game / website boundary

Current game/website ownership. Deployment evidence: [RELEASE.md](RELEASE.md).

### Ownership

| Public game repository | Private website repository |
| --- | --- |
| Static HTML shell, six locales, engine, scenes, rules, rendering, audio UI, native activities | Public content queries, content pulse, publication rules, identity, authorization, rating accounting, guardian service |
| Original modular art, offline compilers, Studio and regression tests | Normal website, full forms/editors, account, checkout and admin |
| Local-first save, device ID, private progress, shared construction UI | JSON API under `/api/world/`; private profiles/authoritative materials/public objects; static artifact mount |

The game is served at `/bosque/explorar` and five translated routes, below the website's `/bosque` landing. The home page does
not change. The game’s shell does not run the website bootstrap, database,
session or views. PHP/GD in this public repo are **offline authoring/build
tools**, not a game runtime dependency.

### What was removed

The private website's editable engine, scenes, sprite packs, game Studio,
adventure views, view-capture interceptors and game build steps have been
retired. The `/api/world/content` HTML-fragment endpoint is gone. Website
modules no longer carry `MagikitosWorld` navigation branches or `world:mount`
listeners. A normal website view can no longer be captured into the game.

The game neither parses website HTML nor loads website CSS, Font Awesome,
global/social bundles, cart code, audio-player code or recording editors.
Activity DOM is created locally from whitelisted JSON fields using text nodes.

### Runtime

1. The public game build emits six static pages and content-addressed assets.
2. The host serves one reviewed immutable release under `/game/releases/ID/`.
3. The browser starts the local world and lazily loads sprite packs.
4. Optional JSON calls enrich physical gatherings with published content.
5. Explicit actions use existing website services through the documented API.

The Node preview can run with `--offline`: no website, PHP server or database
is needed to walk, interact, cook, travel, save progress or edit scenes.
API failure affects the requested community activity, not the world.

### Integration contract

See [API contract](API.md) and [OpenAPI](world-api.openapi.json).
Identity is shared by the documented session token, not by importing website
JavaScript. Browser storage works across the game and website when hosted on
the **same origin**. Separate preview ports deliberately have isolated storage.

The existing pulse selector still supplies six-item discovery batches and its
exploration slots. The game performs no analytics collection, play-count writes,
movement streaming. Bounded game snapshots use the separate private save API,
not analytics/events. See [save protocol](API.md#save-protocol-and-server-authority).

Offline progress is local and untrusted. Spendable construction materials and game
setines have their own server-authoritative account. Website reputation, content
ratings and real-money checkout remain separate. See [authority](API.md#save-protocol-and-server-authority).

Full reading, printing, purchasing, recording, account management and other full
editing open explicit normal-website links in a new tab. They are not hidden
modals or embedded pages. Expressions are not exposed in the game; the broader API retains website services
without requiring game scenes for them.

### Release boundary

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

### Verification

`npm test`, `npm run test:browser`, `npm run test:native`,
`npm run test:api:local` and `npm run test:boundary` cover this contract.
Protected writes are mocked in browser tests: no user accounts, rating records,
paid guardian calls or orders are created by them.

## The live forest in production

Decisions that still hold from the shared-forest rollout (18/19 September 2026):

- `bosque-vivo.service` (systemd, `User=magikitos`, `LimitNOFILE=65535` because the box's
  ulimit is 1024, `MemoryMax=512M` because there is no swap, `Restart=always`) listens on
  `127.0.0.1:47850`. No firewall port is ever opened; it leaves through the site's 443.
- The WebSocket enters at `wss://magikitos.com/bosque`. Since 2026-09-19 that mapping is a
  rewrite in the website's tracked `public/.htaccess`, applied only to requests carrying
  `Upgrade: websocket` on the exact path, because `/bosque` is also the game's landing page.
  Never add a vhost `ProxyPass /bosque`: it swallows the landing and the game page. Virtualmin
  regenerates `/etc/httpd/conf/httpd.conf`; nothing of ours lives there.
- Cloudflare drops an idle WebSocket around 100 s: the heartbeat every 30 s in both directions
  is not optional. The protocol version changes only when the wire format changes, so a
  release never kicks every connected client.
- The deploy script restarts the daemon after `git reset --hard`; the restart is ordered
  (stop accepting, flush dirty positions, tell clients "back in a second", exit). Seats and the
  queue are rebuilt; personal progress and the persistent world are untouched.
- Community media directories are symlinks to the Hetzner volume: a tracked file inside a
  linked directory turns the link into a real directory on the next `git reset --hard`. Keep
  runtime files out of git (`git rm --cached`, `.gitignore`) before linking.
- A release that changes what the website validates (contract, schema, sidecar protocol) ships
  in ONE website commit with the pointer, after the migration has been applied: the window in
  which PHP and artifact disagree must be zero. Migrations are additive and may stay on a rollback.

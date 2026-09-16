# Shared forest — release record

Explicit owner authorization: finish, test and publish. Deployed and verified
16 September 2026 at <https://magikitos.com/aventura> and all five translated routes.

## Scope

Immutable artifact: `5edee0b7c4ff56a83a81` (391 allowlisted files).
Game runtime commit: `c64cb68a99f0e36e16babe8bcd86fd06953c5418`.
Website/API runtime commit: `07b00cf01eaf105c31eb76e2f282f71abcbd1bd8`.
Release manifest SHA-256:
`464a4cddb355724aac03411bb6be3bec0fbbf13057bb738b7f48f86ac322e202`.
Later documentation/test-only commits do not change these runtime bytes.

[Shared forest](SHARED-FOREST.md): five cats and clothed hip-up carry; knife/meal/
old-oar progression; bowl/seed adventure with movable cover; enlarged river
regions and visible channel-following currents; seven construction families in
two shared clearings; bounded NPC activities; authoritative materials and
heritage; map-only zoom; no live rolling; continuous Studio scaling. Existing
100-NPC collection, art catalogue, stories/jokes and normal website retained.

## Reproducible checks

- Full game/art suite, real-terrain JS/PHP placement parity and durable outbox.
- Local backend: 29 authority/security + 13 concurrency/restore/identity + 17
  private-save + 15 real HTTP/auth checks.
- Chrome desktop/tablet/mobile: cat capture/carry/drop/reload, hedge pot push/
  reset/bowl/seeds, shared building via real API, pinch isolation, rowing/boost/
  currents/seams/seven landings. Picnic in five viewports. Main browser suite
  includes seven viewports, six locales, doors/interiors, recipe and Studio.
- Studio uses disposable test workspaces, including 137% scale persistence;
  the owner's real workspace/diffs are preserved.
- Static DDEV shell + API/website boundary + flat art contract. No network writes
  in the release smoke. Real Safari/physical-device certification is not claimed.

## Safety and data

Additive 4230/4231 migrations only. Freeze old import candidates; future client
saves cannot mint the authoritative account. Both schemas and media remain in the
private website. No production database downloaded, no real user progress reset,
no analytics events added. Previous private home layouts remain private archives.

Persistent examples use only reserved, clearly labelled accounts
`bosque-ejemplo-lila`, `bosque-ejemplo-corcho`, `bosque-ejemplo-musgo`. The seeder
refuses mismatched identities, uses the actual HTTP action/build/save API and
revokes its temporary sessions. It never claims existing people played a game.

## Deployment and production verification

1. Both repositories committed/pushed from their own working directories. Clean
   macOS artifact archive and bundled installer transferred to a scoped temporary
   directory; hashes checked on host. Stage-only install validated all files and
   left the preceding pointer active.
2. Standard VPS runner applied 4230 then 4231, each after a full database backup.
   4231 froze the one pre-existing active profile without replacing it. Checksums:
   - 4230: `398e76a558c33fbc8cb49aa77c3957f1c1d631a3131dcc3d306e4f2d4502f23a`.
   - 4231: `468341df32475857a7b0c67f4169b3b12244d14199a7b4c33bf21e78a733008d`.
3. Normal website deployment took another backup, verified Composer lock without
   dependency changes, activated API/pointer, cleared page cache and purged the
   CDN. The unrelated dirty development checkout was not touched.
4. All six direct HTTPS origin responses matched the artifact byte-for-byte.
   Public edge responses matched application HTML with only Cloudflare's own
   security insertion. JS/CSS/manifest/contract hashes passed; normal website,
   flat art and six-language API passed. Static-mount and unavailable-artifact
   isolated tests passed on the VPS without exposing PHP filesystem paths.
5. Public Chrome at 1440×900, 768×1024 and 390×844 passed walking, rowing,
   community landing, lazy assets and no overflow. Separate public cat tests
   passed real capture/carry input lock/drop/grace/reload at all three sizes.
   These browser tests blocked every non-GET/HEAD request; the general smoke
   blocked nine injected Cloudflare security POSTs as well.
6. Explicit production API fixtures completed recipes/rewards/navigation,
   collected resources, placed nine objects and saved three labelled games.
   A second run left exactly three live objects per example and nine construction
   history entries: no duplicate placements or meal rewards. Each still has ten
   game setines and its boat. Temporary sessions were revoked. Public API and
   three viewport screenshots verified all nine objects rendering in the world.
7. DDEV runs the same immutable ID. Studio restarted on port 47832 with current
   gallery/scale controls; owner workspace revision 76 is conflict-free.

Retained backups (all passed `gzip -t`):

| Purpose | Private-host path | Bytes |
| --- | --- | ---: |
| Before 4230 | `/var/backups/migrations/magikitos/20260916T012419Z__4230_shared_forest.sql.gz` | 196000806 |
| Before 4231 | `/var/backups/migrations/magikitos/20260916T012527Z__4231_game_account_cutover.sql.gz` | 196004607 |
| Before activation | `/var/backups/deploys/magikitos/20260916T012726Z__32264dde15734dfdb3470e8f7e29313f4cabbdb7.sql.gz` | 196006213 |

Local visual evidence is under `.local/production-shared-forest/`,
`.local/cat-review/`, `.local/hedge-review/` and `.local/river-review/`.
Those test screenshots are not shipped as game assets.

## Recovery and limits

Retain the preceding artifact `2757a9112b5f30945023` and website commit
`32264dde15734dfdb3470e8f7e29313f4cabbdb7`. Prefer forward correction; never restore
an old database over new player writes. Foreign dismantling is intentionally
disabled. API checks are authoritative for resources, permissions and geometry,
not proof of physical movement or a competitive anti-bot system. The future
mill/mechanical progression, social arbitration and unrestricted building are
not represented as already shipped.

## Art provenance

Built-in image generation produced the new cats, carry poses and wooden-oar
updates. Authorized local cutouts retain their unmodified originals. Exact
prompts/references: `data/aventura/art/cats/catalog.json` and
`data/aventura/art/river/catalog.json`; source/cutout subdirectories hold the
masters. Only reviewed, reduced 2× modular packs enter the public artifact.

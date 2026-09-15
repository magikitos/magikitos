# Releasing the independent game

Development commands never deploy. A release needs explicit owner authorization,
reviewed commits in both repositories when the API changes, and an immutable artifact.
No database import or account-balance migration is needed for Ascua.

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

- Confirm the remote website commit, selected ID and release checksum inventory.
- Fetch all six routes: exact static HTML, 200, no PHP warnings, correct hashed
  JS/CSS/manifest. Verify resource requests and walking in fresh desktop/mobile
  browser profiles without writing real identity, vote, chat or purchase data.
- Check normal home, stories, jokes, shop and public API DTOs remain available.
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

The local test wallet is untrusted browser state. Do not connect it to account
reputation or paid goods without a separate server-authoritative design.

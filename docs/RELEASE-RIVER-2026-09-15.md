# Bottle river and kelihouses — production release

Explicitly authorized by the owner: “manda a produccion todo esto”.
Activated 15 September 2026 at approximately 21:00 UTC, at
<https://magikitos.com/aventura> and all five translated routes.

## Immutable release

- Artifact: `2757a9112b5f30945023` (same bytes as local DDEV).
- Game runtime commit: `9ea533e4bb4f32a8a5f0aee3eadf63ee1ffe23c0`.
- Website/API runtime commit: `9a655bb83a4871cfdb3f60cd418641ed11dd9eb8`.
- Release manifest SHA-256:
  `99741a0ae8e8d21e9e3324e53128a260cca0027d8c7d935dd9ff61aade28987b`.
- Previous retained artifact: `fe26c8158651ab28d10c`.
- Previous website runtime: `44d2342bc7762227b494583df07d07626dfda874`.
- Later documentation-only commits do not change these runtime bytes.

## Included

Bottle crafting, nostalgic Remo, northwest picnic/bin, renewable materials,
playable rowing and currents through five reaches, the island detour, editable
home exterior/interior, public snapshots and neighbour jetties. Existing skewer,
setin rewards, 100 NPCs, flat colouring catalogue and normal website preserved.
Studio gains the authored scenes, asset families and navigation review overlay;
Studio itself is not served in production.

Private website owns authentication, schema and all five game endpoints. Saving
publishes the bounded layout, never inventory or private progress. Browser saves
remain local-first; account merges preserve displaced profiles for recovery.
No game analytics or real reputation/financial economy introduced.

## Safe deployment order

1. Full game suite reproduced the exact artifact. Local persistence: 20 tests;
   real local HTTP/auth: 15; river: 63; parcel validator: 34 plus JS/PHP parity.
   River browser tests and the read-only release smoke passed desktop, tablet,
   mobile. The independent/offline website boundary suite passed too.
2. Both main branches pushed **from their own repositories**.
3. Clean macOS archive and bundled immutable installer transferred to a scoped
   temporary directory. Every installed file/path/hash verified as website owner
   with `--stage-only`; the old active pointer remained unchanged.
4. Additive private migration `4229_game_profiles.sql` applied by the established
   VPS runner **before** API activation. Checksum:
   `34c9f45c177cd39cb55e1a4841600cdc4f1577bcf3413363e001f29a6041eb37`.
   Pre-migration backup: 20:57:16 UTC, 195,885,855 bytes; retained on the private
   host. No content import, rewrite, profile reset or other migration.
5. Normal website deployment activated the API and tracked pointer together.
   Its second backup (20:59:26 UTC, 195,887,439 bytes) preceded activation;
   Composer lock preflight passed, no dependencies changed, page cache cleared
   and Cloudflare purge succeeded. The dirty VPS development clone was untouched.

## Production verification

- Six actual HTTPS origin responses match the artifact HTML byte-for-byte.
- Public edge responses have identical application markup, allowing only the
  established Cloudflare security-script insertion.
- Public JS, CSS, asset manifest and `game-contract.json` match their hashes.
- Six-language bootstrap, content discovery, flat art and normal home/stories/
  jokes/shop work. Public parcel DTOs are allowlisted; unauthenticated private
  reads and wrong-method calls are rejected with JSON and no-store headers.
- Real Chrome at 1440×900, 768×1024 and 390×844: walking, lazy rowing assets,
  actual boat movement, landing and opening the home editor; no JS errors,
  failed release assets or horizontal page overflow.
- Static mount and isolated missing/unreadable-artifact checks pass on the VPS.
  The installed contract loads correctly in production PHP.
- Live smoke blocks every non-GET/HEAD request (including injected security
  POSTs). It does **not** create production accounts, votes, parcels or saves.
  Successful save/restore/merge transactions were exercised in local DDEV,
  not claimed as production fixture writes.

## Recovery

Keep old releases for open clients and recovery. Prefer a small forward fix;
if rollback is necessary, review website API and client together. A pointer-only
rollback to the pre-river release is not sufficient for the new API: that older
artifact has no `game-contract.json`. Preserve migration 4229, user data and
the profile lifecycle protections. Do not blindly restore the pre-release DB
(it would discard subsequent user changes) or use a panel rollback that couples
code rollback to a DB restore. Backups are emergency recovery material, not the
default way to revert a UI defect.

Normal development commands still never deploy. Further feature ideas are only
[a proposal](NEXT-CHAPTER-PROPOSAL.md), not included in this release. The wallet
remains client-authored and unsuitable for competitive/transferable value.

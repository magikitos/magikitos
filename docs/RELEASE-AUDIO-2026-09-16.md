# Welcome, fullscreen and sound — verified production release

Published on 16 September 2026 at <https://magikitos.com/aventura> and its five
translated routes with the owner's explicit authorization. Native app delivery
remains a separate task; no store build or submission was triggered.

## Identity and history

- GitHub CLI: **`gh-personal`**, authenticated as **`alvarofranz`**.
- Git transport: personal SSH alias `github.com-alvarofranz`; server handshake
  identifies `alvarofranz`. No plain `gh` / work account used for this release.
- Both local repositories now explicitly configure author and committer as
  `Alvaro Franz <110778959+alvarofranz@users.noreply.github.com>`.
- The 16 game-development commits incorrectly carrying the work email were
  consolidated, together with the reviewed uncommitted audio/native preparation,
  into **`9298174d7e96fbe214893ae9207756fcbc74d4b1`**. Its tree was verified equal
  to the pre-squash snapshot. The founding lore commit
  `ce13ac20b4045e87345ba576b93b950c112ca000` and its original author were preserved.
- This was an explicitly authorized, exact-lease-protected rewrite of game
  `main`, not a rewrite of website history. GitHub's commit API confirms
  `alvarofranz` as both author and committer of the new game and website commits.
- Later verification/documentation commits use the same personal identity and
  do not change the published runtime. Operational rules live in both `AGENTS.md`.

Local recovery material (not pushed):

```text
.local/history/before-personal-squash-20260916.bundle
refs/backup/pre-personal-squash-20260916
refs/backup/audio-before-personal-squash-20260916
```

The complete bundle was verified before rewriting. It retains the old history
ending at `23c5a1c7beeee08a411662e3d3a78c18a33d4a7b`; the second recovery ref also
retains the prepared working-tree snapshot. Other old game clones must reconcile
their history deliberately, preserving any local work; do not blindly merge the
retired history back into `main`. The website does not need this reconciliation.

## Deployed artifact

- ID: **`04c689f5c4a7b20aab65`**, 397 allowlisted files, six HTML entry points.
- Manifest SHA-256:
  `20ef1d4ad1d34f4e0b9e038ff3b0c4d72dc68a0b001b5cb83c63c245f77fb031`.
- Website activation commit: **`4b098e8fb94ce5d43e56017dc719989cea224f74`**.
- Previous artifact retained: `49cef729900e43397250`.
- Previous website commit retained: `bdb1629c817eefbb4fe7c5b606e0209f1dc85527`.

Includes the welcome gesture, document-wide enter-only fullscreen control,
four streaming music tracks with crossfades, lazy river ambience, complete game
audio silence during narrated content, persistent mute and foreground recovery.
See [the implementation guide](AUDIO-AND-ENTRY.md).

The archive and bundled installer were SHA-256 checked after transfer. The
installer verified every asset and staged the immutable directory as the website
owner without changing the active pointer. Activation then used an exact-commit,
clean-tracked-tree, fast-forward-only update whose diff was limited to the game
pointer and identity instructions. No reset, database/migration/import/seed,
media replacement, save reset, broad cache purge or unrelated dev-clone changes.
Old releases remain available for open clients and a forward-pointer rollback.

## Verification

- Full `npm test` passed again before deployment. Existing browser, Studio,
  adaptive input and controls checks are recorded in the implementation guide.
- Origin responses for all six routes matched artifact HTML **byte for byte**.
- Public-edge HTML matched the application exactly, allowing only Cloudflare's
  existing security-script insertion. JS, CSS, art manifest and contract hashes
  matched. Public flat-art/shared-world DTOs, protected API responses and normal
  home/stories/jokes/shop pages passed.
- Live forest movement, rowing, two-thumb controls, automatic landing, lazy art
  and no overflow passed at desktop, tablet and mobile viewport sizes.
- **Real public audio/fullscreen suite passed at 1440×900, 768×1024, 390×844 and
  844×390**: no MP3 requests before entry; actual audio signal; successive-track
  crossfade; actual narration-element playback silencing the game buses; app
  foreground recovery; root fullscreen and enter-only button; mute persistence.
  River audio loads lazily and remains mixed beneath music. No page exceptions.
- MP3 delivery supports `audio/mpeg`, immutable caching and valid HTTP Range 206.
- Public browser tests allow only GET/HEAD requests and block external/write
  requests. No identity, vote, purchase, world or save writes were sent. The
  general smoke additionally recorded nine blocked Cloudflare security POSTs.
- DDEV and production use the same artifact. Studio revision 78 and the existing
  hundred-NPC art library, saves and shared objects remain intact.

This is automated Chrome testing, **not** physical Safari/iOS/Android certification.
The narration fixture exercises the actual playback/mixer path without replacing
or modifying any community recording. npm dependency audits of both packages
reported zero known advisories in the preceding local verification; the old
esbuild development-server advisory is resolved by the pinned upgrade.

Evidence remains local in `.local/release-audio-core.log`,
`.local/release-audio-local.log`, `.local/release-audio-origin.log`,
`.local/release-audio-live.log` and `.local/release-audio-public-sound.log`.

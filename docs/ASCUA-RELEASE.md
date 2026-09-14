# Ascua release — implementation and verification ledger

Status: implemented and locally verified; production activation pending. The owner's 14 September 2026 follow-up selects Ascua and
authorizes integration, Git push and production deployment after verification.
This supersedes earlier local-only delivery restrictions for this release, not
the separation between the normal website, game, Studio and local game wallet.

## Required outcome

- [x] Ascua protagonist; all eleven other approved duendes available in the cast.
- [x] Compact, reusable authored action repertoire, including directional effort
  while pushing, reusable item discovery/manipulation and a future bow module.
  No separate cooking/cutting/fishing/map/slingshot pose catalogue.
- [x] 2× integrated texture preparation throughout the runtime and Studio, with
  logical size, foot anchors, crops, collision and picking independent of density.
- [x] Restrained, selective vegetation motion, stable roots, long rests, varied
  phase; retain the picnic's authored gestures and reduced-motion behavior.
- [x] Slower pushing and an effort expression; hungry neighbor no longer crying.
- [x] Wider starting stream with a coherent, walkable bridge and dry banks.
- [x] Slightly smaller mushrooms, Taramundi knife and lighter.
- [x] Pick the whole mushroom; tools prepare the skewer at the barbecue; show
  item overhead using one character pose plus independent object artwork.
- [x] Contextual barbecue guidance for every ingredient/fire state, one useful
  hint at a time, no contradictory or unreachable ingredient instructions.
- [x] Exact requested Spanish replacements, consistent cheeky Andalusian tone
  across authored dialogue; corresponding natural updates in all six locales.
- [x] Designed setin: wood branch slice, golden rim, red painted face, white
  mushroom; reusable artwork in wallet, rewards and world feedback.
- [x] Fountain action costs one local setin only with funds, toss animation,
  small visible coins retained inside the fountain; no quest or real balance.
- [x] Existing controls, saves, needs, ferry fares, five-hour repeat meals,
  public content/API separation, responsive gameplay and Studio edits preserved.
- [x] Current design/architecture/art prompts/operations documentation; retire
  superseded active contracts and unused runtime resources without losing masters.
- [x] Unit, integration and browser/visual verification at desktop/tablet/mobile,
  reduced motion, reload/interruption, lazy resources and bounded caches.
- [ ] Audit both dirty repositories and release boundary, exclude private/local
  material from public Git; exact reviewed commits pushed, reproducible artifact.
- [ ] Verified production deployment and rollback reference, six game routes and
  normal website/API smoke checks. No database import or unrelated website changes.

## Evidence

No implementation or deployment requirement is complete merely because it appears
in this ledger. Record actual commands, artifacts, checks and remote revisions as
they are verified. Existing Studio workspace is user data, never auto-applied.

### Local release candidate · 14 September 2026

- Artifact `4dd7398237af6fd39953`: 619 frames, 73 packages,
  2,971,504 bytes total PNG library; 2× physical texture / logical-size contract.
- Full `npm test` passes, including 118 navigation routes, 33,088 dry standing
  points, all 64 barbecue state combinations, atomic fountain and 30/60/120 Hz push.
- `check-ascua-browser`: desktop 1440×900, tablet 768×1024, mobile 390×844,
  each normal/reduced motion; touch+keyboard, overhead pickup, visible preparation,
  funds/disabled action, travel lock, reload and pre-commit interruption.
- General browser regression: seven viewports through 2560×1440, six languages,
  five interiors, doors from both sides, relocated entry/exit, stairs, ferry,
  isolated Studio crop/collision/autosave/diff. Picnic recipe passes five viewports.
- Native activities: stories/jokes/expressions/art/shop in five viewports; public
  local content and links, no embedded website runtime or tracking.
- API: 168 local contract reads/rejected writes; boundary proof/identity/guardian/
  vote success paths mocked, no accounts, payments or paid LLM calls created.
- Studio: duende and definition archives pass six viewports, gallery five;
  restored historical scale metadata declares density explicitly. One workspace.
  Its empty revision 66 was automatically rebased by the existing Studio loader
  to revision 67; revision 66 is retained in history, no placement/crop edits lost.
  Current workspace SHA256: `d82ee9a5975c22e61dac043d4e0c800e72639ad071a92666f23c26a884c25df3`.
- 16 scene/device screenshots reviewed, plus cooking and coin-toss captures.
  Diagnostic readback tests explicitly choose one Canvas backend: Chrome's
  GPU→CPU readback transition otherwise changes nearest-neighbor sample ties.
  The game does not perform those readbacks and its picnic animation is intact.
- Cold loopback measurement: ready 423 ms at CPU1 / 798 ms at simulated CPU4;
  2.34–2.41 MB scene-resource transfer, 28 cached terrain chunks. Largest startup
  long task 348 ms at CPU4. These are local measurements, not 4G/device/battery
  guarantees; physical Safari/iOS testing remains a release-monitoring task.
- Website compiled in isolated DDEV, all existing build guards pass, source hash
  `1a19306c380677e208ef1b9b4a8d3eea`, asset version `ef964039`.
  Three pre-existing Taramundi AVIF decode warnings do not concern the game.
  Compiler-only image derivative changes were backed up and restored, not shipped.
- Website service-worker syntax and game bypass regression now tested explicitly.
- Immutable installation tested: stage-only, checksum failure, idempotence,
  explicit atomic activation and unchanged pointer on failure.
- Exact local DDEV release smoke passes all six static page byte comparisons,
  hashed resources, public API, normal website and three browser sizes with zero
  write requests. Production directory is staged/verified but **not activated**.

### Recovery before activation

Previous website/main production revision:
`322daabe17615a8c4e5b18381919eac347817bc2` (tracked worktree clean).
Previous public game revision: `95a6eb9627a9b1e380f8f5521f779f569a3fdd46`.
This is the first static-artifact deployment: the old website commit restores
its old PHP-mounted game. Do not remove old assets or user browser saves.
The unrelated dirty VPS dev clone was not changed or used for compilation.

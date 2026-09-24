# Magikitos game: repository identity and release safety

- This is the PUBLIC game repository `magikitos/magikitos`. The private website
  lives next door in `../magikitos`; never push from the other repository's cwd.
- For GitHub operations use **`gh-personal`**, authenticated as **`alvarofranz`**.
  Plain `gh` / `gh-work` belong to the work account and must not be used here.
  In a non-interactive shell, the equivalent is the real `gh` executable with
  `GH_CONFIG_DIR` explicitly pointing to the owner's `.config/gh-personal`.
- Before committing, check `git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT`.
  Use `Alvaro Franz <110778959+alvarofranz@users.noreply.github.com>` for both.
  Configure identity locally, not globally. Never use the work email.
- The personal remote is `git@github.com-alvarofranz:magikitos/magikitos.git`.
  Verify GitHub CLI and SSH identity independently; authenticating correctly
  does not automatically fix Git commit attribution.
- Preserve local edits and Studio state. Fetch/check divergence; do not reset
  working trees to synchronize them. History rewrites require explicit owner
  permission, a recoverable backup, and an exact `--force-with-lease` check.
- Deployment requires explicit owner authorization. Follow `docs/RELEASING.md`:
  verify and stage an immutable artifact before activating the website pointer.
  Never copy private backend code, credentials, or Studio state into this repo
  or into the public artifact. Native/store delivery is separate from web delivery.
- Clean up after yourself, and only after yourself. Browser checks launch Google Chrome, which on
  macOS copies itself into `…/X/com.google.Chrome.code_sign_clone/` on every launch and leaves the
  copy behind if the process dies. Builds leave ~90 MB artifacts in `.local/build/releases`, and
  checks leave `magikitos-*` folders in the system temp dir. `tools/clean-local.cjs` removes exactly
  those (Chrome copies no process holds open, test temp older than a day, old builds except the
  published one and the three newest). It runs after `npm test`, after every build and when a
  check that uses `scripts/browser-entry.cjs` exits; run `npm run clean` after anything else that
  launched Chrome. Never delete anything else on the owner's machine.

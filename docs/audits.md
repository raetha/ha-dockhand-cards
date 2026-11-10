# Audits

Quality, security and housekeeping reviews of the cards, their tooling and CI. Repeat before a
release when asked, and whenever the owner asks for a full review; record each one below, newest
first.

## Checklist for a full review

1. **Open pull requests**, Dependabot's especially
   (`gh api "repos/raetha/ha-dockhand-cards/pulls?state=open"`; sessions have the REST API, not
   GraphQL, so `gh pr list` fails). For each: read the diff; check its CI passed
   (`gh api repos/raetha/ha-dockhand-cards/commits/<sha>/check-runs`); for a GitHub Action, check
   the pinned commit is the tag it claims
   (`git ls-remote https://github.com/<owner>/<action> refs/tags/<tag>`); for an npm package, its
   release notes. Squash-merge good ones into `dev`
   (`gh api -X PUT repos/raetha/ha-dockhand-cards/pulls/<n>/merge -f merge_method=squash`), never
   into `main`. Record any held back, and why.
2. **Security alerts.** Sessions can't read the repository's code scanning, Dependabot or secret
   scanning alerts (403): ask the owner for their titles, and run the checks here: `npm audit`,
   and CodeQL (the bundle from `github/codeql-action` releases;
   `codeql database create --build-mode=none` over a copy of the tracked files only, then
   `database analyze` with the `javascript-security-and-quality` and `actions-security-and-quality`
   suites).
3. **Tests and build:** `npm run verify`; `scripts/screenshot-harness/a11y.py` (no violations).
4. **Quality bar:** every item in `docs/quality.md` still true of the code.
5. **Security of the design:** the cards only read Home Assistant state (never Dockhand's API);
   nothing a card renders is inserted as raw HTML; links built from entity data (release notes,
   configuration URLs) are safe to open.
6. **Workflows:** `contents: read` at the top, write only on the jobs that release or push;
   actions pinned to commit SHAs; no `${{ }}` expansions inside `run:` scripts; no secrets used on
   pull requests.
7. **Leftovers:** finished experiments, backward compatibility nobody needs (see
   `docs/backlog.md`'s 2.0.0 items), unused code, stale comments and docs (`CLAUDE.md`,
   `docs/development.md`, the README).
8. **Record it:** a dated section below, and changelog lines for anything users notice.

## 2026-11-09: full review before testing 2.0.0

- Dependabot's four pull requests (#55–#58: d3-shape, rollup, @rollup/plugin-terser, jsdom 31)
  applied together in #63 and closed. jsdom 31 needs Node 22.22+/24.15+; CI uses Node 24.
- Tests now drive every card and editor control (#64); the coverage floor rose from about 72% to
  about 98% of lines.
- `npm audit --omit=dev`: nothing. The deepmerge alert is in the build only
  (`@rollup/plugin-node-resolve`), still with no fixed release. CodeQL (JavaScript/TypeScript,
  Actions): no findings. Every action pin matches its tag and is the latest release. The build's
  `"this" has been rewritten` warnings come from `@formatjs/intl-utils` (via
  custom-card-helpers) and are harmless.
- `a11y.py`: no violations in either theme. The harness's copied language files are now
  gitignored like the card files.
- Home Assistant 2026.11 frontend changes (removed `ha-md-list`, `ha-radio`, `mwc-progress-bar`;
  `ha-button` sizes): none used here.
- `docs/quality.md` claimed `setConfig` throws and that no render tests exist; both corrected.
  History comments rewritten to say why across the cards; a comment still described `ha-button`
  on the Updates card, which uses header icons. `docs/architecture.md` rewritten afterwards
  (about 1,090 lines to 440): the same rules and reasons, without the development history, and two
  stale claims fixed (Updates is in the Overview's section-default map; embedded editors do get
  later `hass` updates).

## 2026-11-02: moved to the dev/main workflow

- `ci.yml` and `release.yml` replaced by one `build.yml` (changelog check, `npm run verify`, HACS
  validation; releases created by CI from `main`; test builds from `dev`; sync-dev). Actions
  pinned to commit SHAs, verified against their tags with `git ls-remote`. `hacs/action` was on
  `@main`; now pinned to 22.5.0.
- Dependabot targets `dev`, weekly for npm (was daily).
- The six open Dependabot pull requests (#32–#37) targeted `main` and each rewrote the lockfile,
  so their updates were applied together in one pull request into `dev` (taking the newest
  release in each range), and the six were closed.
- `npm audit` found 14 advisories, all in build tooling. Fixed: minimatch (forced to 11 with an
  override; eslint and typescript-eslint still ask for 10), serialize-javascript (lockfile
  refresh); undici via Dependabot's pull request. Left: deepmerge (low, pulled in by
  `@rollup/plugin-node-resolve`; no fixed deepmerge release exists yet). The `nanoid` override was
  no longer needed and is gone.

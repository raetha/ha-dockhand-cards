# Developing Dockhand Cards

The canonical guide for working on this repo. How the cards work and why is in [architecture.md](architecture.md); the quality bar is [quality.md](quality.md); ideas already considered and set aside are in [backlog.md](backlog.md); reviews are recorded in [audits.md](audits.md).

## Layout

| Path | What it is |
| --- | --- |
| `src/index.ts`, `src/editors.ts` | Entry points of the two bundles: the cards, and their editors |
| `src/dockhand-*-card/` | One folder per card: `card.ts`, `editor.ts`, `types.ts`, styles, tests |
| `src/common/` | Shared code: entity and device resolution, formatting, translations, styles |
| `scripts/release.mjs` | Changelog check, release notes and test-build versions, used by CI |
| `scripts/screenshot-harness/` | Renders the built cards against mock data: README screenshots and the accessibility check |
| `docs/` | This guide, architecture, quality checklist, editor design, styling reference, backlog, audits |
| `.github/workflows/build.yml` | All of CI: checks, releases, test builds (see "What CI does") |

`dist/` is built, never committed: releases attach the built files (see "Branches and releases"). The Marketplace (HA 2026.11+, HACS built in: same catalog, same `hacs.json`) and HACS install a plugin from the release asset named by `hacs.json`'s `filename` (falling back to the repo tree only when no release has that asset), and download every asset of the release into the same folder (`www/community/ha-dockhand-cards/`), which is where the card bundle loads the editor bundle from. Both bundles carry their own copy of shared code: a shared chunk would load twice, since the resource URL carries a cache-busting version query (`?hacstag=` under HACS, `?v=` in the Marketplace; see `rollup.config.mjs`).

Each non-English language is a third kind of file, `ha-dockhand-cards-i18n-<lang>.js`, built from `src/i18n/<lang>.ts` (one Rollup entry per file there, except `en.ts`) and loaded at runtime by both bundles (`common/i18n-loader.ts`): English is built into the bundles. The card bundle holds back defining its elements (a top-level `await`, at most 1.5 s) until the page's language has loaded, so cards don't draw in English first. Releases attach every `dist/*.js`. A new language is a new file in `src/i18n/`, added to `LANGUAGES` in the loader and to `src/test-setup.ts`.

## One-time setup

Node 24 (what CI uses), then:

```bash
npm ci
```

Use `npm ci`, not `npm install`, for setup: it installs exactly what `package-lock.json` pins and fails loudly if the lockfile and `package.json` disagree, instead of quietly working around it. `npm install` is only for deliberately adding, removing or bumping a dependency, since it's the command that rewrites the lockfile. If you suspect the committed lockfile has drifted (say `npm audit` reports something CI doesn't), regenerate it on purpose with `rm -rf node_modules package-lock.json && npm install`, check `npm audit` is clean, and commit it.

`package-lock.json` is committed on purpose: this is an application with a build step, not a published npm package, so the lockfile is what makes a clone reproducible.

## Everyday loop

```bash
npm run watch    # rebuilds dist/ on every save
npm run verify   # typecheck + lint + test (with its coverage floor) + build + audit of shipped dependencies: what CI runs
```

The individual steps (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`) also run on their own. Everyday tasks are `package.json` scripts; `scripts/` holds the release helper CI uses and the screenshot harness.

Before changing entity resolution, editor components, CSS or container-query patterns, or the card-picker preview, read [architecture.md](architecture.md). Before opening a pull request, go through [quality.md](quality.md).

### Testing against a real Home Assistant

`npm run watch` keeps `dist/ha-dockhand-cards.js` current. Point a Lovelace resource at it: with HA in a container and this repo bind-mounted, add a resource for wherever `dist/` ends up under `<config>/www/`; otherwise copy (or symlink once) `dist/ha-dockhand-cards.js` into `<config>/www/`. Hard-refresh the browser after each rebuild: Home Assistant caches Lovelace resources aggressively.

The other way to try a change on a real install is the test build every push to `dev` publishes (see "Test builds").

### Screenshots and the icon list

See `scripts/screenshot-harness/README.md`. It renders the real built bundle against fictional mock data in a headless browser, with no Home Assistant involved. It's also where to regenerate `icon-paths.json` after adding a new `mdi:` icon anywhere in the cards, or the icon renders blank in screenshots.

## Dependencies

Dependabot proposes updates weekly into `dev` (`.github/dependabot.yml`), for npm and for the GitHub Actions, which are pinned to full commit SHAs with the version in a comment.

**Don't bump `typescript` past 6.x yet.** `typescript-eslint` can't run against TypeScript 7 (a hard crash, not a warning; typescript-eslint#10940). `package.json`'s `^6.0.3` can't reach 7.x and Dependabot ignores `typescript >=7.0.0`; remove that ignore once typescript-eslint supports TS 7.

**`overrides` in `package.json`** force a newer version of a dependency's dependency when the package that pulls it in hasn't moved yet. Remove each once that package catches up:

- `minimatch` `^11.0.1`: eslint, `@eslint/config-array` and typescript-eslint still ask for minimatch 10, which has a denial-of-service advisory fixed only in 11. Linting gives identical results with 11. Remove once eslint and typescript-eslint depend on minimatch 11 (`npm ls minimatch` shows no "overridden").

Advisories in build tooling don't fail `npm run verify` (it audits only what ships in the bundles); CI's report-only `npm audit` step shows them as a warning, and Dependabot's security updates open pull requests for the ones with a fix.

## Translations

Home Assistant's translation system only covers backend strings (an integration's `strings.json`); it has no channel for a Lovelace card's own text. So this repo bundles its own dictionaries, looked up from `hass.language` at render time: every language in `src/i18n/<lang>.ts`, each with a `card` and an `editor` part: English (`en.ts`) built into the bundles (the card bundle takes its `card` strings, the editor bundle its `editor` strings), every other language built into its own file and loaded on demand (see "Layout" for how). The locales match ha-dockhand's (de, es, fr, it, nb, nl, pl, pt, sv, zh-Hans), machine-translated the same way, using ha-dockhand's own terms where it has one.

- **No hard-coded user-visible English** in a card or editor: use `t(hass, key, { placeholders })`.
- **State words** (`running`, `healthy`, `synced`, schedule types, event actions…) go through `stateLabel()` in `src/common/state-label.ts`. Pass the entity when the word is its state, so Home Assistant's own translation from ha-dockhand is used when there is one.
- **Numbers, sizes, percentages and times** go through `src/common/format.ts`.
- **Add a new string to every locale in the same pass.** `src/common/i18n.test.ts` fails on a missing or empty string, or a `{placeholder}` that doesn't match English.

## Accessibility and colors

`scripts/screenshot-harness/a11y.py` runs axe-core's WCAG 2.1 A/AA rules over every card and editor in both themes. Run it after any change to a card's markup or colors; it exits non-zero on any violation.

- **Interactive things use `renderIcon()` or the `.row-target` pattern**, so they get `tabindex`, `role="button"`, Enter/Space handling and a visible focus ring. Never nest clickable elements.
- **Use Home Assistant's theme colors unchanged** (`--success-color`, `--primary-color`, …), so the cards match the rest of HA; a user who needs more contrast picks a theme for it. `a11y.py` excuses text in HA's default colors for that reason. Colored text uses the `--dockhand-*-text-color` properties so a theme can tune words separately from icons.
- **Prefer HA's colors, keeping Dockhand's meaning.** Map Dockhand's status and severity colors onto HA's status colors rather than copying Dockhand's palette. Dockhand colors with no HA equivalent (connection types, charts, disk usage, labels) keep Dockhand's defaults.
- **The repo's own colors must pass.** Text in a color that isn't HA's gets a readable version, mixed toward `--primary-text-color` (see `getLabelColors()`).
- **No color without a custom property.** Every color comes from a CSS custom property (HA's own where one fits, otherwise a `--dockhand-*` one with a default), set in CSS, never as a literal in a template or TypeScript, so a theme or card_mod can change it. List each new one in [styling.md](styling.md).

## Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/). Every change adds a line under `## [Unreleased]`, written for people installing the cards:

- Describe the net user-facing difference, not the development journey. A bug introduced and fixed within the same unreleased cycle gets no entry.
- Changes with no user-facing effect (dependency updates, test or build tooling, the screenshot harness) get a short line under `### Internal` saying what changed and why.
- One line per paragraph or list item, in every Markdown file: the renderer wraps it. GitHub's release pages turn each line break into a visible one. CI checks it (`python3 scripts/markdown.py --check`; without `--check` it joins the lines; the same script as ha-dockhand's).
- Open with a summary: a few sentences under the version heading, before the first `###` section, saying why the release matters (its aims or highlights) and what to do before upgrading if anything is breaking. Rewrite it as the release takes shape; a small release may need only a sentence.
- Released sections are frozen: never rewrite them; CI compares them with `main`'s. (Older ones use an em dash before the date; the tooling reads both.)
- A reusable technical gotcha belongs in [architecture.md](architecture.md), not the changelog; [backlog.md](backlog.md) is only for what isn't done.

Each released section is also the GitHub release's notes, which HACS shows, so write it as what a user should read on the Releases page.

## Versioning

Semantic versioning. The canonical policy is ha-dockhand's [`docs/semver.md`](https://github.com/raetha/ha-dockhand/blob/main/docs/semver.md); what follows is only what's specific to the cards.

**`dev` holds the expected next version.** When the first change after a release lands on `dev`, `package.json` (and `package-lock.json`'s two copies: `npm version X.Y.Z --no-git-tag-version`) moves to the version that change calls for; a later change that calls for more raises it. Test builds carry it, and release reviews re-check it. The changelog stays `[Unreleased]` until the release pull request dates it.

- **Major:** renaming a card's `type`, removing a card, renaming or removing a YAML config key *without* a working backward-compatible fallback, or dropping support for an entity or attribute shape a released version reads. A rename *with* a verified, unconditional fallback (the old key keeps working indefinitely and the editor migrates configs to the new key on load) is minor. Removing such a fallback later is major, and has a fixed time: **a setting replaced during major version N keeps working through N and is dropped in N+1.0**, with a Breaking changelog line saying what changes and how to fix the card. So 2.0.0 dropped everything replaced in 1.x (`environment_overrides`/`environment_order`, `title`, the list cards' `device_id` and Updates' `scope`), and what 2.x replaces (Schedules' `include_global`, the Vulnerability card's `device_id`) goes in 3.0.0. Until then the editor converts it, and a fallback's code says the version that replaced it, so the next major's removals are easy to find.
- **Minor:** a new card, a new optional config key or editor field, new locale coverage. Also when picking up an ha-dockhand `translation_key` rename (which shows up here as entities silently no longer resolving, not a compile error): call out the ha-dockhand version needed in the changelog.
- **Patch:** bug fixes, cosmetic fixes with no behavior change, translation fill-ins, docs.

Small breaking changes wait for the planned 2.0.0 rather than forcing a major release on their own.

## Branches and releases

| Branch | What goes there | What a push does |
| --- | --- | --- |
| `main` | Releases only: one squash-merged pull request per release. Never pushed to directly. | Releases the version if it has no tag yet; deletes test builds; resets `dev` (sync-dev). |
| `dev` | Adopted work, and Dependabot's updates. `[Unreleased]` is kept current here. | Publishes a test build. |
| `try/<topic>` | Experiments that may be dropped. Branched from `dev`. | Nothing by itself: open a (draft) pull request into `dev` to run CI. |

Adopted `try/` work is squash-merged into `dev`; ideas dropped for good get a line in [backlog.md](backlog.md).

Day to day:

1. Claude runs `dev`: small, safe changes are committed to it directly; anything else goes on a `try/<topic>` branch with a pull request into `dev`, which Claude squash-merges once CI is green. Either way the `[Unreleased]` line comes with the change and `npm run verify` passes.
2. The owner installs the test build from the Marketplace to try it on a real dashboard.
3. `dev` stays releasable: a change that needs the owner's decision first waits on its `try/` branch (a draft pull request) until they've seen it.

Releasing (the owner decides when):

1. Open a release pull request from `dev` into `main` titled "Dockhand Cards X.Y.Z". In it: rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` with a fresh empty `## [Unreleased]` above, update the compare links at the bottom of `CHANGELOG.md`, and check `package.json`'s version is still the right one for what's in the release. The body is the new changelog section.
2. Squash-merge it. CI tags `X.Y.Z` (no leading "v": HACS shows tag names; releases up to 1.5.1 are tagged `vX.Y.Z`), publishes the release with the built files attached and the changelog section as notes, deletes the test builds, and resets `dev` to `main`.

Nothing else is needed: no tags pushed by hand, no version scripts. The release is created by CI, so a version is released exactly once, when its tag doesn't exist yet. CI refuses a pull request into `main` whose version has no dated changelog section, so an undated release can't merge (a merge into `main` that releases nothing needs `dev` back on the released version).

### What CI does

`.github/workflows/build.yml`, on every push and pull request:

- `node scripts/release.mjs check`: `CHANGELOG.md` has `[Unreleased]`; for pull requests into `main` and pushes to `main`, also a dated section for `package.json`'s version.
- `npm run verify`: typecheck, lint, tests, build, and `npm audit --omit=dev` (the dependencies that end up in the bundles).
- `npm audit` over everything, report only: advisories in build and lint tooling often have no fix for a while, so they show as a warning rather than failing every run.
- HACS validation (`hacs/action`, category plugin).

- `CI passed`: a gate job that passes only when every check above did. It's the one status check the `main` ruleset requires, so jobs can change without touching the ruleset.

Then, on a push to `main`, the release and sync-dev jobs; on a push to `dev`, the test build. Every checkout uses `persist-credentials: false` except sync-dev's, the one job that pushes with git, so the workflow token isn't left on disk for dependencies' scripts or tests to read.

### Test builds

Every push to `dev` publishes a GitHub pre-release with the built files, tagged `<expected next version>-dev.<run>` (for example `2.0.0-dev.43` while `dev` holds 2.0.0; right after a release, before `dev` moves on, `<next patch>-dev.<run>`), so it sorts above the installed release. Its notes are the `[Unreleased]` section, and the cards' console banner shows the test build's version. Older test builds are deleted, so there's only ever one.

To install one: turn on pre-releases for Dockhand Cards from its **⋮** menu in the Marketplace, or with the **Pre-release** switch entity the Marketplace (or HACS) adds for each repository, disabled by default (enable it under Settings → Entities); it then offers the test build as an update. To go back, turn pre-releases off and redownload the latest release (⋮ → Redownload).

### Repository settings

The owner sets these (sessions can't read most of them):

- **Settings → Rules → Rulesets:** one for `main` (target: the default branch), **enforcement Active**: restrict deletions, block force pushes, require a pull request before merging with squash as the only allowed method. No required approvals. **Require status checks:** `CI passed`. **Require code scanning results:** CodeQL.
- **Settings → General → Pull Requests:** squash merging only; **Automatically delete head branches** on.
- **Settings → Branches:** a classic branch protection rule for `dev`: nothing required, deletions not allowed (so auto-delete never removes `dev` after a release pull request), **force pushes allowed** (sync-dev). A classic rule rather than a ruleset, since a ruleset's "Restrict deletions" has been reported not to stop auto-delete.
- The default branch stays `main`.

## Audits

A "full review" follows the checklist at the top of [audits.md](audits.md), and is recorded there.

## Licensing

MIT (`LICENSE`).

# Notes for Claude sessions

Dockhand Cards: Lovelace cards (Lit 3, TypeScript 5 strict, Rollup 4, vitest) for the
[ha-dockhand](https://github.com/raetha/ha-dockhand) Home Assistant integration, installed through
HACS as a Dashboard (plugin) repository. Real users install it, so changes to config keys or
behavior need care. The canonical guide is `docs/development.md`; how the cards work and why is
`docs/architecture.md`; the release checklist is `docs/quality.md`; ideas already evaluated and set
aside are in `docs/backlog.md`. Read the guide, and the relevant part of the architecture doc,
before changing anything. This file is the short version.

## How we work

- **Branches** (`docs/development.md` → "Branches and releases"): never push to `main`; it gets one
  squash-merged pull request per release, which the owner merges. Claude runs `dev`: small, safe
  changes go straight to it, anything else through a `try/<topic>` branch and pull request that
  Claude squash-merges once CI is green. `dev` must stay releasable; a change that needs the
  owner's decision waits on its `try/` branch. No zip packages.
- Every change adds a line under `## [Unreleased]` in `CHANGELOG.md`, written for people installing
  the cards (`docs/development.md` → "Changelog"; non-user-facing changes under `### Internal`).
  Released sections are frozen.
- **Never bump a version or date the changelog unless the owner asks.** That's the release pull
  request (`dev` → `main`): it sets `package.json`'s version and dates the section; CI then tags,
  publishes the release, and resets `dev` to `main`.
- Each push to `dev` publishes a test build (`v<next patch>-dev.<run>` pre-release) that the owner
  installs through HACS's Pre-release switch to test on a real dashboard.
- The cards and ha-dockhand are tightly coupled: when fixing a card problem, consider whether the
  integration should change too, and fix the same bug everywhere it occurs.
- Push back when a requested change looks like a lot of complexity for little gain, or out of step
  with the project's goals; the owner sometimes explores an idea to see whether it makes sense.

## Validate

- `npm ci` once, then `npm run verify` (typecheck, lint, tests, build, audit of shipped
  dependencies): what CI runs. Batch related edits and verify once; prose-only changes need no test run.
- After markup or color changes, `scripts/screenshot-harness/a11y.py` (axe-core, both themes).
- For geometry or layout claims, measure (DOM sizes, path data) rather than trusting a look at a
  screenshot; when the owner reports something different from what a screenshot seemed to show,
  believe the report and re-check numerically.

## Hard-won facts (details in docs/architecture.md)

- Cards never call Dockhand's API: they only read `hass.states`, `hass.entities` and
  `hass.devices`. Entities resolve by `platform: "dockhand"` + `translation_key`, scoped to a
  device; devices are found by identifier patterns that must match ha-dockhand's `helpers.py`
  exactly (`env_<id>`, `container_<env_id>_<name>`, `stack_<env_id>_<name>`).
- `translation_key` is a cross-repo contract (`src/common/const.ts`): renaming one in ha-dockhand
  breaks the cards silently; adding one is free.
- Every Dockhand instance numbers its first environment `1`, so a bare env_id never identifies an
  environment: device lookups must also require the same config entry (`sameConfigEntry` in
  `src/common/device-utils.ts`, §19). Label an *instance* by its devices' `configuration_url` host
  (`getInstanceLabel()`, §20).
- "Would show more with X enabled" hints belong in the visual editor, not the live card, except
  when a core sensor or device is missing entirely (`.core-message`).
- Colors: HA's theme colors unchanged, Dockhand's meaning mapped onto them, every color a CSS
  custom property listed in `docs/styling.md` (`docs/development.md` → "Accessibility and colors").
- Don't bump `typescript` to 7.x until typescript-eslint supports it (typescript-eslint#10940);
  Dependabot ignores it until then.
- Sessions can't read Actions settings, secrets or security alerts through the proxy: ask the
  owner. A "full review" follows the checklist at the top of `docs/audits.md`.
- HACS not showing the cards' icon in its store panel is an upstream HACS bug
  (hacs/integration#5171, #5223): nothing to fix here.

# Changelog

<!--
Maintainer note: the rules for this file are in docs/development.md -> "Changelog". In short:
lines describe the net user-facing difference for people installing the cards, not the
development journey; released sections are frozen; non-user-facing changes go in an
Internal section. Each released section is also the GitHub release's notes (CI publishes it),
and [Unreleased] is the notes of the current test build.
-->

## [Unreleased]

### Added
- **A Dockhand dashboard** — pick **Dockhand** under Community dashboards when adding a dashboard
  for an overview of every environment, with updates, vulnerabilities and schedules beside them,
  and a page for each environment with all its cards (just that page when there's only one), that
  keeps up as environments come and go.
  Its settings choose the Dockhand instance, lay out the overview and the environment pages in up
  to four columns by dragging cards between them, and set the cards' own settings as in the
  Overview card. **Take control** turns it into a normal dashboard.
- **Filters on the list cards** — a **Filters** section in the Stacks, Containers, Updates and
  Schedules editors. Pick one or more values per filter, or flip it to **is not**; set several
  and a row has to pass them all. Containers: state (exited cleanly or with an error), health,
  stack (or not in one), update kind and tags. Stacks: status, type, updates, Git sync and tags.
  Updates: update kind, stack and tags. Schedules: type, last result, enabled, Dockhand's own or
  yours, and where (an environment or global). A filtered card says when nothing matches and how
  many rows its filters hide. Works in the Overview card's sections too.

- **Dockhand tags** as coloured pills, as in Dockhand's own lists: on Stacks and Containers card
  rows (a new **Tags** detail, on by default) and under the Stack and Container cards' headers.
  Needs ha-dockhand 2.0.0 or later; earlier releases simply show none.
- **Controls on list rows** — a **Show controls** option, off by default, on the Stacks and
  Containers cards (start or stop, and restart while running, asking before stopping or
  restarting) and the Schedules card (**Run now**, which asks first, and enable/disable). They sit
  in their own column at the end of each row, so controls and values line up down the card.
  Schedule controls need ha-dockhand 2.0.0 or later.

### Changed
- **Updates card: Update all installs exactly the updates the card lists**, in one go (ha-dockhand
  runs them as one Dockhand job per environment). With filters set it becomes **Update listed**
  and leaves hidden updates alone. When nothing listed can be installed from Home Assistant (newer
  tags, pinned digests, held updates, system containers), the button stays but is disabled, and
  its tooltip says why. An environment with nothing pending no longer shows as an empty group.
- **Schedules card: Include global schedules is now the Where filter**, which can also show only
  global schedules. Configs with `include_global: false` keep leaving them out, and the editor
  rewrites them as that filter.

- **Smaller downloads: each language is its own file.** The cards and their editors now carry
  only English and load the dashboard's language from a small file beside them, so the card file
  is about 40% smaller (about 140 KB instead of 220 KB) and the editors' 75 KB instead of 130 KB.
  Marketplace and HACS installs get the language files automatically. **A manual install must copy
  every `.js` file from the release**, not just the two it used to; without them the cards show
  English.
- README: installing through Home Assistant's Marketplace (2026.11+), with HACS for older
  versions, and the Marketplace's resource path for YAML-managed dashboards.
- Versions show without a leading "v": HACS shows release tags, which from this release are plain
  version numbers (`2.0.0`, test builds such as `2.0.1-dev.42`), like most other HACS
  repositories. Earlier releases keep their `v` tags.

### Removed
- **Breaking: Home Assistant 2026.8 or later is required** (was 2026.6),
  matching the Dockhand integration 2.0. HACS and the Marketplace won't install
  this release on older versions; 1.5.1 keeps working there.

- **Breaking: the Overview card's old `environment_overrides` and `environment_order` keys** are
  no longer read. They were renamed `environments_overrides` and `environments_order` in 1.1.0,
  and the editor has rewritten them on every save since, so only an Overview card configured
  before 1.1.0 and never edited since is affected: rename the two keys in its YAML (add the
  missing "s"), or open and save it in the editor before updating.

### Fixed
- **Header buttons that can't be used** (such as an unavailable Dockhand
  link) are announced as unavailable by screen readers.
- **The Containers, Stacks and Environment cards' "nothing found yet" messages are translated**;
  they showed in English whatever the dashboard's language.
- **Stacks: a restarting stack** shows as restarting, with its own icon, instead of an unknown
  status.
- **Schedules card: the environment pill showed on every row by default**, though rows are
  grouped by environment and the editor showed the pill as off.
- **Schedules card: every Dockhand schedule type has a name in every language**, including
  container start and stop, backups, repository prune, check and verify, and stack deploy.

### Internal
- The Overview card passes every section setting on to the cards it builds, the way its editor
  already saved them, so new card options (like Show controls) work there without changes.
- The Environment card's section picker appears through Home Assistant's own form conditions.

- Dependencies: d3-shape 3.2.1; build and test tools rollup 4.67.5, @rollup/plugin-terser 1.0.2,
  jsdom 31.
- Tests render every card and editor against the screenshot harness's mock data and drive every
  control, and `npm test` checks a coverage floor (about 98% of lines, up from about 45%) that can
  only rise.
- Devices are matched to their Dockhand instance by `config_entry_id` alone (HA 2026.8+).
- Code comments and docs trimmed of development history (`docs/architecture.md` rewritten);
  `docs/quality.md` brought up to date.


## [1.5.1] - 2026-11-03

### Added

- **Vulnerabilities across environments** — the Vulnerability card chooses
  its environments like the list cards, from a list at the top of its
  editor. With more than one, their findings are added up, with a row per
  environment. The Dockhand dashboard's overview uses it instead of a card
  per environment. The Overview card and the dashboard choose its
  environment the same way. A card's old `device_id` keeps showing that
  environment and becomes the new setting with the next change in the
  editor.
- **Test builds.** Upcoming changes are now published as test builds (pre-releases such as
  `v1.5.1-dev.42`) that HACS can install once the Dockhand Cards **Pre-release** switch is turned
  on; the README's new "Test builds" section explains how, and how to go back.

### Changed

- The README's build badge works again: HACS shows the README of the latest release, whose badge
  pointed at a workflow that no longer exists and so showed as failing.

### Internal

- CI hardening: a single `CI passed` check gates releases, and no job keeps the workflow token on
  disk unless it pushes with git (`persist-credentials: false`).
- `dev` now carries the expected next version, so test builds are numbered as the release they lead
  to; CI only requires a dated changelog section for pull requests into `main`.
- New development workflow: work lands on a `dev` branch and each release is one pull request into
  `main`, after which CI tags and publishes the release itself (no more pushing tags by hand).
  Every push to `dev` publishes a test build as a GitHub pre-release, which HACS offers once the
  repository's Pre-release switch is on. Dependabot now proposes updates weekly into `dev`, and the
  workflow's actions are pinned to commit SHAs. `npm run verify` now fails only on advisories in
  the dependencies that ship in the cards; advisories in build tooling show as a CI warning.
- Developer docs reorganised: `docs/development.md` is the guide (setup, translations,
  accessibility, changelog, versioning, branches and releases), `CONTRIBUTING.md` is a short entry
  point for contributors, the versioning notes moved into the guide, `docs/` file names are
  lowercase (`docs/styling.md` and friends), `tools/` is now `scripts/` (matching ha-dockhand),
  and `CLAUDE.md` and `docs/audits.md` were added.
  This file's older version headings now use Keep a Changelog's hyphen before the date.
- Build tooling security fixes: eslint and typescript-eslint are now given minimatch 11 (they still
  ask for 10, which has a denial-of-service advisory), and serialize-javascript is updated. The
  no-longer-needed nanoid override is removed. None of these ship in the cards.
- Dependency updates for build and test tooling: typescript-eslint 8.72.1, globals 17.14.0, jsdom
  30.1.3, home-assistant-js-websocket 9.8.1 (type definitions only), and undici 8.12.3, which fixes
  a high-severity advisory in the test environment. Then eslint 10.14.0, rollup 4.67.4,
  @rollup/plugin-typescript 12.3.1, vitest 5.1.0 and tslib 2.9.1.

## [1.5.0] - 2026-10-19

### Added

- **Newer version tags on the Updates, Containers and Stack cards** (ha-dockhand#39). When
  Dockhand finds a newer version tag for a container, one you move to by changing its image tag:
  - **Updates card:** a row whose only update is a newer tag gets a grey tag icon instead of the
    orange update icon, since there's nothing to install from Home Assistant. When the tag is
    waiting behind an update that can be installed now, the row shows it in a tag pill.
  - **Containers card:** the tag shows as a pill, like Dockhand's own containers list, just left of
    the update icon, or on its own when there's nothing to install. Clicking it opens the update
    dialog. It's part of the existing **updates** row detail.
  - **Stack card:** a container pill whose only update is a newer tag gets the grey tag icon
    instead of the orange update arrow, matching the Updates card.

  The pill is in the update icon's color on a light tint of it, like the Vulnerability card's
  severity boxes, and hovering it shows the same details Dockhand's own badge does: the version to
  move to, how big a jump it is (major, minor or patch), and how many versions ahead it is.

  Needs ha-dockhand 1.11.0 or later; with older versions these cards look the same as before.
- **Digest-pinned images whose tag has moved on, and updates held by the minimum image age**, on
  the Updates, Containers and Stack cards, shown the way Dockhand's own containers list shows
  them:
  - **Pinned to a digest:** a container pinned as `image:tag@sha256:…` whose tag now points to a
    new image gets an orange pin. The update is changing the pin in its compose file, so there's
    nothing to install; the Updates card row says "Pinned to a digest".
  - **Held:** an update Dockhand is holding until the new image reaches its minimum image age gets
    a grey clock, and the Updates card lists it with the hours left ("At next check" once the wait
    is over). It counts in the Updates card's header, so the card shows something is coming.

  Hover the pin or clock for the details. The Container card's header uses the same icons. Needs
  ha-dockhand 1.11.0 (with Dockhand 1.0.54 for pinned digests, 1.0.52 for held updates); with
  older versions nothing changes.
- **Stack card: CPU, memory, network and disk I/O**, laid out the same way as on the Container
  card, from Dockhand's own stack totals (ha-dockhand 1.11.0 with Dockhand 1.0.52 or later, and
  ha-dockhand's **Enable container and stack stats** option on). Like Dockhand's Stacks page, memory shows as
  usage over limit rather than a percentage. Two new `visible_sections` entries, `metrics` and `io`,
  can be turned off in the editor and are on by default; without those sensors the card looks the
  same as before. The editor also lists any of them you've disabled, like the Container card editor
  does.

### Fixed

- **Schedules card:** Dockhand 1.0.52's new scheduled state reports are labelled "State report"
  in every language instead of a raw "Env report".

### Internal

- Matching devices to their Dockhand instance now reads HA 2026.8's `config_entry_id` when it's
  there, falling back to the older `config_entries` list, which HA plans to drop from its device
  registry API in 2027.8. No visible change today.
- The screenshot harness's mock data now includes newer version tags (alone, and alongside an
  installable update), a digest-pinned image, a held update and stack stats, so the Updates,
  Containers and Stack card screenshots show them.
- One shared module (`src/common/update-kind.ts`) now decides how a container's update is shown —
  installable, newer tag only, pinned digest or held — for every card that marks one.
- The Container card's CPU/memory and network/disk sections moved to a shared module the Stack card
  uses too. No visible change to the Container card.

## [1.4.0] - 2026-10-13

### Added

- **Container and Stack cards: start/stop/restart buttons**, in a row under the status. They use
  the existing ha-dockhand running switch and restart button: start while stopped, stop and
  restart while running, with a confirmation before stop or restart. System containers (Dockhand
  itself, a Hawser agent) and stacks containing one don't get them. `show_controls: false` hides
  the row.
  The Stack card also gets its stack's Redeploy button (internal stacks) or Deploy / Sync from Git
  button (git stacks), with the same label and icon ha-dockhand gives it, and a confirmation.
- **Environment card: memory shows the total as well as the amount used**, e.g. "41.2% · 6.2 GB /
  15.0 GB", the same layout as the Container card.
- **Container and Stack cards: custom header icon.** A new optional `icon` option replaces the
  default header badge (`mdi:docker` for Container, `mdi:layers` for Stack).
- **Every color can now be changed by a theme or card_mod.** The Environment card's connection
  icon, event icons, CPU/memory charts, disk-usage chart and label pills had fixed colors; each now
  has a `--dockhand-*` custom property. The "Update all" button's text follows HA's
  `--text-primary-color`. All are listed in `docs/STYLING.md`.
- **All card text is now translated**, not just the editors: headings, labels, states (running,
  healthy, synced…), stats, tooltips, messages and the Overview/suggested card names, in the same
  languages as ha-dockhand (German, Spanish, French, Italian, Norwegian Bokmål, Dutch, Polish,
  Portuguese, Swedish, Simplified Chinese). Where ha-dockhand already translates a state, the card
  uses Home Assistant's own wording for it. Numbers, percentages and "5 min ago"-style times
  follow your Home Assistant language and number format.

### Changed

- **Memory readings fit narrow cards.** On the Container and Environment cards, memory now reads
  "8.1% · 41.5 MB / 512.0 MB" (was "8.1% (41.5 MB / 512.0 MB)"), and when the line is too narrow it
  drops the total, then the amount used, instead of cutting the text off. The percentage always
  shows, and the full reading is in the tooltip. (#22)
- **Vulnerability severities and Environment event icons now use Home Assistant's status
  colors**, so they match the rest of HA and follow your theme. Severities keep Dockhand's order:
  critical uses HA's error color, high a mix of error and warning, medium warning, low info.
  Events keep Dockhand's grouping: starts in success, stops in error, other changes in warning,
  health changes in info, anything else in the secondary text color.

### Fixed

- **CPU, memory and I/O on a stopped container no longer show "NaN" or a full green bar.**
  Readings with no current value are now hidden instead: the Container card shows just the
  state, and the Containers list drops that row's CPU/memory badges. The Environment card does
  the same when its environment's readings are unavailable. (#19)
- **Container card: memory and network/block I/O sizes are now correct.** They were shown about a
  million times too small (e.g. "343 B / 15.6 KB" for 343 MB of a 15.6 GB limit), because the
  card ignored the unit Home Assistant reports these sensors in. It now converts from whatever
  unit the sensor uses, including one you've chosen yourself in the entity settings. (#21)
- **Overview card editor: an environment's Updates settings save again.** Changing that
  environment's Updates name or "Hide when no updates" did nothing (an error in the browser
  console). The Updates section now uses the Updates card's own editor, like every other section.
- **Overview card editor: per-environment and section settings pick up Home Assistant changes
  while open**, such as a language change, instead of only when first opened.
- **The Vulnerability card no longer reports "No vulnerabilities found" when it has no data.**
  If fetching the scan results fails, or no scan has run yet, it now says the data isn't
  available.
- **Environment label pills are easier to read.** Their text met as little as 2.5:1 contrast in a
  light theme; it now meets WCAG AA (4.5:1) in HA's light and dark themes while keeping each
  label's Dockhand color. Hidden entries in the editors' lists also stay readable now (secondary
  text color rather than half-transparent).
- **The visual editor no longer risks loading an outdated version after an update.** Its file
  didn't carry HACS's version tag, so a browser could keep using the previous release's editor
  with the new cards until its cache expired. It now uses the same tag as the card file.
- **Manual install instructions now include the editor file.** They listed only
  `ha-dockhand-cards.js`, so a manual install had no visual editors. The README now lists both
  files and how to update them.
- **Paired rows no longer overlap on narrow cards.** The Container card's network/block I/O and the
  Environment card's image/stack/volume/network counts sit two to a line; on a card too narrow for
  that, their values ran into each other. They now drop to one per line when they don't fit.
- **Keyboard and screen-reader fixes:** list rows on the Containers and Stacks cards, and the
  Vulnerability card, no longer nest one button inside another (which screen readers announce
  confusingly); the CPU/memory history charts and disk-usage chart are skipped by screen readers,
  since the same values are shown as text beside them.
- **Updates card: "update-pending" no longer appears as a version.** When ha-dockhand knows an
  update exists but not its version, the card says "Update available".

### Internal

- **README rewritten to match ha-dockhand's**: the Dockhand logo centered above a "Dockhand Cards
  for Home Assistant" title, the same section order and separators, and plainer, user-focused
  wording (implementation detail moved out to the docs it was duplicating). The logo
  (`docs/brand/logo.png`) is a copy of ha-dockhand's `custom_components/dockhand/brand/logo.png`;
  update both together if it ever changes.
- **Automated test for the Updates card's busy buttons** (`card.dom.test.ts`): "Check for updates"
  and "Update all" show a spinner and are disabled while their request runs, ignore a second click,
  and recover after a failure. Previously only checked by hand. The same change stops a failed
  request from also logging an unhandled-rejection error (HA already shows the error toast).
- Updated `eslint` (10.11.0 → 10.12.0), `rollup` (4.63.4 → 4.64.5), `vitest` (5.0.1 → 5.0.4), and
  `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` (8.70.1 → 8.71.1, kept in
  step), plus a lockfile-only `npm audit fix` for advisories in `brace-expansion` and
  `source-map-js` (pulled in by eslint, jsdom and vite). All development-only; both built bundles
  are byte-identical before and after.
- **Tests run in plain Node by default instead of jsdom.** Creating a jsdom for every test file
  was ~90% of the test run time (about 20s → 7s now). Test files that render into the DOM opt
  back in with a `// @vitest-environment jsdom` line at the top; any new one needs the same line.
- **Screenshot harness mock data now matches what Home Assistant actually reports**: data-size
  sensors are in MiB (HA's converted state), not raw bytes, which is why #21 never showed up in
  screenshots; stats sensors are `unavailable` for a stopped container; and containers and stacks
  have their running switch, restart button and (stacks) deploy button. A stopped `backup`
  container was added to show #19's case.
- **Automated accessibility check** (`tools/screenshot-harness/a11y.py`): runs axe-core's WCAG 2.1
  A/AA rules over every card (plus states the screenshots don't show) and every editor, in both
  themes, and fails on any violation. It found the contrast and nested-button problems above. Text
  in Home Assistant's own theme colors is excused, since the cards use those unchanged on purpose.
  The harness now uses HA's real default primary and status colors, and the cards' fallback
  status colors (used only if a theme doesn't define them) now match HA's defaults too.
- **Translations are checked by test:** every locale must have every key, non-empty, with the same
  `{placeholders}` as English. State words go through one helper (`stateLabel`) that prefers Home
  Assistant's translation of an entity's state and falls back to this repo's own.

## [1.3.2] - 2026-09-24

### Changed

- **Environment names above each Overview card column are larger.** They're now one size above the
  card titles beneath them instead of smaller than them, so each column's environment is easy to
  pick out.
- **The Updates card's "Update all" and "Check for updates" buttons show a standard loading
  spinner while working,** instead of spinning their own icon.

### Fixed

- **The Environment card's pending update count now matches the Updates card.** It counted only
  updates that can be installed in bulk, so updates to Dockhand itself or a Hawser agent, and
  newer version tags that need the pinned tag changed, appeared on the Updates card but not in the
  Environment card's count. It now shows the full count, and hovering it breaks the number down by
  kind when there's more than one. Including newer version tags in the count needs ha-dockhand
  1.10.2 or later; older releases still show a count, just without those.
- **No more extra space under a section in the Overview card when some sections are turned
  off.** Each turned-off section still left a small gap in every column.

### Internal

- Updated `vitest` (4.1.11 → 5.0.1), `jsdom` (29.1.1 → 30.1.1), `globals` (17.7.0 → 17.12.0),
  `@types/d3-shape` (3.1.8 → 3.2.0), and `@typescript-eslint/parser` and
  `@typescript-eslint/eslint-plugin` (8.64 → 8.70.1, kept in step). All development-only; nothing
  in the shipped cards changes.

## [1.3.1] - 2026-09-22

### Added

- **Global schedules now show which Dockhand instance they belong to, once there's more than one.**
  With two or more Dockhand instances each contributing global schedules (see the global-schedules
  fix below), there was previously no way to tell from the Schedules card which instance a given
  row — or a failure — belonged to. Each such row now carries a small pill with that instance's
  host (e.g. `dockhand.example.com` or `192.168.1.50:3000`) — the same address you configured in
  Home Assistant to reach that Dockhand server, which every device already carries and can't
  collide across instances the way environment names or numbers can. Nothing to configure; the
  pill only appears once global schedules genuinely span more than one instance, and stays silent
  for the common single-instance case.

### Fixed

- **Containers, Stacks, and Schedules from two different Dockhand instances no longer merge
  together on the same card.** Every Dockhand instance numbers its own first environment `1`
  (second `2`, and so on) independently, so if you have more than one Dockhand hub connected to
  Home Assistant, their environments frequently share the same number. The cards' own
  environment-scoped lookups were matching on that number alone, so — even though each
  environment's devices were already correctly separated in Home Assistant's own device registry
  — a Containers, Stacks, Overview, Updates, or Schedules card would pull in devices from every
  instance whose environment happened to share a number with the one you'd selected, showing (for
  example) both NAS's containers under either one. Lookups now also confirm the devices came from
  the same config entry (the same physical Dockhand instance), which HA already tracks for every
  device regardless of how old or new it is, so this fix applies immediately with no
  reconfiguration needed. See `docs/ARCHITECTURE.md` §19 for anyone touching this code later — the
  numeric env_id alone was never a safe key for this and it's easy to accidentally reintroduce.
- **The Schedules card's "global schedules" now show up for every configured Dockhand instance,
  not just one.** Found while fixing the issue above — with two or more Dockhand instances that
  each have "Enable schedules" on and at least one genuinely global schedule (system cleanup,
  destination maintenance), only one instance's global schedules were ever showing, silently
  dropping the others rather than merging them incorrectly like the containers/stacks bug above.

### Internal

- Updated `custom-card-helpers` (1.9.0 → 2.0.0), `rollup` (4.62.2 → 4.63.4), `eslint` (10.8.0 →
  10.11.0), and `home-assistant-js-websocket` (9.6.0 → 9.7.0). Verified no source changes needed —
  `custom-card-helpers`' `HomeAssistant`/`fireEvent`/`LovelaceCard*` types are unchanged between
  1.9.0 and 2.0.0 (confirmed by diffing the published `.d.ts` files directly), and the full
  `npm run verify` suite (typecheck, lint, 205 tests, build, audit) passes clean against all four.
  **`typescript` (6.0.3 → 7.0.2) was deliberately left at 6.x**: TypeScript 7 is the new
  native-compiler release, and `@typescript-eslint` (still on 8.x as of this release) refuses to
  run against it outright ("typescript-eslint does not support TS 7.0" — see
  [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)
  for tracking). Revisit once that lands; bumping `typescript` alone in the meantime breaks
  `npm run lint` entirely.

## [1.3.0] - 2026-09-21

### Changed

- **Update badges in Stacks and Containers list cards now appear leftmost in each row's trailing
  badge group**, not after the always-visible badges (container count, CPU, memory). Update
  indicators are the least-frequently visible badge — placing them leftmost means they occupy
  otherwise-blank space when present, rather than pushing the always-present badges further from
  the row name they describe.
- **Overview card gains an "Align sections across columns" toggle** (config field
  `align_columns`, default `true`) that height-equalises matching section slots across
  side-by-side environment columns — so the Stacks card for one environment lines up with the
  Stacks card of the next, and so on. The outer `.overview` is a CSS Grid
  (`repeat(auto-fill, minmax(320px, 1fr))`); each `.env-column` is a flex column; after each
  render, JS measures each section slot across all columns in the same visual row and sets the
  tallest as `min-height` for every column in that row. Columns that appear alone in a row
  (e.g. a third environment wrapping to its own row on a narrow viewport, or any single-column
  mobile layout) are untouched, so narrow views never acquire dead whitespace. Set
  `align_columns: false` in YAML (or toggle off in the editor) for a more compact flex-wrap
  layout.

### Internal

- **Card and editor JavaScript are now two separate bundles** — `ha-dockhand-cards.js` (card
  runtime, ~29.7KB gzip) and `ha-dockhand-cards-editor.js` (editor UI, ~28.7KB gzip). The editor
  bundle loads lazily on first editor open via `import.meta.url`, so browsers that never open a
  card editor never download it. HACS downloads both assets automatically; no configuration change
  needed.
- **Card-runtime and editor-only translations are now split** — `i18n-card.ts` (9 keys: card-
  rendered tooltip text) and `i18n-editor.ts` (editor field labels, section headings, and mode
  hints). Previously both lived in a single `i18n.ts` shared by both bundles, which forced all
  editor translation strings into the card bundle even though cards never need them.

## [1.2.1] - 2026-08-31

Required for compatibility with ha-dockhand 1.9.1.

### Fixed

- **Compatibility with ha-dockhand 1.9.1** (issue #1). ha-dockhand 1.9.1 changes
  how device identifiers are formatted in the HA registry; this update teaches the
  cards to recognize both the old and new formats so everything resolves correctly
  after upgrading. No card configuration changes needed.
- **Environment card: environment name hover shape** was pill-shaped instead of the
  standard subtle rounded-rectangle used for rows and icon buttons, and the rounded
  corners clipped the first letter of the environment name. The hover footprint now
  matches the style used everywhere else.

## [1.2.0] - 2026-08-27

### Added

- **Stack and Container cards now support hiding individual sections** (Status, Containers, Git
  sync on Stack; State, Metrics, Network/disk I/O on Container), from the same Content section
  every other card's editor already has — every section shows by default. Matches the row-details
  checkbox pattern already used on the Stacks/Containers (plural) cards, not Environment card's own
  separate custom-mode picker — there's no mode to opt into here, just individual toggles.
- **This repository is now available in HACS's default catalog** — no longer needs to be added as
  a custom repository first.
- **New Dockhand Schedules Card.** Every schedule — container auto-updates, git stack syncs,
  environment update checks, image prunes, backups, and system jobs — for one environment,
  several, or all of them. Needs ha-dockhand 1.9.0+ to get the environment-scoped device grouping
  this relies on; on an older release everything still shows correctly, just as if every
  environment were included.
- **Schedules is available as an Overview column section**, right after Updates by default
  (defaults off — schedules-per-environment needs ha-dockhand 1.9.0+, so this doesn't suddenly add
  an empty section for anyone on an older release). Solo'd to each column's own environment
  automatically; global (no-environment) schedules are deliberately excluded from every column's
  card, since showing them in all of them would just repeat the same data.
- **A Name field, on every card, that can compose from Area/Device/Entity/Floor or be set to plain
  Custom text** — the exact same picker Home Assistant's own Tile/Area/Heading cards use for their
  own Name field (`selector: { entity_name: {} }`, a real native HA selector, not anything built or
  maintained in this repo). Replaces what used to be a plain `title` text field on every card.
  Leaving it unset keeps the same default every card already had (the device's own name for the
  single-environment cards; "Schedules"/"Updates" for the multi-environment ones) — nothing changes
  for a config that doesn't touch it.
- **The Stacks, Containers, and Updates cards now support multiple environments**, the same
  drag/exclude/solo "Environments" section every other multi-environment card in this repo uses,
  with `group_by`/`sort_by` added to Stacks and Containers, and `group_by` (None/Environment) added
  to Updates — defaulting to Environment, and hidden entirely when embedded in Overview (a fixed
  single-environment context there, where the only two choices produce the same result). A config
  already set to one environment (`device_id` on Stacks/Containers; `scope`/`device_id` on Updates,
  both real fields released in earlier versions) keeps working exactly as before, computed fresh
  each time rather than rewritten — the first time the Environments section is actually touched in
  the editor, it upgrades to the new fields from that point on.
- Every card's editor now follows the same two-part shape: a root section holding only "what is
  this card even of" (a device picker, or the Environments section for the multi-environment
  cards), and a single collapsed-by-default "Content" section for everything shaping how it's
  displayed — Name, the settings link, and whichever per-card display options apply. Matches the
  same root/Content split Home Assistant's own Tile/Area/Heading card editors use, including the
  native `expandable`/`grid` schema types those editors are built on (confirmed against HA
  frontend source; nothing hand-built here that HA already provides for free). Stacks/Containers/
  Schedules' own "which optional per-row details show" pickers (`visible_badges`) now live as
  checkboxes inside that same Content section, under a "Row details" heading, matching the
  established multi-choice-checkbox convention rather than several standalone toggles.
- **Environment card's disk-usage donut chart is a proper rounded-segment ring now**, matching
  Dockhand's own dashboard chart — a genuine constant-pixel gap between segments regardless of
  their own size, and rounded ends on every segment consistently, including the smallest one.
  Built on `d3-shape` (a new, small dependency; ~2KB gzipped), used for correctly rounding each
  segment's own corners across its two different radii.

### Changed

- **Updates card's "Check for updates" and "Update all" buttons now match the same padding,
  spacing, and visual language as every other header icon on these cards**, rather than using
  Home Assistant's own generic button component (which doesn't share those same conventions).
  "Check for updates" is icon-only, with hover/screen-reader text instead of a visible label — it's
  a non-destructive action sitting right next to the more prominent "Update all" button, so the
  extra label text was mostly just taking up space. "Update all" is noticeably smaller and more in
  proportion with the rest of the header than before, while keeping its own filled, accent-colored
  background so it still reads as the one prominent action in the group.
- **Pill text (a stack/container's own type, a custom environment label) is a size larger**,
  matching the same text size used everywhere else on these cards, while staying exactly as
  compact vertically as it was before.
- **`title` is `name` on every card that already existed in 1.1.0** (Environment, Vulnerability,
  Stack, Container, Stacks, Containers, Updates) — see the Name field entry above. An existing
  `title: "My Custom Title"` keeps showing exactly that text; nothing needs to be edited by hand.
- **Overview's own environment list is now the exact same shared, wrapped-panel component every
  other multi-environment card in this repo uses** (drag/exclude/solo, "Show all"/"Clear"), not
  its own separate hand-built implementation of the same row rendering — it gained "solo" and
  "Show all"/"Clear" in the process, which its old version never had. Its one genuine difference
  from every other card's own use of this component — a per-row pencil button opening the
  per-environment override view — is a small optional hook on the shared component now, available
  to any future card that needs the same thing.
- **Status colors (running/healthy/warning/error/etc.) now default to Home Assistant's own theme
  colors** (`--success-color`/`--warning-color`/`--error-color`/`--info-color`) rather than a fixed
  set of hex values — a theme changing HA's own colors now affects these cards without any
  dockhand-specific support needed. This repo's own `--dockhand-status-{ok,warn,error,info}-color`
  variables stay as the actual names used throughout the codebase and as card_mod/theme override
  points, each just defaulting to the matching HA color instead of its own hardcoded one.
- **Container card's state and health no longer nest one clickable element inside another.**
  Previously the whole state row was one focusable, clickable element with a second, independently
  focusable and clickable health icon nested inside it — confusing tab order and screen-reader
  behavior. Each is now its own, independent clickable element instead.
- **Stacks card's container-count badge no longer falls back to a status entity's own
  `container_count` attribute.** It now relies entirely on the dedicated containers-in-stack
  entity, matching the same reasoning as Environment's own "Top containers" change above — a
  recent-enough ha-dockhand release exposes this directly, and HACS-delivered updates mean most
  setups have had time to catch up.
- **Header icons now have a larger, easier-to-tap clickable area (32×32px) than the icon itself
  needs** — the icon stays the same visible size, just with more room around it to click or tap,
  a real accessibility improvement over the previous version, which had no padding around the icon
  at all.
- **Vulnerability card now shows the same "Environment offline" message Environment card already
  has**, instead of just dimming its own header icon. The dimming alone didn't clearly explain
  what was happening; a card's own header badge no longer changes appearance based on online
  status at all, on either card, now that there's a clearer message instead.
- **Stack and Container cards' own status/state text is now the same large, bold size as
  Vulnerability's own "total findings" count** — all three are a card's own single most important
  piece of information, now visually consistent with each other rather than two different sizes.

### Fixed

- **A card showing its own "please select a device" message (no device configured yet) no longer
  changes that card's own width.** Environment, Stack, Container, and Vulnerability previously
  `throw`ed from `setConfig()` in this case, which made Home Assistant replace the entire card with
  its own generic error display — a different element entirely, with no access to this repo's own
  sizing — instead of this repo's own, correctly-sized "please select a device" message.
- **Stack card's stack-type pill was reading the device's own model instead of the status entity's
  own "Type" attribute**, unlike the equivalent pill on the Stacks card — now reads the same
  attribute both places.
- **The Dockhand link icon in every card's header now shows the same subtle hover feedback (a
  faint background tint) every other clickable element on these cards already has** — it never had
  any hover styling of its own before.
- **The Dockhand link's hover text is now descriptive and consistent everywhere**, matching each
  card's own actual link target. Environment, Stack, and Container previously all shared one
  generic "Open in Dockhand" tooltip; Environment now reads "Edit environment in Dockhand" (its
  own link is a deep link straight to the environment's editor screen, not just a view), and
  Stack/Container read "View stack"/"View container", matching the wording the plural Stacks/
  Containers cards already used.
- **Every clickable header icon (the Dockhand link, feature toggles, update chips) is now
  keyboard-activatable, not just keyboard-focusable.** Pressing Tab already moved focus to these
  correctly; pressing Enter or Space on one, once focused, previously did nothing at all.
- **A clickable pill (Stack card's own container-name pills) no longer changes shape when
  keyboard-focused.** Tabbing to one used to visibly square off its own rounded corners; it now
  keeps its normal, pill-shaped outline like every other focused element already does.
- **Hovering a small clickable icon or pill no longer also highlights whatever it's sitting
  inside** (a whole list row, or — on the Vulnerability card — the entire card). Previously both
  lit up at once, making it unclear which one a click would actually activate; now only the
  specific thing under the cursor shows hover feedback.
- **Stack card's own container-name pills are now spaced 8px apart, matching every other pill
  pairing** — they were previously closer together (4px) than pills anywhere else in these cards.
- **The Vulnerability card's own name now reads "Environment — Vulnerabilities"**, matching the
  same pattern the Updates card already uses when scoped to a single environment, instead of
  showing just the bare environment name.

### Internal

- **New editor screenshot harness** (`tools/screenshot-harness/screenshot-editors.py`), companion
  to the existing card one. Needed a real `<ha-form>` shim to be worth anything — every editor's
  actual field content lives inside it, not the editor's own template — so `ha-shims.mjs` gained
  one (schema/data/label/helper/warning rendering for the select/boolean/text/multi_select/
  expandable/grid shapes this repo actually uses; deliberately non-interactive, since a screenshot
  doesn't need to be editable) plus a small `ha-icon-button` shim.
- Extracted the "open in Dockhand" settings-link icon — previously duplicated near-identically
  across 7 card files — into a shared `renderSettingsLink()` helper, used by all 7.
- Extracted the environment-selection resolution logic (opt-out subset, custom order, legacy
  single-device/scope compatibility) into shared functions in `src/common/environment-scope.ts` —
  `resolveIncludedOrdered()`, `resolveIncludedOrderedWithLegacy()`, `groupRowsByEnvironment()` —
  used by every multi-environment card instead of each maintaining its own copy.
- **The built `ha-dockhand-cards.js` was shipping every explanatory comment written inside a Lit
  `css` template literal, in every card, to every browser.** Terser (the build's minifier) can only
  strip real JS comments — a `/* ... */` written inside a tagged template literal is just string
  content to it, not a comment, so it was correctly leaving it alone. Fixed by adding
  `@lit-labs/rollup-plugin-minify-html-literals` (the official Lit tooling for exactly this), which
  strips comments/whitespace from `html` and `css` template contents specifically, before Terser
  ever sees them. ~26KB (~11%) off the built file's current size; scales with however many of
  these comments exist, so likely to matter more, not less, over time.
- Tests no longer print a "Lit is in dev mode" warning to stderr for every test file that
  (transitively) imports `lit` — harmless noise, not a real issue (confirmed against Lit's own
  maintainers' guidance for this exact situation), but not worth a mental double-take on every
  `npm test` run either. Suppressed via a new `src/test-setup.ts`, using the workaround Lit's own
  team documented (lit/lit#4877): pre-seed the warning as already-issued before `lit` is ever
  imported, so its own warn-once logic skips it.
- Consolidated a large amount of near-duplicate internal CSS and markup that had drifted apart
  across cards (pills, status badges, section headers, row layouts, clickable icons, and more)
  into shared definitions and a shared `renderIcon()` function, and switched spacing/sizing to
  track HA's own current design values automatically. Net effect: more visually consistent
  styling and behavior card-to-card (including full keyboard accessibility everywhere, see
  Fixed above), with no functional or configuration changes. This did involve renaming/merging
  some internal class names as part of consolidating them into shared definitions — anyone using
  `card_mod` to target a specific class should check it against `docs/STYLING.md`'s own "card_mod
  hooks" section (kept in sync with the actual, current class names) rather than assume an older
  class name from a previous release still applies. See `docs/ARCHITECTURE.md` §11/§18 for anyone
  interested in the fuller technical details.

## [1.1.0] - 2026-07-28

### Added

- **Overview card** editor gained two new layers of customization, both reached via icons next to
  each row in the editor: a global default per card type (display mode, which per-row details
  show, and link visibility, applied to every environment unless overridden) and a
  per-environment override of any of those same settings for one specific environment. Also new:
  show/hide icons for individual environments and for each card-type section.
- **Stacks and Containers list cards** can now show or hide individual per-row details (update
  badges, container count, CPU/memory, etc.) instead of always showing everything, and gained the
  same "Show link to open in Dockhand" toggle every other card already had.
- **Container card** now shows the image/tag and an "Update available" badge when one's pending.
  **Stack card**'s member container list now links each container through to its own status, and
  (with ha-dockhand 1.8.0+) shows container names.
- Every card's "open in Dockhand" link now shows a clear, explained icon if Home Assistant can't
  resolve a working link for it, instead of silently failing or looking identical to the link
  being turned off.

### Changed

- Editor controls across every card are more consistent with Home Assistant's own forms: dropdowns
  render compactly instead of sometimes expanding into a list, "pick several" fields use checkboxes
  instead of switches, hint text now scales with your HA accessibility text-size setting, and a
  missing-entity warning appears as a native alert next to the relevant field. Overview card's
  editor also reorganized its section/environment toggles to use the same show/hide and edit icons
  throughout.
- More editor text is translated, including per-mode help text (also shortened to focus on
  genuinely useful information, like a feature needing a specific sensor enabled) and each card's
  link tooltip.
- Two Overview card config keys were renamed for consistency (`environment_overrides`/
  `environment_order` → `environments_overrides`/`environments_order`). Existing configs keep
  working automatically — nothing to change.
- **Environment card** label pills now use Dockhand's own per-label colors instead of a plain
  neutral pill.

### Fixed

- **"Hide when no updates" (Updates card and Overview's own equivalent) could hide a card that
  genuinely had a pending update, if that update was on a system container or one only found by
  the optional precise-update-check feature.** Requires **ha-dockhand 1.8.2 or later** to fully
  fix; see that repo's own changelog. On an older ha-dockhand, behavior is unchanged from before.
- **All six cards' "open in Dockhand" links now validate consistently** — three previously showed
  a link that silently did nothing if Home Assistant's configured Dockhand URL had a subtle
  formatting problem (also fixed in ha-dockhand 1.8.2); the other three already handled this
  correctly.
- Fixed several small icon-alignment issues where an icon sat slightly off-center next to its text,
  across the Container, Stack, Overview, and Updates cards.
- The Container and Stack card editors' dropdowns now sort alphabetically, matching every other
  dropdown in these editors.

## [1.0.0] - 2026-07-21

Initial release.

### Added

Eight cards, all built on the same principles: zero manual entity configuration (pick a device
from a dropdown, the card resolves what it needs itself), no credentials of their own (read-only
against `hass.states`/`hass.entities`/`hass.devices`, same trust boundary as any Lovelace card),
graceful degradation (a disabled or missing entity means that value or section is simply left
out, never a broken layout), click-through to more-info on every entity-backed value — including
each individual stat where a card shows several (a container's health icon, CPU, and memory each
open their own entity, not just the container's overall state) — and icons via `<ha-state-icon>`
so a user's own icon customization is reflected automatically.

- **Dockhand Environment Card** — modeled directly on Dockhand's own dashboard tile, in five
  modes: Compact (name/online/counts), Standard (+ CPU/memory, health, resource counts, events),
  Detailed (+ top containers by CPU and recent events), Full (+ a disk usage breakdown and a
  15-minute CPU/memory history chart with a hover tooltip — matching Dockhand's own window and
  layout, verified directly against its source rather than assumed), and Custom (pick exactly
  which sections to show, independent of the four fixed combinations above).
- **Dockhand Vulnerability Card** — an environment's vulnerability scan summary (total findings,
  critical/high/medium/low breakdown, scan coverage), matching Dockhand's own severity colors.
- **Dockhand Stack Card** — a Compose stack's status, container count, pending updates, and (for
  git-tracked stacks) sync status, last sync time, and sync errors.
- **Dockhand Container Card** — a container's state, health, CPU/memory usage, and network/block
  I/O.
- **Dockhand Stacks Card** and **Dockhand Containers Card** — every stack/container in one
  environment, one compact row each. Auto-detected; nothing to configure beyond the environment.
- **Dockhand Updates Card** — every pending container update, scoped to one environment or all of
  them, with "Check for updates" and bulk "Update all" actions, and per-container more-info
  click-through for a targeted install. Optionally hides itself entirely when there's nothing
  pending (`hide_when_no_updates`) using Home Assistant's own native card visibility feature —
  genuinely gone, not just empty — while still showing normally while editing the dashboard, so
  there's always something to click on to configure it.
- **Dockhand Overview Card** — one card intended to fill an entire dashboard: every environment as
  its own column (sorted by name, manually reorderable in the editor), each stacking whichever of
  Environment/Vulnerability/Updates/Stacks/Containers you enable, in a drag-to-reorder sequence —
  so everything about one environment stays together. Defaults to environments only. Side-by-side
  columns collapse to one at a time, in order, on narrow screens. Its own per-environment Updates
  section can hide the same way (`updates_hide_when_no_updates`) — genuinely taking up no space
  when hidden, since it's a plain part of this card's own layout.
- Supports Home Assistant's resizable "sections" dashboard view (`getGridOptions`) as well as the
  classic masonry view (`getCardSize`).
- Every card supports Home Assistant 2026.6's entity-first card picker (`getEntitySuggestion`) —
  picking a relevant ha-dockhand entity offers the matching card as a suggestion.
- Editor labels are translated into the same 10 languages as ha-dockhand (German, Spanish, French,
  Italian, Norwegian Bokmål, Dutch, Polish, Portuguese, Swedish, Simplified Chinese), looked up
  from `hass.language`. Custom mode's section-checkbox labels specifically are English-only for
  now — see `docs/BACKLOG.md`.

[Unreleased]: https://github.com/raetha/ha-dockhand-cards/compare/v1.5.1...HEAD
[1.5.1]: https://github.com/raetha/ha-dockhand-cards/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/raetha/ha-dockhand-cards/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/raetha/ha-dockhand-cards/compare/v1.3.2...v1.4.0
[1.3.2]: https://github.com/raetha/ha-dockhand-cards/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/raetha/ha-dockhand-cards/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/raetha/ha-dockhand-cards/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/raetha/ha-dockhand-cards/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/raetha/ha-dockhand-cards/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/raetha/ha-dockhand-cards/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/raetha/ha-dockhand-cards/releases/tag/v1.0.0

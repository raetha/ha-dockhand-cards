# Changelog

<!--
Maintainer note: same discipline as ha-dockhand's CHANGELOG — entries describe
net user-facing functionality, not the development journey. Bugs found and
fixed within the same still-unreleased cycle don't get their own "Fixed"
entry — there's nothing to disclose about something that never shipped
broken. That history doesn't need to live anywhere long-term once the fix
has landed: the code (with a comment where the reasoning isn't obvious) and
git history are enough. The one exception is a genuinely reusable technical
gotcha — a pattern likely to bite again, not just "this had a bug" — which
belongs in docs/ARCHITECTURE.md. docs/BACKLOG.md is for what's not done yet only;
don't use it as a changelog substitute (this repo did, for a while — see the
top of that file).

This file's dated sections double as GitHub release notes: release.yml
extracts the section matching the pushed tag and uses it as the release
body verbatim, so there's no separate "special" release announcement to
maintain — write each section as the thing you'd want a user to read on
the Releases page.
-->

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

## [1.1.0] — 2026-07-28

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

## [1.0.0] — 2026-07-21

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

[Unreleased]: https://github.com/raetha/ha-dockhand-cards/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/raetha/ha-dockhand-cards/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/raetha/ha-dockhand-cards/releases/tag/v1.0.0

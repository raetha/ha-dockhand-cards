# Architecture reference

How the cards work now and why. Read the section for an area before changing it. History lives in
`CHANGELOG.md` and git; if this file and the code disagree, the code is right and this file needs
fixing. Section numbers are referenced from code and other docs, so keep them stable.

## 1. Entity resolution

Entities resolve by **`translation_key`**, scoped to a device (`resolveEnvironmentEntities`/
`resolveContainerEntities`/`resolveStackEntities` in `entity-resolver.ts`, thin wrappers around
`resolveEntities<K>()`), never by parsing `unique_id`, which is ha-dockhand's implementation
detail. `translation_key` is the contract: renaming one in ha-dockhand breaks the cards.

A few ha-dockhand entities have **no `translation_key`**: those whose name is the device's name (a
container's or stack's running switch, a container's `update` entity). `findPrimaryEntityByDomain()`
finds them by domain + device, matching only entities of that domain *without* a `translation_key`,
since a device can carry other same-domain entities that have one (a container's
`container_auto_update` switch beside its running switch). ha-dockhand guarantees one untranslated
entity per domain per device for these. Don't use it for anything that has a `translation_key`.

## 2. Editors are `<ha-form>` schemas

Every editor builds its fields as a schema for HA's own `<ha-form>`: one `_valueChanged` handler,
labels and helpers through `computeLabel`/`computeHelper` backed by this repo's `t()`. Minimal
schema types live in `common/ha-form-types.ts`, extended only as shapes are needed and checked
against HA's source.

Native schema features in use:

- **`type: 'expandable'`** (`ha-form-expandable.ts`): a collapsible section with `icon`, `title`,
  `expanded` and `flatten` (children write onto the parent's data). Every card's Content section
  uses it. It doesn't forward `warning` to its nested form, so a field with a warning stays in the
  outer schema (the Environment card's `mode`; `docs/editor-design.md` rule 2).
- **`type: 'grid'`** (`ha-form-grid.ts`): `repeat(auto-fit, minmax(column_min_width ?? 200px,
  1fr))`, so toggles sit side by side. Same `warning` limitation.
- **`selector: { entity_name: {} }`**: HA's Name field (Composed or Custom), as in the Tile, Area
  and Heading editors. `common/card-name.ts` supplies the entity to compose from and the fallback
  (`docs/editor-design.md` rule 3).
- **`type: 'multi_select'`**: checkboxes from a `Record<string, string>`, saved as `string[]` in
  the order they were ticked. Card code only checks membership, so the order doesn't matter.
- **`.warning`/`computeWarning`**: an `<ha-alert>` at a field. The Container, Stack and Environment
  editors use it to flag a missing or disabled entity where it matters.

Not schema fields, and hand-built:

- **The environment order/exclude section** of every multi-environment card
  (`renderEnvironmentOrderSection()`, `common/environment-scope-editor.ts`): drag-reordering and
  eye toggles have no `ha-form` model. Its optional `onEdit` hook gives the Overview editor its
  per-environment "pencil" button without a second copy of the rows.
- **The Updates card's `visibility:` condition**: derived from several fields after `ha-form`
  returns the merged data (`_applyValueChange()`).

Rules:

- **Set `mode: 'dropdown'` on every `select` selector.** Without it HA picks `list` for fewer than
  six options and `dropdown` otherwise (`ha-selector-select.ts`), so the look flips as option
  counts change.
- **Every schema field needs a `computeLabel` case**, or the raw field name shows as its label. A
  `multi_select`'s option labels come from its `options` map, separately from the field label. The
  interaction tests (`src/interactions.dom.test.ts`) compute every field's label and helper.
- **Conditional fields are included or left out of the schema in code** (`custom_sections` only in
  `mode: 'custom'`). `ha-form`'s `visible: {...}` exists in newer HA frontends; check it's in a
  release the minimum HA version covers before relying on it.
- **A field that only filters another field's options can simply be saved** if saving it is
  harmless (§5).

## 3. Embedding a card's editor in another editor

The Overview editor mounts the real `dockhand-*-card-editor` elements (environment, vulnerability,
stacks, containers, schedules, updates) for its per-environment overrides and its section defaults
(§4), listening to their `config-changed`, so a field added to any of them works there too.

What that needs:

- **`cardIsEmbedded` and `hideTitle`** (both default `false`). `cardIsEmbedded` hides the
  environment/device picker and anything environment-scoping; `hideTitle` hides the name, which
  makes no sense shared across environments. Decide per field what to hide, and check the
  rendered result when adding these to an editor.
- **Mount with `ref()`**, since `setConfig()` is a method a template can't bind: set `.hass`,
  then the flags, then call `setConfig()`, so the first render already hides what it should. The
  per-environment view is wrapped in `keyed()` on the device id, so switching environments mounts
  fresh editors. Later `hass` updates are passed to every mounted embedded editor by the Overview
  editor's `hass` setter.
- **`ev.stopPropagation()` first in every handler for an embedded editor's `config-changed`.**
  Otherwise the embedded editor's own event (its own card type, perhaps an empty `device_id`)
  reaches HA's card dialog, which previews it instead of the Overview. When testing these
  handlers, a listener on the Overview element can catch both events; read the editor's resulting
  config rather than whichever event arrived last.
- **Take everything the embedded editor emits except `type`/`device_id`** rather than picking
  fields, so a new field is saved without changes here. Safe because each embedded editor only
  ever gets one environment's override for one section. Override types follow the same idea:
  `Omit<DockhandXCardConfig, 'type' | 'device_id'>`, also omitting `environments_order`/
  `exclude_device_ids` for Stacks and Containers (the Overview decides the environment).
  Schedules' and Updates' override types are declared by hand, since their configs carry scoping
  fields (`scope`, `visibility`) a plain `Omit` wouldn't exclude.

## 4. Overview: config naming and section defaults

The Overview renders environment, vulnerability, stacks, containers, updates and schedules cards
for each environment. Each generated card's config comes from, in priority order: the
environment's override (§3), the section's default, then the card's own default.

**Naming:** a setting of one environment's card is singular and section-prefixed, matching the
card's own field (`environment_mode`, `stacks_visible_badges`); a key about the section or list as
a whole is plural (`show_environments`, `environments_overrides`, `environments_order`).

**Section defaults** use the real editors too (§3, with both flags set). Field names map
mechanically: `${prefix}_${field}`, where the prefix is the section name except `environments` →
`environment` (`GLOBAL_SECTION_PREFIX` in the Overview editor). Reading scans the Overview config
for that prefix; writing prefixes every field the editor emits except `type`/`device_id`. Nothing
here changes when a card gains a field. The scan is safe only because the plural
`environments_overrides`/`environments_order` can't match the singular `environment_` prefix: **no
new top-level key may start with a section prefix.** The embedded Updates editor never writes a
`visibility:` condition (it can't reach a card inside the Overview's shadow DOM, §9); the Overview
applies `hide_when_no_updates` itself.

**Don't pass `undefined` for a field the target card defaults with `{ default, ...config }`.**
Spread copies `undefined` and overrides the default (`{ show_settings_link: true,
...{ show_settings_link: undefined } }` hides the link). Include a key only when it has a value:
`...(x !== undefined ? { x } : {})`. Fields read with `??` at use are unaffected.

## 5. `environment_device_id`: saving a filter field

The Container and Stack editors' environment picker filters the container or stack picker, and is
saved as `environment_device_id`, cascading like the Tile card's entity-dependent schema. When it's
missing (older configs) or names a device that's gone, the editor derives the environment from the
chosen device's identifiers. A saved value can go stale in ways in-memory state can't, so it's
checked against `hass.devices` before use.

## 6. The Dockhand link: off, or unavailable

Each card's Dockhand link (`.header-icon`, §11) has three states: `show_settings_link` on with a
URL that parses → a clickable icon; on but no usable URL → `mdi:link-off` with
`.header-icon.link-unavailable` (additive) and a tooltip saying what's wrong; off → nothing. The
icon and tooltip are shared constants (`SETTINGS_LINK_UNAVAILABLE_*`, `common/format.ts`). Every
card with a link validates it the same way. `getDockhandBaseUrl()` returns only the origin and is
for validation: navigate to the full `configuration_url`, which deep-links (Environment, Container,
Stack).

## 7. HA frontend components: check the source

- `ha-select` has `.helper` and `ha-input` has `hint`; `ha-formfield`/`ha-switch` have nothing
  similar, so a hint beside a switch, or a section intro, uses the `.hint` class
  (`editor-styles.ts`).
- `ha-expansion-panel` has `secondary` (a description line, unused so far) and `no-collapse`
  (permanently open; set on every environment order/exclude section, `docs/editor-design.md` rule
  4 — removing the attribute is the whole change if that decision changes).
- **Two kinds of expansion panel:** Content sections are the native `expandable` schema type.
  Hand-built panels (environment order, the Overview's Sections and per-environment wrapper) use
  `<ha-icon slot="leading-icon">` + `<h3 slot="header">`, as HA's own hand-built Features panels
  do, and rely on the slotted-header reset (`margin: 0; font-size: inherit; font-weight: inherit`)
  that HA's `configElementStyle` has and `sortableRowStyles` repeats. The icon is a slotted
  sibling of the `h3`, not inside it.
- No HA chip component suits a static label (`ha-assist-chip`, `ha-filter-chip`, `ha-input-chip`
  all imply interaction), so the Overview's "Overrides from default" badge is a plain span.
- When an HA component seems broken, check whether its API changed before working around it:
  `ha-select` now takes `.options` and fires `selected` with `detail.value` instead of slotted
  list items.
- `getConfigForm()` can't drive these editors: its callbacks see only the static schema, not live
  `hass` or config, so no cascading pickers or per-field warnings.

**Font sizes use HA's tokens** (`--ha-font-size-*`, `typography.globals.ts`), which scale with the
user's text-size setting through `--ha-font-size-scale`; `em` values off the fixed 14px root
don't. Section headings stay at body size and use weight, as HA's panel headers do.

**Switch or checkbox:** an independent on/off setting is `selector: { boolean: {} }` (a switch,
what HA's own config screens use); picking several from one set is `multi_select` (checkboxes),
like the Environment card's custom sections.

## 8. CSS: container queries and custom properties

The Environment card's full mode responds to the card's own width with a container query, so it
also works inside the Overview's columns.

- An element can't query a container context it establishes itself: `container-type` and the
  `@container` rule go on different elements. Getting it wrong fails silently.
- A selector like `.status-icons ha-icon` doesn't reach the `<ha-icon>` inside `<ha-state-icon>`'s
  shadow root. Set custom properties on a wrapper; they inherit through shadow boundaries.

## 9. HA constraints with no card-side hook

- **`preview` means dashboard edit mode**, set on every card in the view; the card picker never
  sets it and has no size cap. The only picker hook is `getStubConfig()`, which is why the
  Overview's stub shows environments only.
- **HA's `visibility:` hides a standalone card properly** (`hui-card.ts` sets `display: none` on
  the wrapper, edit mode included). The Updates editor writes one `numeric_state` condition per
  environment, OR'd, when `hide_when_no_updates` is on, and removes it when off
  (`common/updates-visibility.ts`).
- **Neither reaches a card nested in another card's template.** The Overview checks
  `hasPendingUpdates()` itself and leaves the Updates card out of its column.

**Hiding and counting read one aggregate per environment:** the `pending_updates_total` attribute of
ha-dockhand's containers sensor, not each container's update entity. A `visibility:` condition is
saved in YAML, so it has to reference something stable; per-container entities churn as containers
are recreated, and an environment can have dozens. ha-dockhand keeps three attributes apart:
`pending_updates` (eligible for bulk update, no system containers), `pending_system_updates`, and
`pending_updates_total` (both, plus newer-version-tag suggestions: the number of update entities
that are on). The cards want the total, since their rows show system containers. The Updates
card's header count reads the same total (`getTotalPendingUpdates()`); its rows and its "everything
up to date" state come from the rows themselves, so if the two ever disagree a mismatch shows
instead of rows hiding. A disagreement means ha-dockhand's aggregate and its update entities have
drifted: fix it there.

## 10. CSS design tokens

Spacing and font sizes use HA's `--ha-space-*`/`--ha-font-size-*` (`core.globals.ts`,
`typography.globals.ts`) wherever a value is on HA's scale:

```
--ha-space-1: 4px   --ha-space-2: 8px   --ha-space-3: 12px  --ha-space-4: 16px
--ha-space-6: 24px  --ha-space-9: 36px  --ha-space-12: 48px
--ha-font-size-xs: 10px  -s: 12px  -m: 14px (base)  -l: 16px  -xl: 20px  -2xl: 24px
```

They're set on `<html>` and inherit into shadow DOM. Always write a px fallback
(`var(--ha-space-2, 8px)`), never `em` (nested `em` sizes multiply). The screenshot harness
defines the real values (`scripts/screenshot-harness/index.html`) so tests use the token path. A
round number isn't necessarily a token: match HA's actual rule (`ha-form-expandable`'s content
padding is a literal `12px`).

## 11. Shared classes

Everything shared lives in `common/shared-styles.ts`; cards use it rather than local copies. §18
lists every class.

**Rows:**

- **`.row`**: the default data row — flex, centered, `space-between`, `8px` gap.
- **`.row-left`** / **`.row-right`**: the grouped left part (icon, name, pills) and trailing part
  of a row. Position comes from `.row`'s `space-between` and DOM order.
- **`.header-left`** / **`.header-right`**: a card header's groups, separate from the row classes
  because their gaps differ. `.header-icon` is a 32×32 box around a 24px icon (4px invisible
  padding each side), so `.header-right` has `gap: 0` (4 + 4 = 8px between visible icons) and
  `.header-left` keeps `8px` with `.header-left .header-icon { margin: 0 -4px }`. The Stack
  card's `.header-right .label-pill { margin-right: 4px }` does the same where a pill meets an
  icon. Spacing is measured between visible glyphs.
- **`.row-icon`**: a small non-shrinking icon with optional text — a row's leading state icon, or
  one of the trailing badges in `.row-right`.
- **`.hero-row`**: a card's most prominent value, centered, `12px` padding.
- **`.stacked-pair`**: a line plus secondary content `2px` apart, owning its outer spacing as one
  unit (a stacked header; a metric label over its bar).

**Spacing:** `.body`, `.section`, `.list` and `.grid-2` have no `gap`. Every direct child gets 4px
top and bottom padding (`.body > *:not(.section):not(.grid-2):not(.divider):not(.hero-row),
.section > *, .list > *, .grid-2 > *`), so adjacent rows are 8px apart. `.section` and `.grid-2`
are excluded as `.body` children because they pass padding to their own children (8px otherwise);
`.divider` and `.hero-row` because they set their own, and the more specific context rule would
override it. Padding, not margin: margin on a flex child adds to the parent's spacing.

**Dividers belong to the caller, not a section.** `joinWithDividers()` (`common/section-join.ts`)
puts a `.divider` between sections that rendered, never first, last or doubled, whatever is
hidden or empty; `mergeSections()` groups sections that sit together with no divider (a metrics
section and its grid) and still collapses to `nothing` when all are empty. This matters wherever
any section can come first (the Environment card's custom mode).

**Lists:** `.list` is `display: contents` and the only list container. Rows don't align columns
across rows (§13).

**Color:** `.status-banner` (one prominent message per card) and the icon tiers take
`.ok`/`.warn`/`.error`/`.accent`(/`.neutral`), reading HA's `--success-color`/`--warning-color`/
`--error-color` and `--dockhand-accent-color`. A state with its own vocabulary maps to these in a
local table (`HEALTH_STATUS_CLASS` in the Container card) rather than adding a modifier. Neither a
banner nor a colored icon signals "clickable"; real actions are header icons with `.filled` (§17).

**Names:** short generic class names collide across cards, and a lower-specificity rule that sets
a property beats inheritance from a more specific parent. Use specific names (`.item-name`) and
grep before reusing a short one.

**Using HA's own elements:** only those guaranteed loaded in a dashboard. `ha-form`, `ha-selector`,
`ha-expansion-panel`, `ha-icon`, `ha-icon-button`, `ha-alert`, `ha-input` and `ha-sortable` are
(the dashboard root imports `ha-icon-button`; `ha-form` imports `ha-alert`, `ha-input` and, through
`ha-selector`, `ha-sortable`). `ha-assist-chip` and `ha-automation-row-event-chip` aren't, so their
look is matched in plain CSS. `ha-relative-time` loads only through the entities card, so
`formatRelativeTime()` (`common/format.ts`) is used instead. Cards render no `ha-button`; editors
may. The question for any HA element: is it part of the always-loaded dashboard shell?

## 12. Text color

`--secondary-text-color` is set once on `ha-card`. Only headers (`.section-title`, `.group-header`,
`.column-title`) and deliberate highlights (`.hero-word`, `.hero-row`, `.section-title-value`, the
Stack card's `.sync-status`) set `--primary-text-color`; everything else inherits, so an unstyled
element can't end up a different color from its neighbors. Explicit colors stay where they're the
point: `.label-pill` (its own background), color-modifier sets (`.row-icon.neutral`,
`.sync-status.pending`), and hover/unavailable states of `.header-icon`. Themes and card_mod work
through the custom properties either way.

## 13. Spacing and lists

The rhythm is 8px between rows and sections, built from padding (§11) and measured with
`getBoundingClientRect()`, not by eye. Everything under the header, header included, is inside
`.body`. Rows that need more space (`.hero-row`) add their own padding.

List cards don't align columns across rows: their badges are toggleable and vary per row, and one
list mechanism (`.list`, rows laid out by `.row`) is simpler than per-card column tracks.

## 14. CSS and rendering facts

- SVG elements default to `transform-origin: 0 0`; set it before rotating.
- Templated children inside `<svg>` need Lit's `svg` tag; the outer `<svg>` can stay in `html`.
- Specificity beats source order: `.row-icon.warn` beats a one-class rule wherever it's defined.
- A flex item's `min-width` defaults to `auto`; use `min-width: 0` (and `overflow-wrap` where
  needed) for content that should truncate or wrap.

## 15. Icon sizes

| Context | Size |
|---|---|
| Section titles, `.stats-row .stat`, `.status-banner`, `.row-icon`, `.row` | 16px |
| `.card-badge`, `.header-icon`'s icon, the hero word's icon | HA's default (24px) |
| `.header-icon`'s box | 32×32px; doesn't change the header-to-divider spacing, which comes from `.body` padding and the divider's margin |

An element holding an icon needs `line-height: 1`, or it takes the parent's text line height and
grows taller than a sibling with the same icon.

## 16. Donut chart (Environment disk usage)

Wedges and rounded corners come from `d3-shape`'s `arc()`, the one dependency besides Lit. Its
`padAngle` makes angular gaps, narrower toward the center, as Dockhand's chart has. The cards'
gaps are a constant width instead: each boundary is a straight "eraser" line in the card's
background color along the segment edge (which passes through the center), drawn over the wedges.

## 17. Shared helpers

- **`multiEnvCardNameFallback`** (`common/card-name.ts`): the default name for a card covering
  several environments ("Nebula — Stacks" for one environment, "Stacks" otherwise).
- **`resolveEffectiveGroupBy`** (`common/environment-scope.ts`): whether a list card groups by
  environment; grouping by environment becomes none when only one is included.
- **`renderIcon`** (`common/icon.ts`): every small icon, clickable or static — header icons, the
  Dockhand link, row badges, `.card-badge`, `.stat`. `baseClass` picks the tier
  (`header-icon`/`row-icon`/`card-badge`/`stat`). `.filled` (appended to `baseClass`) gives a
  header icon a visible background and room for text, for the Updates card's Update all and Check
  for updates; `busy: true` swaps the icon for a CSS `.spinner` (not `ha-spinner`, which may not be
  loaded). `onClick` is required unless `disabled: true` (a known muted state, such as the
  unavailable Dockhand link; still swallows clicks) or `static: true` (never interactive; clicks
  pass through) — a discriminated union, so there's no clickable-looking icon without an action.
  Enter/Space activate it like a click. `renderSettingsLink` builds the Dockhand link on top.
- **`onKeydownActivate`** (`common/icon.ts`): the Enter/Space handler for clickable elements that
  aren't `renderIcon()` icons (a whole `.row`, a `.hero-row`).
- **`renderResourceMetrics` / `renderResourceIo`** (`common/resource-sections.ts`): CPU/memory bars
  and the network/disk grid, for the Container and Stack cards. A stack has no memory percentage
  (`STACK_RESOURCE_KEYS`), so its bar is usage over limit, as on Dockhand's Stacks page.
- **`newerVersionTag` / `isVersionTagOnly` / `renderVersionTagPill` / `versionTagTooltip`**
  (`common/version-tag.ts`): ha-dockhand's newer-version-tag attributes, for the Updates,
  Containers and Stack cards. The tooltip follows Dockhand's `VersionUpdateBadge.svelte`.
- **`updateStatus` / `updateKindIcon` / `renderUpdateKindIcon`** (`common/update-kind.ts`): what an
  update entity that's on means — `installable`, `tag` (newer tag only), `pinned` (moved digest on
  a digest-pinned image) or `held` (`update_held_hours`); the last three have nothing to install.
  Orange arrow, grey tag, orange pin, grey clock, as in Dockhand's containers list.
- **`renderTagPills`** (`common/tag-pills.ts`): Dockhand tags as colored pills; the pill group
  shrinks before the name does.
- **`PairGridController`** (`common/pair-grid.ts`): stacks every `.grid-2` pair at once when the
  widest item won't fit in half the width, measured from content.

## 18. CSS classes

Every class in use. `docs/styling.md`'s card_mod section is the public subset.

### Shared (`common/shared-styles.ts`)

| Class | Purpose |
|---|---|
| `.body` | A card's content wrapper; children contribute their own padding (§11). |
| `.card-header`, `.header-left`, `.header-right` | The header row and its groups (§11 for their gaps). |
| `.card-badge` | The header's 28×28 tinted icon identifying the card; static, via `renderIcon()`. |
| `.truncate` | One-line ellipsis; sits on the text element itself. |
| `.card-subheader` | The header's secondary line (host, image tag). |
| `.header-icon` (+ `.link-unavailable`, `.filled`, inner `.spinner`) | Any header icon: update chip, toggle, Dockhand link, connection type. 32×32 box around a 24px icon. Color modifiers. |
| `.clickable` | Hover/focus treatment, always added to an identity class (`.row.clickable`). |
| `.section`, `.section-title`, `.section-title-value` | A labeled sub-section, its title, and a count pushed right. |
| `.group-header`, `.column-title` | A group label in list cards; the Overview's column title (one step larger than a card header). |
| `.divider` | A separator, placed by `joinWithDividers()`/`mergeSections()` (§11). |
| `.hero-row`, `.hero-word` | A card's most prominent value (12px padded row) and the value itself (also the Container card's health chip). |
| `.stacked-pair` | A line plus secondary content, 2px apart. |
| `.list` | List row container, `display: contents`. |
| `.row`, `.row-left`, `.row-right` | The default data row and its groups. |
| `.item-name` | A row's name: `flex: 1`, truncating. |
| `.row-icon` | Small icon with optional text: a row's state icon or a trailing badge. Color modifiers. |
| `.label-row`, `.label-pill` | A wrapping row of pills (8px gap) and the pill (12px text, `line-height: 1`). |
| `.tag-pills` | A row's or header's Dockhand tags, shrinking before the name. |
| `.status-banner` | One prominent colored message per card. |
| `.card-message` | A message replacing a card's content (missing entity, nothing to show, all clear); `.warn`/`.error`. |
| `.grid-2` (+ `.stacked`) | Two self-contained items side by side; `.stacked` from `PairGridController`. |
| `.fit-parts` | A value of pieces (`8.1%`, `· 41.5 MB`, `/ 512.0 MB`) that drops pieces from the end when narrow, via `renderFitParts()` (`common/fit-parts.ts`). |
| `.bar-track`, `.bar-fill` | A CPU/memory bar; `.bar-fill` takes `.ok`/`.warn`/`.error`. |
| `.stats-row`, `.stat` | Centered icon+count items spread evenly; `.stat` colored per instance. |
| `.ok`, `.warn`, `.error`, `.accent`, `.neutral` | The shared color modifiers. |

### Card-specific

The Container, Containers, Schedules, Stacks and Updates cards have no local classes.

- **Environment** (`dockhand-environment-card/styles.ts`): the disk donut and legend
  (`.disk-chart-row`, `.disk-donut`, `.disk-dot`, `.disk-legend`); the CPU/memory sparklines and
  tooltip (`.sparkline`, `.sparkline-wrap`, `.chart-tooltip` with `-dot`/`-time`/`-value`,
  `.chart-value`); the full-mode layout (`.full-container`, `.full-layout`, `.full-left`,
  `.full-right`); the resource grid's breakdown (`.breakdown` with `.running`/`.partial`/
  `.stopped`).
- **Stack** (`dockhand-stack-card/styles.ts`): `.sync-status` (`.synced`/`.syncing`/`.pending`/
  `.error`) and `.sync-error-banner` (top-aligned for multi-line errors).
- **Vulnerability** (`dockhand-vulnerability-card/styles.ts`): `.severity-grid` (4-up) and
  `.severity-pill` (`.critical`/`.high`/`.medium`/`.low`).
- **Overview** (`dockhand-overview-card/styles.ts`): `.overview` (a grid of
  `repeat(auto-fill, minmax(320px, 1fr))`, or flex-wrap with `.no-align`), `.env-column`, and
  `.section-wrapper`. The Overview only composes other cards.

**Aligned columns (`align_columns`, default on):** each section in a column is wrapped in
`.section-wrapper[data-section]`, rendered even when the section is empty. One animation frame
after each update, `_equalizeColumnHeights()` clears the wrappers' `min-height`, groups columns
into visual rows by their top (±4px), skips rows with a single column (so a lone column never gets
dead space), and gives each section in a row the tallest height of that section in the row. A
`ResizeObserver` on `.overview` reruns it when the width changes. CSS subgrid would be the natural
tool, but Chrome's subgrid sizing widened the second column. With `align_columns: false`,
`.no-align` switches to flex-wrap, no wrappers are rendered and the observer is removed.

## 19. Device lookups: a bare env_id is never enough

Container, stack and schedule devices are found by the env_id inside ha-dockhand's identifiers
(`{entry_id}_container_{env_id}_{name}`, ha-dockhand's `helpers.py`). Every Dockhand instance
numbers its first environment `1`, so two instances both have an env 1, and a lookup by number
alone mixes their devices (ha-dockhand-cards#1). **Every lookup also requires
`sameConfigEntry()`**: the candidate has the reference device's `config_entry_id`. HA sets it on
every device, whatever its identifier format. That's why `get*DevicesForEnvironment`,
`getEnvDeviceForEnvId` and `getScheduleGroupDeviceForEnvironment` take the environment's device,
not a number: don't simplify them to `envId: number`.

Schedules resolve through `via_device_id`, an HA-assigned unique id, which is better wherever a
parent link exists; `sameConfigEntry` covers containers and stacks, which have none end to end.

## 20. Naming a Dockhand instance: the `configuration_url` host

To tell a person which instance something belongs to (the Schedules card's global schedules when
several instances have them), use `getInstanceLabel()` (`common/format.ts`): the host of the
device's `configuration_url`, which every ha-dockhand device carries. Environment names and numbers
can repeat across instances and an instance has no single environment to name it by; two entries
share a host only if they point at the same server.

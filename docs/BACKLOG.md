# Backlog

Ideas and gaps already evaluated and deliberately deferred, and why — check here before
re-proposing something that might already be covered. This file is for what's **not done yet**
only. Once an item ships, remove it — the shipped behavior is what the code and `CHANGELOG.md`
already describe; this file doesn't need to also carry its history. Genuinely reusable technical
gotchas (not "this got fixed", but "here's a pattern worth remembering") belong in
`docs/ARCHITECTURE.md` instead.

## Environment Card

- **User-picked environment icon.** Dockhand stores this as `icon: string` on `EnvironmentStats`,
  but it has two incompatible representations depending on `isCustomIcon(icon)`:
  - A named Lucide icon (e.g. `"server"`) — rendered via `getIconComponent(icon)`. No direct MDI
    equivalent lookup exists; would need a hand-built Lucide-name → MDI-name mapping table (Lucide
    and MDI don't share a naming convention), covering whatever subset of Lucide's ~1500 icons
    Dockhand's icon picker actually offers.
  - A **custom uploaded image**, served as binary from `GET /api/environments/{id}/icon`. ha-
    dockhand would need a new sensor exposing this as image data (HA's `image` platform, not
    `sensor`) for the card to show it at all — a real integration change, not a card-only fix.

  Not attempted because of that two-representation split; flagged rather than shipped
  half-working (e.g. only supporting the named-icon case and silently ignoring custom images).
  The header currently shows a fixed generic icon instead — documented at the render site as a
  known gap, not an attempted match.

## Stack / Container cards

Shipped as a first pass with no direct Dockhand UI to model against (Dockhand only shows this
level of detail on full detail pages). Raetha has floated possibly eliminating these singular
cards later if they turn out low-value once the plural Stacks/Containers cards and the Overview
card are in regular use — not decided, just flagged so a future session doesn't assume they're
permanent.

- **Action buttons.** Both cards are still read-only display + more-info click-through.
  `findPrimaryEntityByDomain()` in `entity-resolver.ts` already implements the domain-based
  lookup these actions would need (container/stack running switch, container update-install, git
  stack deploy button — all `has_entity_name=True` with no `translation_key` by design), so
  there's no technical blocker left. What's open is purely whether these two specific cards
  should gain write actions at all, not how.

## Updates card

- **No automated test covers the `_checking`/`_triggering` → class/disabled/spin behavior** on
  the "Check for updates"/"Update all" buttons (converted from `ha-button` to `renderIcon()` this
  cycle). Verified thoroughly by hand via direct browser automation — forcing each state and
  confirming the right CSS classes, the spin animation, and `tabindex` removal — but that
  verification isn't captured as a real, repeatable test. `card.test.ts`'s own existing tests only
  cover pure, exported functions (`sortPendingUpdates`, `shouldShowEnvironmentGroup`); this is
  DOM/private-state behavior, which doesn't fit that pattern directly and would need a different
  kind of test (closer to `icon.test.ts`'s own `render()`-based approach) to cover properly.
  Deferred specifically to avoid taking on a new testing pattern while trying to get this release
  out — not a decision that it isn't worth testing. Should be picked up for the next cycle: "if it
  can be tested, it should be" is the standing bar, this is just behind schedule against it.

- **`hide_when_no_updates` could become mode-aware, letting Overview embed the standard editor
  the same way it already does for Stacks/Containers/Schedules.** Currently blocked by the
  visibility mechanism itself, not anything Overview-specific: the standalone Updates card's own
  `hide_when_no_updates` sets HA's native card-level `visibility:` config field, which only works
  for a real, standalone Lovelace card HA's dashboard directly manages — it can't reach an
  instance mounted inside another card's own shadow DOM. Overview already works around this today
  by fully embedding `<dockhand-updates-card>` directly (confirmed — it's not a lighter summary
  view, it's the real card) and maintaining its own separate `updates_hide_when_no_updates` field,
  which hides the embedded instance via plain JS conditional rendering (not including the element
  in the template at all when there's nothing pending) rather than through `visibility:`. That
  works, but it's a duplicate field living on the wrong card, and it's why Updates can't yet use
  `_mountGlobalEditor`'s embeddable-editor pattern the way Stacks/Containers/Schedules do — the
  standard Updates editor still assumes the standalone, `visibility:`-based behavior.

  The fix Raetha's proposed: give Updates' own config two versions of "hide when no updates" —
  one using `visibility:` for the standalone case (unchanged), one using the plain-conditional
  approach Overview already implements, with the card itself deciding which applies based on
  whether it's been mounted with `cardIsEmbedded` (i.e., embedded) or not. Once that split
  exists, Overview's own `updates_hide_when_no_updates` field and its hand-rolled conditional in
  `_renderUpdates`'s `updates` section renderer can both be deleted in favor of routing straight
  through to the embedded card's own config, the same way every other embedded section already
  works (see `_renderColumn`'s own `updates` section renderer in `dockhand-overview-card/card.ts`
  for where that hand-rolled conditional currently lives). Deferred to the version after this
  one, not because of any remaining uncertainty about the approach — just triaged behind other
  work for this cycle.

## Cross-card

- **Real-browser / screen-reader verification** of the keyboard interaction pattern (`tabindex`
  + `role="button"` + `@keydown` on non-`<button>` elements) — implemented per WAI-ARIA guidance
  but not yet manually verified against NVDA/VoiceOver.

- **Translation coverage is mostly editor-only (v1.1).** `src/common/i18n.ts` covers field labels,
  section headings, and mode-description hints across all editors, same 11 locales as ha-dockhand,
  plus one piece of live-card-rendered text: each card's "Open in Dockhand"-style link tooltip.
  Everything else live-card-rendered (e.g. "Images", "CPU", "Events", health/status words) is still
  English-only — a much larger string set spread across every card's render methods, not just
  editors. Extending coverage there is mechanical but sizable; do it incrementally, same discipline
  as ha-dockhand (translate a string into every locale the same pass it's added, never leave one
  partially stale).

- **Vulnerability findings list/table card** — the summary card shows aggregate counts only,
  matching what's cheap to poll (`/api/vulnerabilities/count`). A full findings list would need a
  much heavier ha-dockhand call (`/api/vulnerabilities` itself, paginated) and is a different
  shape of card entirely (a table, not a tile) — not attempted.

- **Card resize support (`getGridOptions`): picker-preview length isn't controllable.** No card-
  side property or CSS hook distinguishes "rendering for the add-card picker" from "rendering on
  a real, editable dashboard" — see `docs/ARCHITECTURE.md`. The Overview card's environments-only
  default (see README) is the accepted mitigation, not a true fix; if HA ever adds a real
  preview-scoped hook, revisit making Vulnerabilities/Stacks/Containers on-by-default again.

- **Dependency version floor: `typescript` capped below 7.0.** `typescript-eslint` cannot run
  against TypeScript 7 yet (hard crash, not a warning, as of TS 7.0's July 2026 GA — no stable
  programmatic API until 7.1, expected ~October 2026). `package.json` pins `^6.0.3`, which a
  caret range can't cross past on its own. Revisit once `typescript-eslint` adds TS7 support.

- **Card-picker names/descriptions (`window.customCards`) can't be localized.** Not a gap on this
  repo's side — HA's own picker reads those fields as plain strings with no localization hook,
  and this is a confirmed, long-standing HA limitation
  ([home-assistant/frontend#6482](https://github.com/home-assistant/frontend/issues/6482), filed
  2020, still open). A `document.documentElement.lang`-based workaround was considered and
  rejected: unverified as an established pattern, wouldn't react to a live language change without
  a page reload, and works around a missing HA feature rather than using a real one. Revisit only
  if HA ever adds native support.

- **Overview card's embedded per-environment override editors don't refresh `hass` after mount.**
  `_mountEditor()`'s `ref()` callback (editor.ts) sets `.hass` once, when the detail view for a
  given environment first mounts (see the `keyed()` wrapper forcing a fresh mount per
  environment). If `hass` updates while that same detail view stays open — e.g. the user changes
  HA's UI language mid-edit — the embedded editor won't pick up the new value until the user
  navigates away and back (or switches environments). Low practical impact: the only thing these
  embedded editors read `hass` for once `cardIsEmbedded` is true is `t()` for label text, and
  changing UI language mid-edit is a rare scenario. Fix would mean re-pushing `.hass` to whichever
  section editor is currently mounted on every parent update, not just at mount time.

- **`ha-form`'s `visible:` conditional-field-visibility isn't used yet.** Merged into HA's frontend
  `dev` branch 2026-07-17; not in any released HA version as of this writing (checked directly
  against `homeassistant/components/frontend/manifest.json` in HA core's own repo — even 2026.7.4,
  the latest release, predates it). The one field that needs conditional visibility (Environment
  card's `custom_sections`) currently achieves it by conditionally including/excluding the schema
  entry in plain JS instead — see `docs/ARCHITECTURE.md` §2. Switch that over to real `visible:`
  once it ships in a released HA version this repo's floor actually covers, and only then.

- **Remove `environment_overrides`/`environment_order` backward compatibility.** Renamed to
  `environments_overrides`/`environments_order` in 1.1.0 (see CHANGELOG) — the deprecated fields
  still exist on `DockhandOverviewCardConfig`, `getEnvironmentOverrides()`/`getEnvironmentOrder()`
  in `dockhand-overview-card/types.ts` still fall back to them for reading, and the editor's
  `migrateOverviewConfig()` still normalizes them away on load. This was done specifically while
  ha-dockhand-cards has very close to zero real users (1.0.0 had just shipped, no stars, no visible
  adoption) — safe to fully remove once that's no longer true. Target: no earlier than 2 releases
  after 1.1.0 actually ships, or ~2 months after that release, whichever is later — check with
  Raetha before removing rather than assuming the window has passed. Removal means: delete both
  deprecated fields from the config interface, delete the fallback branch in each accessor
  function (leaving them as trivial `config?.environments_overrides` one-liners — at that point
  worth asking whether keeping them as functions at all is still justified, or whether reading the
  field directly everywhere is simpler once there's no migration logic left to centralize), and
  delete `migrateOverviewConfig()` and its call in the editor's `setConfig()`.

- **Deriving Overview's flat global-default fields via a mapped type — considered, not worth it.**
  `stacks_visible_badges`, `environment_show_settings_link`, and the rest are hand-declared on
  `DockhandOverviewCardConfig`, even though every one of them is mechanically
  `${prefix}_${fieldName}` of some field on the corresponding standalone card's config (the same
  observation that led to deriving `EnvironmentOverrideStacks` etc. via `Omit<...>` — see
  `docs/ARCHITECTURE.md` §3). In principle a template-literal mapped type
  (`{[K in keyof T as \`${P}_${K}\`]: T[K]}`) could derive these the same way, so a new field on one
  of the 5 reused cards would need nothing added here either. Not implemented: unlike the
  `EnvironmentOverride*` case, there's no live bug motivating it — `_globalEditorConfig`'s runtime
  prefix scan already picks up a new field regardless of whether it's declared on the type, so the
  gap is purely a compile-time completeness one, not a correctness one. And the cost is real, not
  hypothetical: a mapped type like this typically shows an IDE's hover tooltip the fully computed,
  unfriendly shape instead of a clean named type, which is a genuine readability tax on every
  future person (including future Claude) who inspects `DockhandOverviewCardConfig` while working
  in this file. Revisit only if a real motivating reason shows up (e.g. the hand-declared fields
  actually drift out of sync with a card's config in practice) — not simply because it's possible.

- **A single-environment Overview card given extra dashboard width (e.g. spanning 3 grid columns)
  currently just stretches, rather than spreading its sections out to use the width.** Confirmed
  against the actual CSS: `.env-column` is `flex: 1 1 320px` inside a `flex-wrap` `.overview`
  container — with *multiple* environments, that's exactly why the card already does something
  like the desired behavior (each environment's own column, wrapping to fill available width), but
  with a single environment there's only one `.env-column`, and `flex-grow: 1` means that one
  column stretches to fill all the available width — its children (Environment/Vulnerability/
  Stacks/etc. cards) are stacked vertically and just render wider individually, not rearranged into
  a multi-column layout. `getGridOptions()` also defaults to `columns: 'full'`, so a 3-column span
  is already a user override, not something the card anticipates today.

  There's a real, working precedent for the desired behavior: the standalone Environment card's own
  "full" display mode already does this — `container-type: inline-size` on the card plus a
  `@container` query that switches to a 2-column grid once the *card itself* is wide enough (not
  the viewport). The technique is proven; the gap is that Overview's sub-cards are separate child
  custom elements (`<dockhand-vulnerability-card>`, `<dockhand-stacks-card>`, etc.), not internal
  HTML sections of one card's own shadow DOM the way Environment's full mode has — so the query
  would need to apply to the wrapping `.env-column` div and control how its *children* lay out,
  and there's a genuine, not-yet-obvious design question about which sections should pair up side
  by side (Environment + Vulnerabilities? Stacks + Containers? something else?) rather than an
  arbitrary reflow. Also unresolved: whether an auto-spread layout can coexist with someone
  deliberately wanting their own sub-card widths respected instead — raised directly, not
  resolved. Worth trying once there's a concrete need, not speculatively.

## Interactions panel (tap_action/icon_tap_action on card name/icon) — deferred, not rejected

Considered adding Tile's own Interactions pattern (a native `type: 'expandable'` section with
`tap_action`/`icon_tap_action`, both `selector: { ui_action: {} }`) to this repo's cards, matching
Tile/Area/Heading's own editor structure. Confirmed genuinely feasible, not just plausible:
`custom-card-helpers` exports real `handleAction`/`hasAction` utilities (no hand-rolled action-
execution logic would be needed), and HA's `ui_action` selector supports an `actions` allowlist
(confirmed against `src/data/selector.ts`), so excluding `more-info`/`toggle` — neither meaningful
for a card that isn't "about" one single entity — is a real, supported option, not custom code.

**Decided to skip for now**, not because it's hard, but because the value looks low for what it'd
cost across every card. The reason Tile's version matters so much is that tapping *anywhere* on a
Tile card triggers `tap_action` — the whole card is the target. None of this repo's cards work that
way: they're entity-dense (rows, badges, a stats strip), and every one of those already has its own
specific tap behavior (open that entity's more-info). Adding `tap_action`/`icon_tap_action` here
would only ever affect two small areas — the name text and the icon badge — not "the card," the way
it does for Tile. That's a real but narrow surface, and nobody's asked for it yet; this repo's own
settings-link icon already covers the most obvious real want (jump to Dockhand).

Worth reconsidering if: a real user asks for it, or a future card design genuinely centers on one
navigable target the way Tile's `entity` does. If revisited, the shape to build is already worked
out above — `type: 'expandable'`, `ui_action` selector with `actions` filtered to exclude
`more-info`/`toggle`, `handleAction`/`hasAction` from `custom-card-helpers` for execution — this
doesn't need re-researching, just implementing.


# Backlog

Ideas and gaps already evaluated and deliberately deferred, and why — check here before
re-proposing something that might already be covered. This file is for what's **not done yet**
only. Once an item ships, remove it — the shipped behavior is what the code and `CHANGELOG.md`
already describe; this file doesn't need to also carry its history. Genuinely reusable technical
gotchas (not "this got fixed", but "here's a pattern worth remembering") belong in
`docs/architecture.md` instead.

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

## Containers / Stacks cards

- **Grouping by Dockhand tag** on the Containers and Stacks cards (filtering by tag shipped in
  2.0.0). A row can have several tags, so it would appear in several groups; not attempted yet.
- **Filter option B (add-a-filter rows)** if cards gain many more filters: Raetha likes it better
  in the long run; 2.0.0 ships option A (every filter listed) since `ha-form` can't model rows
  that choose their own field.

## Cross-card

- **A section strategy per environment** for the Dockhand dashboard (§22): Home Assistant after
  2026.8 lets a registered section strategy be picked under "Automatic section", with a preview
  (`getStubConfig`) and an editor (`getConfigElement`, needed there); 2026.8 has no picker, so it
  would be YAML-only until the minimum moves. Set aside: with settings it comes close to an
  Overview card limited to one environment, which already works in any dashboard.
- **Free layout in the Dockhand dashboard** (dragging its sections and cards around): a strategy
  writes the layout each time, so that's what **Take control** is for. Its settings cover which
  sections, their order and their settings.

- **Pill padding `3px 8px`** was tried and reverted: leave pills as they are for now. Revisit only
  as part of a wider look at pill sizing across all cards.

- **The last few percent of test coverage.** Tests render every card and editor against the
  screenshot harness's mock data and drive every control (`src/*.dom.test.ts`); `npm test` fails
  below floors set just under today's coverage (`vitest.config.ts`). What's left is mostly
  defensive early returns (no hass yet, a sensor missing in a way the integration doesn't
  produce) and layout measurement jsdom can't do. Cover them when a change touches them; raise the
  floors as tests are added.
- **Real-browser / screen-reader verification** of the keyboard interaction pattern (`tabindex`
  + `role="button"` + `@keydown` on non-`<button>` elements) — implemented per WAI-ARIA guidance
  and checked automatically by `scripts/screenshot-harness/a11y.py`, but not yet manually verified
  against NVDA/VoiceOver, which is what tells you whether the cards actually make sense read
  aloud.

- **Contrast of Home Assistant's own colors.** Status text, icons and buttons use HA's theme
  colors unchanged (deliberately — see `docs/development.md` → "Accessibility and colors"), and several fall
  below WCAG AA in HA's default light theme (warning orange is under 2:1 on white). That's for
  themes to solve, and `a11y.py` excuses it. Revisit only if HA changes its defaults or a user
  reports a case a theme can't fix.

- **Entity names from ha-dockhand are shown as Home Assistant gives them.** The control buttons'
  Redeploy / Sync from Git labels and similar come from the entity's own name, so they're only
  translated where ha-dockhand translates that entity.

- **Vulnerability findings list/table card** — the summary card shows aggregate counts only,
  matching what's cheap to poll (`/api/vulnerabilities/count`). A full findings list would need a
  much heavier ha-dockhand call (`/api/vulnerabilities` itself, paginated) and is a different
  shape of card entirely (a table, not a tile) — not attempted.

- **Card resize support (`getGridOptions`): picker-preview length isn't controllable.** No card-
  side property or CSS hook distinguishes "rendering for the add-card picker" from "rendering on
  a real, editable dashboard" — see `docs/architecture.md`. The Overview card's environments-only
  default (see README) is the accepted mitigation, not a true fix; if HA ever adds a real
  preview-scoped hook, revisit making Vulnerabilities/Stacks/Containers on-by-default again.

- **Dependency version floor: `typescript` capped below 7.0.** `typescript-eslint` cannot run
  against TypeScript 7 yet (hard crash, not a warning, as of TS 7.0's July 2026 GA — no stable
  programmatic API until 7.1, expected ~October 2026). `package.json` pins `^6.0.3`, which a
  caret range can't cross past on its own. `.github/dependabot.yml` also carries an `ignore` rule
  for `typescript >=7.0.0` (added 1.3.1) so Dependabot stops proposing the doomed bump every
  cycle. Revisit both once `typescript-eslint` adds TS7 support — see
  [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940) —
  then remove the ignore rule and let the caret range move normally.

- **Card-picker names/descriptions (`window.customCards`) can't be localized.** Not a gap on this
  repo's side — HA's own picker reads those fields as plain strings with no localization hook,
  and this is a confirmed, long-standing HA limitation
  ([home-assistant/frontend#6482](https://github.com/home-assistant/frontend/issues/6482), filed
  2020, still open). A `document.documentElement.lang`-based workaround was considered and
  rejected: unverified as an established pattern, wouldn't react to a live language change without
  a page reload, and works around a missing HA feature rather than using a real one. Revisit only
  if HA ever adds native support.

- **A single-environment Overview card given extra dashboard width (e.g. spanning 3 grid columns)
  currently just stretches, rather than spreading its sections out to use the width.** Confirmed
  against the actual CSS: `.overview` is now a CSS Grid (`repeat(auto-fill, minmax(320px, 1fr))`)
  — with *multiple* environments, `auto-fill` places each `.env-column` in its own grid column,
  filling available width. With a single environment, `auto-fill` still produces only one grid
  column and that env-column fills the full width — its children (Environment/Vulnerability/
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


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

- **Per-label colors** matching Dockhand's own label color hashing (`getLabelColors()` in
  Dockhand's frontend) — labels currently render as plain neutral pills. Cosmetic, low priority.

- **Custom mode's 8 section-checkbox labels are English-only**, unlike every other editor string
  in this repo. A deliberate scope call when Custom mode was added (a large batch of other work
  landed the same session) rather than an oversight — `mode_custom` itself did get translated
  into all 11 locales, matching every other mode entry, only the newer per-section labels
  (`CUSTOM_SECTION_LABEL` in both the Environment and Overview card editors) were left English.
  Extend the same way as any other translation gap: add each key to every locale in one pass, not
  incrementally.

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
- **Container card** doesn't currently show the image/tag or update-pending status — the Updates
  card surfaces update-pending status instead, but not the Container card itself.
- **Stack card** doesn't list member containers by name, only the count — a stack's own sensor
  only reports `container_count`, not names, so listing them would mean cross-referencing every
  container device's own attributes against the stack, a heavier lookup than anything else here.

## Cross-card

- **Real-browser / screen-reader verification** of the keyboard interaction pattern (`tabindex`
  + `role="button"` + `@keydown` on non-`<button>` elements) — implemented per WAI-ARIA guidance
  but not yet manually verified against NVDA/VoiceOver.

- **Translation coverage is editor-only (v1).** `src/common/i18n.ts` covers field labels and
  section headings across all editors, same 11 locales as ha-dockhand. Live-card-rendered text
  (e.g. "Images", "CPU", "Events", health/status words, the long mode-description hint
  paragraphs) is still English-only — a much larger string set spread across every card's render
  methods, not just editors. Extending coverage there is mechanical but sizable; do it
  incrementally, same discipline as ha-dockhand (translate a string into every locale the same
  pass it's added, never leave one partially stale).

- **Vulnerability findings list/table card** — the summary card shows aggregate counts only,
  matching what's cheap to poll (`/api/vulnerabilities/count`). A full findings list would need a
  much heavier ha-dockhand call (`/api/vulnerabilities` itself, paginated) and is a different
  shape of card entirely (a table, not a tile) — not attempted.

- **Overview card: per-environment overrides/exclusions aren't exposed in the visual editor** —
  only `exclude_device_ids` via YAML. Revisit if per-environment customization turns out to
  matter in practice.

- **Card resize support (`getGridOptions`): picker-preview length isn't controllable.** No card-
  side property or CSS hook distinguishes "rendering for the add-card picker" from "rendering on
  a real, editable dashboard" — see `docs/ARCHITECTURE.md`. The Overview card's environments-only
  default (see README) is the accepted mitigation, not a true fix; if HA ever adds a real
  preview-scoped hook, revisit making Vulnerabilities/Stacks/Containers on-by-default again.

- **Dependency version floor: `typescript` capped below 7.0.** `typescript-eslint` cannot run
  against TypeScript 7 yet (hard crash, not a warning, as of TS 7.0's July 2026 GA — no stable
  programmatic API until 7.1, expected ~October 2026). `package.json` pins `^6.0.3`, which a
  caret range can't cross past on its own. Revisit once `typescript-eslint` adds TS7 support.

# Styling & theming

Two different audiences want to customize how these cards look, and they need different tools:

- **A theme author** wants every card to pick up the theme's colors automatically, without
  editing individual dashboards. That's what the CSS custom properties below are for.
- **A single user customizing one card instance** wants [card_mod](https://github.com/thomasloven/lovelace-card-mod)
  — arbitrary CSS injected into that one card's shadow root. That's what the stable class names
  documented below are for.

Neither is meant to expose *everything* — layout, spacing, and typography are treated as
structural and just aren't hook points. If you need to change those, card_mod's plain CSS can
already reach anything in the shadow DOM; there's no reason to duplicate that with a custom
property for every pixel value.

## Theme hooks (CSS custom properties)

Defined once, on every card's `:host`, with sensible defaults — override any of these in a theme
(or in a specific dashboard/card via `card_mod`'s `style:` if you only want it in one place) and
every card in this repo picks it up:

| Property | Default | Used for |
|---|---|---|
| `--dockhand-accent-color` | `var(--primary-color)` | The header icon badge |
| `--dockhand-status-ok-color` | `var(--success-color, #22c55e)` | Running/healthy/synced/all-clear states |
| `--dockhand-status-warn-color` | `var(--warning-color, #f59e0b)` | Paused/partial/pending-update states |
| `--dockhand-status-error-color` | `var(--error-color, #ef4444)` | Stopped/unhealthy/restarting/sync-error states |
| `--dockhand-status-info-color` | `var(--info-color, #38bdf8)` | In-progress states (currently just git "syncing") |
| `--dockhand-severity-critical-color` | `#ef4444` | Vulnerability card — critical findings |
| `--dockhand-severity-high-color` | `#f97316` | Vulnerability card — high findings |
| `--dockhand-severity-medium-color` | `#ca8a04` | Vulnerability card — medium findings |
| `--dockhand-severity-low-color` | `#3b82f6` | Vulnerability card — low findings |

The four status colors each default to HA's own native theme color (`--success-color`,
`--warning-color`, `--error-color`, `--info-color`) — override those in your theme and every card
here picks it up the same way any other HA card would, without needing dockhand-specific support
for it. The `dockhand-status-*` name itself exists only so this repo's own many usage sites read
`var(--dockhand-status-error-color)` once each, rather than repeating `var(--error-color, #ef4444)`
(HA's own name plus this repo's own fallback) at every one of them — override
`--dockhand-status-error-color` directly instead if you want a color specific to this card family
without also changing HA's own error color everywhere else.

Example, in a theme YAML:

```yaml
my_theme:
  error-color: "#dc2626"
  dockhand-accent-color: "#8b5cf6"
```

Or scoped to one card via card_mod:

```yaml
type: custom:dockhand-environment-card
device_id: env_5
card_mod:
  style: |
    :host {
      --dockhand-accent-color: #8b5cf6;
    }
```

What's deliberately **not** a custom property: the connection-type icon colors (socket/direct/
Hawser) on the environment card header — those are fixed brand-style indicators for a specific
connection kind, not a severity/status, so they don't belong in the same semantic set as the
properties above. Override them with card_mod if you really want to (see below).

## card_mod hooks (stable class names)

Every card's structure uses plain, stable class names — no CSS Modules, no generated/hashed
class names — specifically so card_mod selectors keep working across releases unless a class is
explicitly renamed (which would be called out in the CHANGELOG as a breaking change). A few
useful ones:

- `.card-header`, `.header-left`, `.header-right`, `.card-badge`, `.truncate` — the header row,
  common to every card: the icon badge, the card's own name (and subheader, where one exists)
  truncating with an ellipsis rather than wrapping, and whatever sits on the right (a header-icon:
  an update chip, a feature toggle, the Dockhand link). Genuinely separate classes from
  `.row-left`/`.row-right` (below) despite looking almost identical — briefly merged into them
  earlier this same session, then split back out once merging turned out to also merge their gap
  values, which broke once `.header-icon` gained its own 32×32 clickable footprint (see
  `docs/ARCHITECTURE.md` §11 for the fuller reasoning).
- `.clickable` — the shared hover/focus treatment (a faint background tint, plus cursor/outline),
  additive on top of whatever class gives an element its own identity/meaning — `.row.clickable`,
  `.hero-word.clickable`, `.header-icon.clickable`, and so on; never a replacement for that
  identity class, always paired with one
- `.section`, `.section-title` — a labeled sub-section (detailed mode's own resource sections, the
  stack card's own git-sync details, and others) — one shared shape for all of them now, not a
  separate copy per card
- `.stacked-pair` — a metric's own label+value row paired with its own visual representation below
  it (a progress bar, or a history sparkline) — the tight unit the two form together, distinct from
  `.section`'s own looser spacing between one metric and the next
- `.hero-row` / `.hero-word` — a card's own single most prominent value, centered, larger text (a
  container's own state, a stack's own status) — `.hero-row` is the outer, padded row; `.hero-word`
  is the text/icon itself, independently clickable where it has a real entity to link to
- `.row`, `.row-left`, `.row-right` — a card's own basic list row shape, content at both ends
  (`.row-left` the row's own icon+name, `.row-right` its own value or secondary label), used
  throughout every list-shaped card
- `.item-name` — a row's own primary name text, truncating with an ellipsis the same way a header's
  own name does
- `.label-pill` — a small rounded label (a stack/container type, a custom environment label) —
  shared by every card that has one, see `docs/ARCHITECTURE.md` §10
- `.header-icon` — every header icon on every card, clickable or genuinely static, either side of
  the header: an update chip, a feature toggle, the Dockhand link, and Environment's own
  connection-type icon (merged in from a former separate `.conn-icon`) — all one shared shape and
  treatment, so they visually line up and behave identically regardless of what each one is or
  does. `.link-unavailable` is the Dockhand link's own muted, non-interactive state when no usable
  URL could be resolved — additive, so a rule targeting `.header-icon` alone still matches this
  state too.
- `.row-icon` — a small, non-shrinking icon+optional-text badge on a list row, position-neutral
  (used both as a row's own standalone content, and nested inside `.row-right` as one of several
  trailing badges), clickable or genuinely static (a metric row's own "CPU"/"Memory" label) —
  shared by every list-shaped card, see `docs/ARCHITECTURE.md` §18
- `.stat` — a small icon+count summary badge, always static (a container-state count, a
  schedule-run outcome count) — see `docs/ARCHITECTURE.md` §18
- `.status-banner` — a colored status indicator, one prominent card-level message with its own
  text; always paired with a `.ok`/`.warn`/`.error`/`.accent` modifier class for which color —
  same shared definition, §10 again
- `.card-message` — the shared shape for any message taking over a card (or a card's own body) in
  place of its normal content: a required entity missing, an entity not yet available (the "would
  show more with these entities enabled" case), nothing to show yet, or a positive "all clear"/"up
  to date" state — every card that has one of these uses this same class; `.warn`/`.error` modifier
  classes for color, no modifier for the neutral/positive case
- `.divider` — a thin horizontal separator line between two sections/rows, placed by whichever
  card composes them together (never owned by an individual section itself) — see
  `docs/ARCHITECTURE.md` §11's own note on `joinWithDividers()`/`mergeSections()`

Example — make every clickable header icon on one card instance a bit larger and more visible:

```yaml
type: custom:dockhand-environment-card
device_id: env_5
card_mod:
  style: |
    .header-icon ha-icon {
      --mdc-icon-size: 28px;
    }
```

Note that `.header-icon` deliberately matches *every* icon rendered with that class together —
clickable ones on either side of the header (an update chip, a feature toggle, the Dockhand link,
Environment's own connection-type icon) and genuinely static ones — a genuine trade-off of keeping
them one shared, consistent shape rather than each its own class: a card_mod rule can't target
just one of them in isolation without also matching whatever else is there. Add a more specific
selector (e.g. `title="..."`, since each one's own tooltip text differs) if you need to reach just
one. `.card-badge` is a genuinely separate class (a card's own fixed header badge) — a rule
targeting `.header-icon` alone won't reach it, even though both are generated by the same
underlying `renderIcon()` function.

Full per-card class lists are easiest to read straight from each card's `styles.ts` — they're
short, flat, and not worth duplicating here in a way that will drift out of sync. For a
comprehensive reference covering every class in the repo (including ones not meant as public
`card_mod` hooks), see `docs/ARCHITECTURE.md` §18.

## Periodic cross-card consistency sweep

Shared concepts (icon+text pairing, status text size, chip padding) belong in `shared-styles.ts`
once 2+ cards use them — see that file's own comment on the policy. But file placement alone
doesn't catch drift: two cards can each correctly follow the shared pattern individually and still
disagree with each other (e.g. the Container/Stack hero-word size mismatch, or an early version of
`.hero-word` missing `display:flex` entirely while every sibling icon+text class had it) — this
happens one card at a time, in different sessions, so no single diff makes it visible.

What actually catches this is periodically generating screenshots for all cards via
`tools/screenshot-harness/` and looking at them side by side, deliberately checking whether the
same *kind* of element (a status word, an icon+text row, a small badge/chip, a section header)
looks the same across every card that has one — not just whether each card looks right in
isolation. Worth doing this before any release that touches shared visual elements, not only when
something already looks obviously wrong.

The same kind of drift can happen to the documentation itself, not just the CSS — a class gets
renamed or consolidated during real work, but the doc describing it doesn't get updated in the
same pass, and nothing catches the mismatch until someone goes looking for a class that no longer
exists. Periodically re-running the extraction this table (`docs/ARCHITECTURE.md` §18) was built
from — every class actually defined in `shared-styles.ts` and each card's own `styles.ts`,
cross-checked against real template usage — and diffing that against what the docs currently claim
is a direct, mechanical way to catch this, rather than relying on remembering to update prose by
hand every time a rename happens.


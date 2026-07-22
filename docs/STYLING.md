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
| `--dockhand-status-ok-color` | `#22c55e` | Running/healthy/synced/all-clear states |
| `--dockhand-status-warn-color` | `#f59e0b` | Paused/partial/pending-update states |
| `--dockhand-status-error-color` | `#ef4444` | Stopped/unhealthy/restarting/sync-error states |
| `--dockhand-status-info-color` | `#38bdf8` | In-progress states (currently just git "syncing") |
| `--dockhand-severity-critical-color` | `#ef4444` | Vulnerability card — critical findings |
| `--dockhand-severity-high-color` | `#f97316` | Vulnerability card — high findings |
| `--dockhand-severity-medium-color` | `#ca8a04` | Vulnerability card — medium findings |
| `--dockhand-severity-low-color` | `#3b82f6` | Vulnerability card — low findings |

Example, in a theme YAML:

```yaml
my_theme:
  dockhand-status-error-color: "#dc2626"
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

- `.header`, `.icon-badge`, `.name`, `.status-icons` — the header row, common to every card
- `.clickable` — anything that opens an entity's more-info dialog; safe to restyle hover/focus
  behavior on
- `.section`, `.section-title` — the labeled sub-sections in detailed mode / the stack card's git
  section
- `.unavailable-hint` — the "would show more with these entities enabled" banner

Example — hide the settings gear link entirely on one card instance without turning off
`show_settings_link` for automations/scripts that might check it:

```yaml
type: custom:dockhand-environment-card
device_id: env_5
card_mod:
  style: |
    .settings-link {
      display: none;
    }
```

Full per-card class lists are easiest to read straight from each card's `styles.ts` — they're
short, flat, and not worth duplicating here in a way that will drift out of sync.

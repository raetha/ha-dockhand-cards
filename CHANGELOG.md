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

## [Unreleased]

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

[Unreleased]: https://github.com/raetha/ha-dockhand-cards/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/raetha/ha-dockhand-cards/releases/tag/v1.0.0

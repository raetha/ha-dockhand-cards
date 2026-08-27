import { css } from 'lit';

/**
 * Shared styles for every card's own rendered output (not editors — see
 * editor-styles.ts for those). Spacing values that land exactly on HA's
 * own --ha-space-* scale use that token (with the current pixel value as
 * fallback), the same reasoning as editor-styles.ts's own use of them —
 * this repo's spacing then tracks whatever HA's scale actually resolves
 * to, automatically, rather than silently drifting from HA's current
 * values if that scale is ever revisited. Not every spacing value here
 * lands on that scale (6px/10px/2px/etc. don't correspond to any real HA
 * token), and those are left as plain pixel values rather than forced
 * onto the nearest token — they're this repo's own genuine choices, not
 * approximations of something HA also does.
 */
export const sharedStyles = css`
  :host {
    /*
     * Customization hooks — see docs/STYLING.md. These are the only
     * values a theme is expected to override; layout/spacing/typography
     * are left as plain CSS and are card_mod's job, not a theme's.
     */
    --dockhand-accent-color: var(--primary-color);
    --dockhand-status-ok-color: var(--success-color, #22c55e);
    --dockhand-status-warn-color: var(--warning-color, #f59e0b);
    --dockhand-status-error-color: var(--error-color, #ef4444);
    --dockhand-status-info-color: var(--info-color, #38bdf8);
    --dockhand-severity-critical-color: #ef4444;
    --dockhand-severity-high-color: #f97316;
    --dockhand-severity-medium-color: #ca8a04;
    --dockhand-severity-low-color: #3b82f6;
  }

  ha-card {
    padding: var(--ha-space-4, 16px);
    overflow: hidden;
    /* Matches the convention most custom HA cards use — primary-text-color
     * as the real default for everything, set once here rather than
     * repeated on every individual class that wants it, with
     * secondary-text-color reserved for content genuinely meant to read
     * as de-emphasized (Environment's own hostname:port subtitle, a
     * status word's own inactive/muted states like "exited"/"created").
     * card_mod/theme targeting is unaffected: this is a real CSS custom
     * property, so a theme swapping --primary-text-color still flows
     * through, and a card_mod rule targeting a specific class still
     * overrides this the same way it always could. */
    color: var(--primary-text-color);
  }
  /* Renamed from .header to disambiguate from .group-header (a list
   * card's own per-group label) — the two read as unrelated concepts
   * despite the similar name, and this removes that ambiguity. */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ha-space-2, 8px);
    font-weight: 500;
    font-size: var(--ha-font-size-m, 14px);
  }
  .card-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgb(from var(--dockhand-accent-color) r g b / 0.1);
    flex-shrink: 0;
  }
  .card-badge ha-icon {
    color: var(--dockhand-accent-color);
  }
  /* The foundational shape for any card's own "left group" — a header's
   * icon-badge + name, or a list row's own leading icon + name/pill —
   * flex, explicitly vertically centered rather than relying on
   * flexbox's own default (stretch), plus the standard 8px gap every
   * current usage needs. Previously two separate classes (.header-left,
   * .row-left) differing only in .header-left's own flex: 1 — tested
   * directly against a real, overflowing header before merging, and
   * confirmed to make zero visible difference (identical width with
   * and without it): space-between already positions the two groups
   * regardless, and min-width: 0 here already does the actual work of
   * letting a child (a name, an item-name) shrink and truncate when
   * space is tight. Not carried into this merged class, since it
   * wasn't doing anything to carry. */
  .row-left {
    display: flex;
    align-items: center;
    gap: var(--ha-space-2, 8px);
    min-width: 0;
  }
  /* Genuinely separate from .row-left/.row-right (below), not a
   * duplicate: a card header's own icon group needs a different gap
   * math specifically because .header-icon's own 32x32 clickable
   * footprint centers a 24px icon inside it, leaving 4px of invisible
   * padding on every side. Two adjacent .header-icon boxes with the
   * standard 8px flex gap between them would put 16px between the
   * actual, visible icon glyphs (4px padding + 8px gap + 4px padding),
   * not 8px — confirmed directly this was happening. gap: 0 here means
   * the boxes' own 4px+4px padding alone produces exactly 8px between
   * the visible glyphs, matching the same 8px standard every other
   * constantly-visible pairing already uses, just measured from the
   * glyphs rather than the boxes (which have no visible background of
   * their own except on hover/focus). */
  .header-left,
  .header-right {
    display: flex;
    align-items: center;
  }
  .header-left {
    gap: var(--ha-space-2, 8px);
    min-width: 0;
  }
  /* Only Environment card's own connection-type icon ever sits inside
   * .header-left (every other card's own .header-left is just
   * .card-badge + text, correctly served by the standard 8px gap
   * above) — a targeted, scoped adjustment rather than changing
   * .header-left's own gap globally, which would incorrectly pull
   * .card-badge and plain text 4px closer everywhere else too. Pulls
   * the connection-type icon 4px closer on each side specifically,
   * compensating for .header-icon's own 4px of invisible padding
   * (32x32 box, 24px icon centered inside) on whichever side faces a
   * neighbor here — the same reasoning as .header-right below, just
   * scoped to this one, single-usage context instead of applied via
   * gap since .header-left's other pairing (.card-badge to text) needs
   * the full, uncompensated 8px. */
  .header-left .header-icon {
    margin: 0 -4px;
  }
  /* 0, not the standard 8px like .header-left above — every pairing
   * here is two adjacent .header-icon boxes, each independently
   * contributing 4px of their own padding on the side facing the
   * other, so 4+0+4 already totals 8px between the visible icon
   * glyphs without the gap itself adding anything on top. */
  .header-right {
    gap: 0;
    flex-shrink: 0;
  }
  /* Stack card's own header-right mixes a .label-pill (its own type
   * badge) with .header-icon — the opposite problem from .header-left
   * above: .label-pill has no invisible padding of its own at all, so
   * .header-right's own gap:0 (correct for two adjacent .header-icon
   * boxes) would put only 4px between the pill and the next icon glyph
   * (0 gap + .header-icon's own 4px left padding), not 8px. This adds
   * the missing 4px back specifically after a pill in this context. */
  .header-right .label-pill {
    margin-right: 4px;
  }
  /* Excluded from the shared context-padding rule below (.body > *) so
   * the two never compete for the same element at all — its own
   * padding here is genuinely larger and intentional (12px, not the
   * standard 4px), for the single most prominent value on a card. */
  .hero-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--ha-space-2, 8px);
    padding-top: 12px;
    padding-bottom: 12px;
    font-size: var(--ha-font-size-2xl, 24px);
    font-weight: 600;
  }
  /* Shared by any single-line text that needs to truncate with an
   * ellipsis rather than wrap or overflow (a card's own name, its
   * subheader) — genuinely can't live on an ancestor instead, since
   * these properties describe how *this specific* line of text
   * overflows its own box, not something a mixed-content parent (an
   * icon plus a name plus a subheader) could meaningfully inherit. */
  .truncate {
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card-subheader {
    color: var(--secondary-text-color);
    font-size: var(--ha-font-size-xs, 10px);
    font-weight: 400;
    display: block;
  }
  /* Additive modifier, not a replacement for .header-icon — used when
   * show_settings_link is on but the URL couldn't be resolved, so it
   * reads as "something's misconfigured" rather than silently looking
   * identical to the toggle being off — hiding both cases the same way
   * was the actual source of real confusion (a user enabling the
   * toggle and then seeing nothing, indistinguishable from the feature
   * being off, with no indication anything needed fixing). Named
   * specifically link-unavailable (not the more generic .unavailable)
   * since .header-icon also covers non-link feature-toggle icons,
   * where "unavailable" alone would be ambiguous about what's actually
   * wrong. */
  .header-icon.link-unavailable {
    cursor: default;
    opacity: 0.5;
    color: var(--secondary-text-color);
  }
  /* A persistent, visible background — genuinely different from every
   * other .header-icon, which only ever shows a background on hover.
   * Used for the one header-icon that needs to stand out as a real,
   * prominent action (Updates card's own "Update all") rather than
   * blend in with the other, more incidental header icons around it.
   * Also switches from the fixed 32x32 square every other header-icon
   * uses to auto width + horizontal padding, since this is the one
   * case where a header-icon carries real text alongside its own icon,
   * not just an icon alone. */
  .header-icon.filled {
    width: auto;
    height: 32px;
    padding: 0 var(--ha-space-3, 12px);
    gap: var(--ha-space-1, 4px);
    background: var(--dockhand-accent-color);
    color: white;
    font-size: var(--ha-font-size-s, 12px);
    font-weight: 500;
  }
  .header-icon.filled:hover {
    opacity: 0.85;
  }
  .header-icon.filled.link-unavailable {
    opacity: 0.5;
  }
  /* Same mixed-content gap issue as .header-left/.header-right's other
   * targeted fixes above: .filled has real, visible padding of its own
   * (not the invisible kind a plain .header-icon's 32x32 box has), so
   * .header-right's own gap:0 only gets one side's worth of
   * compensation when a .filled button sits next to a plain
   * .header-icon, producing 4px between them instead of 8px. */
  .header-right .header-icon.filled {
    margin-left: 4px;
  }
  /* The loading-spinner state real ha-button provided natively — no
   * existing spin pattern anywhere else in this codebase to reuse
   * (confirmed via search), so this is a new, minimal one: just
   * rotates whatever icon it's applied to, indefinitely, while a
   * check/update request is in flight. */
  @keyframes header-icon-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  .header-icon.spinning ha-icon {
    animation: header-icon-spin 1s linear infinite;
  }
  .body {
    display: flex;
    flex-direction: column;
  }
  /* The core spacing mechanism: every direct child of .body/.section
   * (including a display:contents .list's own children, which
   * layout-participate in the grandparent directly but are still
   * grandchildren in the actual DOM tree the > selector matches
   * against, so need their own explicit target here too — same for
   * .grid-2's own children, a real grid box rather than a
   * display:contents one, but still not reached by .body > * itself)
   * gets 4px of its own top/bottom padding — two adjacent rows combine
   * to the standard 8px entirely through padding, not gap (.body/
   * .section/.grid-2 never declare one at all). This also means every
   * row, clickable or not, already has the same padding a click
   * target would want, with nothing extra needed specifically for
   * that purpose. A row needing more than the standard 8px (.hero-row)
   * overrides this padding directly with its own larger, documented
   * value instead of this default. */
  /* .section/.grid-2 excluded here deliberately — both are real, sized
   * containers (unlike .list, which is display:contents and has no box
   * of its own at all), so matching them here as well as via their own
   * more-specific rule below (.section > *, .grid-2 > *) would double
   * their own contribution: once for the container itself as a .body
   * child, and again for its own first child one level in — 8px of
   * internal padding before content even starts, not the intended 4px.
   * Their own children still correctly get the standard 4px via the
   * more-specific rule immediately below. */
  /* .divider excluded here too, alongside .section/.grid-2 above, for a
   * different but related reason — it isn't a spacing-double-counting
   * risk (it's a leaf, no children of its own), but a genuine CSS
   * specificity bug: this selector (.body > *:not(...), three classes)
   * is more specific than .divider's own bare-class rule (one class),
   * so without this exclusion it was winning and silently overriding
   * .divider's own intended padding:0 with padding:4px — landing
   * wrongly *after* the line (padding comes after border in the box
   * model) on top of .divider's own correct margin, roughly doubling
   * the gap after every divider on the page. */
  .body > *:not(.section):not(.grid-2):not(.divider):not(.hero-row),
  .section > *,
  .list > *,
  .grid-2 > * {
    padding-top: 4px;
    padding-bottom: 4px;
  }
  /* Two independent, self-contained rows side by side, sharing one
   * visual row rather than stacking (Container's own Network RX/TX and
   * Block read/write, Environment's own resource-count grid) — the one
   * genuine case that isn't "push some content left, some right,
   * within one row" (.row) or "centered" (.hero-row). Deliberately not
   * using CSS subgrid here (see .list, above) — each item is
   * self-contained and doesn't need to align its own internal columns
   * with its neighbor, just occupy one of two cells, so a plain grid
   * is all this needs. */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: var(--ha-space-4, 16px);
  }
  .clickable {
    cursor: pointer;
    outline: none;
    border-radius: 6px;
  }
  /* :not(:has(.clickable:hover)) — an outer clickable element (a whole
   * row, or ha-card itself for Vulnerability's own whole-card click)
   * suppresses its own hover feedback specifically when the mouse is
   * over one of its own nested clickable children instead (a row-icon
   * badge, a label-pill, a header-icon) — without this, both the outer
   * and inner elements would show their own hover background
   * simultaneously whenever the inner one is hovered (since the mouse
   * is, physically, also over the outer element the whole time),
   * making it genuinely unclear which one would actually receive the
   * click. The inner element's own .clickable:hover rule still applies
   * normally either way — this only ever suppresses the outer one. */
  .clickable:hover:not(:has(.clickable:hover)) {
    background: rgb(from var(--primary-color) r g b / 0.08);
    opacity: 0.8;
  }
  /* For the rare case of the outer <ha-card> itself being the clickable
   * target (Vulnerability card's own whole-card click, rather than a
   * smaller element inside it) — matches the card's own, larger
   * theme-driven corner radius instead of .clickable's own fixed 6px,
   * which would give the hover overlay visibly mismatched corners. */
  ha-card.clickable {
    border-radius: var(--ha-card-border-radius, 12px);
  }
  .clickable:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  /* A deliberately larger clickable footprint (32x32) than the icon
   * itself needs (left at HA's own native, unmodified default size —
   * no --mdc-icon-size override here at all) — the icon is centered
   * within this larger box via display:flex + justify/align-content,
   * rather than the box being exactly icon-sized with zero padding as
   * it was before. Confirmed directly (a real render, before/after
   * measurement) that this size increase doesn't disturb the standard
   * 8px gap between the header and the divider below it at all — that
   * spacing comes from .body's own context-padding rule plus the
   * divider's own margin, both independent of header content height.
   * Also the shape for Environment's own connection-type icon (a
   * card's own header-left content, not header-right — position comes
   * entirely from wherever it's placed in the DOM, not from this
   * class) — merged from what was once a separate .conn-icon class, once
   * nothing distinguished them but a stray flex-shrink:0, folded in
   * below rather than kept as a second, near-identical class. */
  .header-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }
  .header-icon.ok {
    color: var(--dockhand-status-ok-color);
  }
  .header-icon.warn {
    color: var(--dockhand-status-warn-color);
  }
  .header-icon.error {
    color: var(--dockhand-status-error-color);
  }
  .header-icon.accent {
    color: var(--dockhand-accent-color);
  }
  .header-icon.neutral {
    color: var(--secondary-text-color);
  }
  .label-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--ha-space-2, 8px);
  }
  /** The one pill shape used everywhere a small rounded label appears —
   * a stack/container type, an environment/stack custom label, anything
   * of that shape (see ARCHITECTURE.md §11 for the shared-class
   * rationale). Color is the one thing callers still set themselves
   * (inline style, for label-pill's own user-defined label colors) —
   * everything about the *shape* stays fixed here.
   *
   * border-radius uses HA's own --ha-border-radius-pill (9999px, a true
   * pill/capsule shape) rather than a hand-picked rounded-rectangle
   * value, matching what ha-automation-row-event-chip.ts uses for this
   * same kind of small text chip. */
  .label-pill {
    display: inline-flex;
    align-items: center;
    gap: var(--ha-space-1, 4px);
    padding: 2px 8px;
    min-height: 12px;
    border-radius: var(--ha-border-radius-pill, 9999px);
    font-size: var(--ha-font-size-s, 12px);
    line-height: 1;
    font-weight: 500;
    background: var(--divider-color);
    flex-shrink: 0;
  }
  .label-pill ha-icon {
    --mdc-icon-size: 12px;
  }
  /* The shared shape for any message that takes over a card (or a
   * card's own body) in place of its normal content — a required
   * entity missing entirely, an entity not yet available, nothing to
   * show yet, or a positive "all clear"/"up to date" state. Every card
   * that has one of these uses this same class, rather than each
   * carrying its own copy with its own font-size/icon-size decisions —
   * deliberately no explicit font-size (matches standard HA text) or
   * icon --mdc-icon-size (matches ha-icon's own 24px default), per
   * direct instruction that these should look like ordinary HA content,
   * not a smaller/quieter aside. */
  .card-message {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--ha-space-2, 8px);
    min-width: 0;
  }
  .card-message span {
    min-width: 0;
    overflow-wrap: break-word;
  }
  .card-message ha-icon {
    flex-shrink: 0;
  }
  .card-message.warn {
    color: var(--dockhand-status-warn-color);
  }
  .card-message.error {
    color: var(--dockhand-status-error-color);
  }
  /* The three "content header" variants share exactly two properties
   * (font-size, color) — extracted into one comma-selector group rather
   * than tripled across three separate rules, the same pattern
   * .status-icon/.status-banner's own shared color modifiers use. What's
   * NOT shared stays separate deliberately: each variant's remaining
   * properties serve a real structural difference (.section-title's own
   * icon needs flex/gap layout the other two have no icon to lay out;
   * .group-header's own uppercase/letter-spacing is what makes it read
   * as a divider rather than a label; .column-title's own minimal
   * padding fits a column-header context neither of the other two is
   * used in) — three class *names* because three real shapes, one
   * shared rule because two real properties happen to be identical
   * across all three. */
  .section-title,
  .group-header,
  .column-title {
    font-size: var(--ha-font-size-s, 12px);
    font-weight: 500;
    line-height: 1;
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: var(--ha-space-1, 4px);
  }
  .section-title-value {
    margin-left: auto;
    font-weight: 500;
  }
  /* A plain-text header for a column of content, not a labeled section
   * with its own icon the way .section-title is — used for Overview's
   * own per-environment column headers. Named generically (not
   * env-specific) since nothing about this class is actually tied to
   * environments; any card arranging content into labeled columns could
   * reuse it. */
  .column-title {
    padding: 0 4px;
  }
  .bar-track {
    height: 6px;
    border-radius: 3px;
    background: var(--divider-color);
    overflow: hidden;
  }
  /* Wraps a metric-line + its own bar-track (or, on Environment's own
   * history-chart section, a chart-header + its own sparkline) as one
   * tight unit — a label and its own visual representation of the same
   * value, which should read close together, distinct from the looser
   * spacing .section's own gap provides between one metric group and
   * the next. */
  .stacked-pair {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  .bar-fill.ok {
    background: var(--dockhand-status-ok-color);
  }
  .bar-fill.warn {
    background: var(--dockhand-status-warn-color);
  }
  .bar-fill.error {
    background: var(--dockhand-status-error-color);
  }

  /* The list mechanism — two shapes, for two genuinely different needs.
   *
   * .list: no column alignment across rows (Stacks/Containers, plural,
   * list cards — each row's own badge count varies, so there's no
   * consistent set of columns to align in the first place, and — per
   * direct instruction — for column-aligned lists too (Schedules,
   * Updates, Recent Events, Top Containers), abandoning subgrid-based
   * cross-row column alignment for simplicity: rows just group their
   * own left/right content via .row's own justify-content, rather
   * than sharing column tracks across the whole list. No box of its
   * own — its rows become effectively direct children of whatever
   * actually wraps them (.body/.section), getting the standard
   * context padding above via the .list > * selector there, same as
   * any other row would. */
  .list {
    display: contents;
  }
  /* The large, prominent status text at the top of a single-device card
   * (a container's own state, a stack's own status) — inherits its own
   * font-size/weight from the outer .hero-row wrapper it's always used
   * within, rather than declaring its own; see ARCHITECTURE.md §11 for
   * the shared-class rationale. */
  .hero-word {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-transform: capitalize;
    /* line-height: 1 for the same reason .stats-row .stat uses it —
     * default line-height leaves invisible space above/below the actual
     * glyphs, which this element's own larger inherited font-size
     * (.hero-row's own -2xl) and 24px icon make noticeable next to a
     * plain, smaller-text sibling. */
    line-height: 1;
  }
  /* Consolidates what were 8 near-identical rules duplicated locally
   * across Stack and Container (4 each — the same ok/warn/error/neutral
   * roles, just with different state-name vocabularies: Stack's own
   * running/partial/stopped/created vs. Container's own
   * running/paused/restarting/exited+dead). Each card maps its own raw
   * state string to one of these four canonical names via a small
   * local lookup table (see STACK_STATUS_CLASS/CONTAINER_STATE_CLASS in
   * common/const.ts), the same pattern HEALTH_STATUS_CLASS already
   * established for Container's own health chip — the state value
   * itself stays unchanged anywhere it's still shown as text or used
   * as an icon lookup key; only the CSS class benefits. */
  .hero-word.ok {
    color: var(--dockhand-status-ok-color);
  }
  .hero-word.warn {
    color: var(--dockhand-status-warn-color);
  }
  .hero-word.error {
    color: var(--dockhand-status-error-color);
  }
  .hero-word.neutral {
    color: var(--secondary-text-color);
  }
  /* The standard data-row shape — icon+label pushed to one side, an
   * optional value pushed to the other (space-between naturally has no
   * visible effect with only one child, so this is safe even for
   * label-only rows with nothing on the right). Covers what were
   * previously two separate classes (.split-row + .item-row) — in
   * practice every row in this repo either wants both behaviors
   * together or neither, so there was no real case that needed one
   * without the other. .row-left (above) stays separate for a
   * different role: the tightly-grouped "left group" nested *within*
   * a .row (an icon + name + optional pill(s) together, with the row's
   * own value still pushed to the far side) rather than a standalone
   * space-between row on its own — the same shape a card's own header
   * uses too, merged from what was once a separate .header-left. */
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ha-space-2, 8px);
    font-size: var(--ha-font-size-s, 12px);
  }
  /* An icon + label — for a data point's own name
   * (CPU/Memory on the Environment card, an I/O stat on the Container
   * card) equally as for a trailing metric/count value on a row (a
   * stack's container count, a container's CPU%, the Environment card's
   * own top-container CPU/memory readout). Both roles are the same
   * shape, so they're the same class. Named generically (not
   * "resource-"/"io-"/"item-" prefixed) since it's not specific to any
   * one card's own data; a bare .label would risk the same kind of
   * accidental collision a plain, unscoped class name always risks
   * once reused across several cards' own templates (see
   * ARCHITECTURE.md §11).
   *
   * Color modifiers (.ok/.warn/.error/.accent) match .status-icon/
   * .status-banner's own convention exactly, not a separate naming
   * scheme — a card whose own state value doesn't already match one of
   * these four names should map it to the canonical name in a small
   * local lookup table (see Container's own HEALTH_STATUS_CLASS in
   * common/const.ts for the pattern) rather than adding a fifth
   * modifier. */
  .row-icon {
    display: flex;
    align-items: center;
    gap: var(--ha-space-1, 4px);
    flex-shrink: 0;
    line-height: 1;
  }
  /* 16px — the one size every list row's own icon should share by
   * default (this rule, and .row, which any list-row icon that isn't
   * inside a .row-icon also falls under — a bare ha-icon with class
   * "row-icon ..." and no wrapping span still gets both this sizing
   * and its own color modifiers directly, same as one wrapping
   * icon+text). A new row type gets this automatically rather than
   * needing its own one-off size class. Specific icons that are
   * deliberately NOT this size (a card's own header icon, its
   * state/status row) live
   * outside both of these entirely, so they're genuinely unaffected
   * rather than needing an explicit exclusion. */
  .row-icon ha-icon,
  .row-icon ha-state-icon,
  .row ha-icon,
  .row ha-state-icon {
    --mdc-icon-size: 16px;
    flex-shrink: 0;
  }
  .row-icon.ok {
    color: var(--dockhand-status-ok-color);
  }
  .row-icon.warn {
    color: var(--dockhand-status-warn-color);
  }
  .row-icon.error {
    color: var(--dockhand-status-error-color);
  }
  .row-icon.accent {
    color: var(--dockhand-accent-color);
  }
  .row-icon.neutral {
    color: var(--secondary-text-color);
  }
  /* A secondary bit of metadata at the end of a row (Schedules' own
   * next-run time, Updates' own version info) — and a card header's own
   * right-side content (the Dockhand link, an update chip, feature
   * toggles). Previously two separate, identical classes (.header-right,
   * .row-right); merged once there was nothing left distinguishing
   * them. */
  .row-right {
    display: flex;
    align-items: center;
    gap: var(--ha-space-2, 8px);
    flex-shrink: 0;
    line-height: 1;
  }
  /* No explicit color here — ha-card's own default (top of this file)
   * already makes this primary-text-color, matching every other
   * row-level element (.row-icon/.row-right/.section-title/etc.)
   * without needing to restate it individually. A row's own name, its
   * value, and the section header introducing it all read as the same
   * weight now — content underneath a header isn't quieter than the
   * header itself, matching how most other custom HA cards handle this
   * (secondary-text-color stays reserved for content genuinely meant to
   * de-emphasize, not as the general row-content default). */
  .item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1;
  }
  /* Icon+count summary row (Environment card's container stats,
   * Schedules card's status counts) — spread evenly across the full card
   * width via flex, not a fixed-column grid: a grid needs its column
   * count kept in sync with however many stats a given card shows, which
   * is a foot-gun (Environment has 7, Schedules has 5, and either could
   * change independently) and also left each .stat left-anchored within
   * its own equal-width column rather than centered, which is what made
   * icons/counts look inconsistently aligned across the row — fixed here
   * by centering each .stat's own content instead of relying on grid-cell
   * default alignment. flex+space-between doesn't need a column count at
   * all, so this scales to any number of stats without further changes. */
  .stats-row .stat {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--ha-space-1, 4px);
    line-height: 1;
  }
  /* A standalone class, not scoped under any ancestor (e.g. not
   * .stats-row .stat .group-header) — an over-scoped selector that only
   * works nested several levels deep in one specific card's own layout
   * doesn't read as something safe to reuse elsewhere, which is exactly
   * why this shape had drifted into multiple local copies before being
   * unified here (see ARCHITECTURE.md §11). */
  /* Moved here from the Schedules card's own styles.ts once Stacks
   * needed the identical thing for its own new group_by support —
   * shared, not duplicated, the same principle this repo already
   * applies to editor code (docs/EDITOR_DESIGN.md rule 5's own
   * reasoning). Same font-size as .section-title (Environment card's
   * own content-header style, below) — both are the same concept, a
   * header for a chunk of content, one just happens to be a group
   * divider rather than an icon-prefixed section label. Sentence case
   * (not uppercase) to match every other header in this repo — card
   * names, section titles, column titles are all Sentence case, and an
   * all-caps group header next to those looked like a different design
   * system, not a deliberate distinction.
   *
   * The line between one content block and the next — a genuinely
   * reusable concept on its own, not tied to .section/.group-header
   * specifically (an untitled content block, like a card's own health
   * banner or resource grid, can want the same line without needing
   * .section's own "group multiple children together" semantics at
   * all). Deliberately owns no spacing of its own beyond the line —
   * per direct instruction, a divider composes into the standard 8px
   * row-to-row rhythm the same as any other transition, not a bigger,
   * separate break; the standard context padding (.body > * etc.,
   * above) already gives it that. */
  /* margin, not padding — border-top sits at the very top of the box,
   * before any padding, so padding here would only ever create space
   * below the line (between it and .divider's own empty content), not
   * above it. Margin sits outside the border, so margin-top correctly
   * lands before the line and margin-bottom after — combining with the
   * standard 4px each neighbor already contributes (.body > * etc.,
   * above) for the intended, symmetric 8px on each side. Padding is
   * explicitly zeroed since .divider otherwise inherits the standard
   * 4px context padding too, which would land in the wrong place. */
  .divider {
    margin: 4px 0;
    padding-top: 0;
    padding-bottom: 0;
    border-top: 1px solid var(--divider-color);
  }
  .divider:first-child {
    display: none;
  }
  .section {
    display: flex;
    flex-direction: column;
  }
  .group-header {
    letter-spacing: 0.03em;
    padding-left: 4px;
    padding-right: 4px;
    margin-bottom: 6px;
  }
  /* .status-banner: a single, prominent card-level message (environment
   * health, vulnerability all-clear) — larger, always carries its own
   * background wash alongside color, via a .ok/.warn/.error/.accent
   * modifier (the same four semantic names read consistently across
   * every icon-class tier in this file, not reinvented per shape).
   *
   * There used to be a second, smaller "status icon" tier alongside
   * this one (.status-icon — a container's own update-available badge,
   * a stack's own warning), consolidated from five near-identical
   * definitions that had drifted apart across Environment/Vulnerability/
   * Stack/Container/Updates. It's since been eliminated entirely rather
   * than just consolidated: both of its own remaining uses (Container's
   * own header-positioned update-chip, its own hero-row-positioned
   * health-chip) already belonged to one of the four primary icon-class
   * tiers this file is organized around (header/hero-row/item-row/pill —
   * see each one's own comment for its own size and color-modifier set),
   * so giving them a third, separate class purely for color dressed up
   * an ordinary header/hero-row icon as if it were a distinct shape,
   * when the only thing it ever needed beyond that context was a color.
   *
   * Neither this banner nor an icon carrying one of these color
   * modifiers signals "clicking this does something" on its own — most
   * usages either do nothing on click or only open a more-info dialog,
   * informational either way. A card with a *real* action button (one
   * that actually triggers something, not just more-info) shouldn't
   * reuse this shape at all — see the Updates card's own "Update all"/
   * "Check for updates," which use the real <ha-button> component
   * instead (confirmed safe to use directly: it's a transitive import of
   * <ha-icon-button>, which is loaded by hui-root.ts, the Lovelace
   * dashboard root itself — see docs/ARCHITECTURE.md §11). Its own
   * native variant values already carry this repo's own semantic
   * colors (brand≈accent, success≈ok, warning≈warn, danger≈error), so
   * there's no reason to hand-roll a status-chip-based button when the
   * real component already does the job, and does it more consistently
   * with the rest of HA's own UI besides. */
  .status-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--ha-space-2, 8px);
    margin: 4px 0;
    padding: 4px 8px;
    border-radius: var(--ha-border-radius-pill, 9999px);
    font-size: var(--ha-font-size-s, 12px);
    font-weight: 500;
  }
  /* Found identically redeclared locally on several different cards
   * (Container's own .update-chip, plus two others, since eliminated,
   * on Environment and Stack — all real modifier classes layered on
   * top of .status-banner for local layout needs, but each also
   * carrying its own copy of this exact icon-size rule) before being
   * moved here once. .section-title/.stats-row's own icons folded in
   * the same way once this session's icon-size baseline change
   * (13px/14px → 16px) landed all three on the identical value —
   * restating one declaration three times stopped being justified. */
  .section-title ha-icon,
  .stats-row .stat ha-icon,
  .status-banner ha-icon {
    --mdc-icon-size: 16px;
  }
  .status-banner.ok {
    background: rgb(from var(--dockhand-status-ok-color) r g b / 0.12);
    color: var(--dockhand-status-ok-color);
  }
  .status-banner.warn {
    background: rgb(from var(--dockhand-status-warn-color) r g b / 0.12);
    color: var(--dockhand-status-warn-color);
  }
  .status-banner.error {
    background: rgb(from var(--dockhand-status-error-color) r g b / 0.12);
    color: var(--dockhand-status-error-color);
  }
  .status-banner.accent {
    background: rgb(from var(--dockhand-accent-color) r g b / 0.12);
    color: var(--dockhand-accent-color);
  }
`;

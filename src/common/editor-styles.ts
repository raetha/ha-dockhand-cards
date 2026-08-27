import { css } from 'lit';

/**
 * Shared styles for the hand-built pieces of this repo's editors — the
 * parts `<ha-form>` doesn't render, not the form fields themselves.
 * Seven of eight editors build their config UI from a `<ha-form>` schema
 * now (see docs/ARCHITECTURE.md); this file's classes are what's left
 * around that: empty-state rows, environment-filter pickers, sortable
 * lists, and similar structure `<ha-form>` has no equivalent for.
 *
 * Text sizing uses HA's own --ha-font-size-* design tokens (confirmed
 * against HA frontend source — hui-heading-badges-editor's own secondary/
 * description text uses exactly --ha-font-size-s) rather than hand-picked
 * em ratios. This isn't just cosmetic parity: HA's accessibility text-size
 * setting (--ha-font-size-scale) only propagates through these tokens, not
 * through a plain em value computed off the fixed 14px document root, so a
 * hand-picked em ratio silently stops scaling with a user's own HA text-size
 * preference where the real tokens keep tracking it.
 */
export const editorFormStyles = css`
  .row {
    margin-bottom: var(--ha-space-3, 12px);
  }
  /* Only affects ha-select/ha-input elements this component renders
   * directly in its own template (e.g. the environment-filter pickers in
   * Container/Stack card editors) — shadow DOM encapsulation means this
   * can't reach a select/input HA's own <ha-form> renders internally in
   * its own shadow root, which is expected, not a gap to fix. */
  ha-select,
  ha-input {
    display: block;
    width: 100%;
  }
  .hint {
    font-size: var(--ha-font-size-s, 12px);
    color: var(--secondary-text-color);
    margin-top: var(--ha-space-1, 4px);
  }
  /* <ha-form> has no margin of its own. Doesn't matter for the seven
   * editors with exactly one <ha-form> — the dialog/panel around them
   * already has its own bottom padding — but the Schedules editor splits
   * fields across multiple <ha-form> calls with a hand-rolled section
   * (environment order/selection) conditionally rendered between two of
   * them. Without this, when that section doesn't render, the two forms
   * sit directly adjacent with zero gap between them, while sections that
   * *do* render between them get var(--ha-space-4) from the explicit
   * margin sortableRowStyles puts on ha-expansion-panel itself (confirmed
   * against HA frontend source: the component has no margin of its own
   * either — both need an explicit rule for the same reason) — an
   * inconsistency depending on which fields happen to be visible. Same
   * token as that rule, not just the same current value, so the two stay
   * in sync automatically if it's ever revisited. */
  ha-form {
    display: block;
    margin-bottom: var(--ha-space-4, 16px);
  }
`;

/**
 * Generic drag-to-reorder + eye-icon-to-hide row list, pairs with HA's own
 * `<ha-sortable>` element. Extracted from the Overview card editor's
 * env-order-row pattern (still using its own locally-scoped classes there
 * as of this writing — not yet migrated to share these, to avoid touching
 * already-working, already-shipped editor code as a side effect of adding
 * a second, unrelated use case). Generic naming (not "env-" prefixed)
 * since the Schedules card editor's row-detail-order list is the second
 * user of this exact pattern, and it isn't ordering environments.
 */
export const sortableRowStyles = css`
  ha-expansion-panel {
    /* ha-expansion-panel itself has zero margin natively (confirmed
     * against HA frontend source: :host { display: block; }, nothing
     * else) — without this, adjacent panels (or a panel next to a
     * <ha-form>) sit with zero gap between them, and there's no native
     * equivalent to fall back on for this specific spacing. Same token
     * as editorFormStyles' own ha-form rule above, not just the same
     * current value, so the two stay in sync automatically. */
    margin: var(--ha-space-4, 16px) 0;
  }
  /* 12px uniform — confirmed directly against HA's own ha-form-expandable
   * component (src/components/ha-form/ha-form-expandable.ts): that's
   * exactly what it sets on its own .content, overriding
   * ha-expansion-panel's bare native default (0 8px) the same way this
   * rule does. This repo's hand-built panels (the Environments section,
   * Overview's own three) still need this rule explicitly — they don't
   * get ha-form-expandable's styling for free the way this repo's other
   * nine expandable-content sections now do, since those switched to
   * HA's native type: 'expandable' schema type and render through the
   * real component directly. */
  ha-expansion-panel .content {
    padding: 12px;
  }
  /* Confirmed directly against HA's own shared configElementStyle
   * (src/panels/lovelace/editor/config-elements/config-elements-style.ts):
   * resets whatever's slotted as the header — h3, span, div, doesn't
   * matter which — to inherit ha-expansion-panel's own #summary styling
   * (font-weight: var(--ha-font-weight-medium) already applied there)
   * rather than carry the element's own browser-default styling (an h3's
   * bold/oversized defaults, for instance). This is the actual fix for
   * what an earlier, now-removed custom h3 { ... } rule in this file
   * was trying (and getting subtly wrong, with different hand-picked
   * values) to solve — HA already has a clean, generic answer for this
   * that doesn't care which element a header happens to use. */
  ha-expansion-panel > *[slot='header'] {
    margin: 0;
    font-size: inherit;
    font-weight: inherit;
  }
  /* Matches HA's own hui-heading-badges-editor.ts as closely as this
   * repo's own row shape allows — checked directly against source, not
   * approximated. Their .badges container is display:flex;
   * flex-direction:column; gap: var(--ha-space-2) (8px), with each row
   * itself (.badge) carrying no padding or margin of its own at all —
   * every bit of inter-row spacing lives on the container as a single
   * gap, not spread across N rows' own margins. That's the one thing an
   * earlier version of this file got structurally wrong before
   * comparing against this specific reference: it used margin-top per
   * row (closer to a *different* HA reference, hui-entities-card-row-
   * editor.ts), which works but isn't what this repo's own closest
   * precedent actually does.
   *
   * var(--ha-space-N, fallback) throughout, not a bare pixel value —
   * these are real HA design tokens (confirmed against
   * resources/theme/core.globals.ts), and using them means this
   * automatically tracks whatever HA's own spacing scale resolves to on
   * a person's actual install, including if HA changes those values in
   * a future release, rather than this repo's own copy silently
   * drifting from HA's current one. The fallback is only ever a safety
   * net for an HA version old enough to predate these tokens — the
   * design intent is still "use HA's own current value," not "use this
   * fallback." */
  .order-list {
    display: flex;
    flex-direction: column;
    gap: var(--ha-space-2, 8px);
  }
  .order-row {
    display: flex;
    align-items: center;
    gap: var(--ha-space-2, 8px);
    /* No border-bottom — checked directly against the same
     * hui-heading-badges-editor.ts: it has a li[divider] CSS rule but
     * never actually sets the divider attribute anywhere in its own
     * markup, so it's dead code in HA's own file, not evidence of a
     * convention to match. Their row list genuinely has no between-row
     * lines by default; ours shouldn't either. */
  }
  .order-row.hidden {
    opacity: 0.5;
  }
  .order-handle {
    cursor: grab;
    color: var(--secondary-text-color);
  }
  .order-handle.disabled {
    cursor: default;
    opacity: 0.3;
  }
  .order-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-actions {
    display: flex;
    align-items: center;
    /* Reserves the same vertical space whether or not the exclude toggle
     * actually renders inside it (see environment-scope.ts's
     * showExcludeToggle), so the same list doesn't look visibly denser
     * depending on which context it's shown in. var(--ha-space-9) —
     * 36px, not ha-icon-button's own 48px default touch-target height —
     * confirmed directly against hui-heading-badges-editor.ts's own
     * .remove-icon/.edit-icon rule, not approximated: this repo's own
     * closest real precedent for "a row list inside a card editor,"
     * using the same token so both this and .row-action-btn's own size
     * below track a single source of truth rather than two independently
     * hand-typed 36px values that could quietly drift apart. */
    min-height: var(--ha-space-9, 36px);
  }
  .row-action-btn {
    --ha-icon-button-size: var(--ha-space-9, 36px);
    color: var(--secondary-text-color);
  }
  .bulk-actions {
    display: flex;
    align-items: center;
    gap: var(--ha-space-2, 8px);
    padding: 0 var(--ha-space-1, 4px) var(--ha-space-2, 8px);
    font-size: var(--ha-font-size-s, 12px);
  }
  .bulk-actions-sep {
    color: var(--divider-color);
  }
  /* A plain <button>, not <ha-icon-button>/<mwc-button> — this is closer
   * to a text link (HA's own "select all"/"clear" affordances in similar
   * contexts, e.g. entity pickers, read the same way) than a full-weight
   * action button, and doesn't need Material's ripple/elevation for
   * something this lightweight. */
  .link-btn {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    color: var(--primary-color);
    cursor: pointer;
    font: inherit;
    font-size: inherit;
  }
  .link-btn:hover {
    text-decoration: underline;
  }
`;

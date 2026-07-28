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
    margin-bottom: 12px;
  }
  .sub-row {
    margin-left: 20px;
    padding-left: 12px;
    border-left: 2px solid var(--divider-color);
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
    font-size: var(--ha-font-size-s, 0.85em);
    color: var(--secondary-text-color);
    margin-top: 4px;
  }
`;

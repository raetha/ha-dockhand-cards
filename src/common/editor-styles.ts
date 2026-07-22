import { css } from 'lit';

/**
 * Editors use HA's own current form components — ha-select, ha-input,
 * ha-switch/ha-formfield, ha-expansion-panel — rather than hand-built
 * substitutes. See docs/ARCHITECTURE.md's "ha-select API was rewritten, not
 * deprecated" entry: the earlier bug was calling ha-select with its old
 * (removed) slotted mwc-list-item API, not a reason to avoid HA's own
 * components generally. ha-textfield was genuinely removed and replaced by
 * ha-input; ha-switch/ha-formfield/ha-expansion-panel were never broken.
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
  ha-select,
  ha-input {
    display: block;
    width: 100%;
  }
  .hint {
    font-size: 0.78em;
    color: var(--secondary-text-color);
    margin-top: 4px;
  }
  .hint-box {
    margin-top: 16px;
    padding: 10px 12px;
    border-radius: 6px;
    background: rgba(255, 152, 0, 0.1);
    font-size: 0.8em;
    color: var(--secondary-text-color);
  }
  .hint-box ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
`;

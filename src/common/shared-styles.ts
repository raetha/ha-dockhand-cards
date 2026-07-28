import { css } from 'lit';

export const sharedStyles = css`
  :host {
    /*
     * Customization hooks — see docs/STYLING.md. These are the only
     * values a theme is expected to override; layout/spacing/typography
     * are left as plain CSS and are card_mod's job, not a theme's.
     */
    --dockhand-accent-color: var(--primary-color);
    --dockhand-status-ok-color: #22c55e;
    --dockhand-status-warn-color: #f59e0b;
    --dockhand-status-error-color: #ef4444;
    --dockhand-status-info-color: #38bdf8;
    --dockhand-severity-critical-color: #ef4444;
    --dockhand-severity-high-color: #f97316;
    --dockhand-severity-medium-color: #ca8a04;
    --dockhand-severity-low-color: #3b82f6;
  }

  ha-card {
    padding: 16px;
    overflow: hidden;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }
  .icon-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgb(from var(--dockhand-accent-color) r g b / 0.1);
    flex-shrink: 0;
  }
  .icon-badge.offline {
    background: var(--disabled-color, #bdbdbd);
    opacity: 0.4;
  }
  .icon-badge ha-icon {
    --mdc-icon-size: 16px;
    color: var(--dockhand-accent-color);
  }
  .conn-icon {
    --mdc-icon-size: 16px;
    flex-shrink: 0;
    display: inline-flex;
  }
  .name-block {
    min-width: 0;
    overflow: hidden;
  }
  .name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .name {
    font-weight: 500;
    font-size: 0.95em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name-row ha-icon,
  .name-row ha-state-icon {
    --mdc-icon-size: 16px;
    flex-shrink: 0;
  }
  .subtitle {
    font-size: 0.8em;
    color: var(--secondary-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }
  .status-icons {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .settings-link {
    cursor: pointer;
    color: var(--secondary-text-color);
    display: flex;
  }
  .settings-link ha-icon {
    --mdc-icon-size: 16px;
  }
  .settings-link:hover {
    color: var(--primary-text-color);
  }
  /* Additive modifier, not a replacement for .settings-link — anyone's
   * existing card_mod targeting .settings-link (a documented, stable
   * class name — see docs/STYLING.md) still works the same way for the
   * normal case. Used when show_settings_link is on but the URL couldn't
   * be resolved, so it reads as "something's misconfigured" rather than
   * silently looking identical to the toggle being off — hiding both
   * cases the same way was the actual source of real confusion (a user
   * enabling the toggle and then seeing nothing, indistinguishable from
   * the feature being off, with no indication anything needed fixing). */
  .settings-link.unavailable {
    cursor: default;
    opacity: 0.5;
  }
  .settings-link.unavailable:hover {
    color: var(--secondary-text-color);
  }
  .body {
    margin-top: 10px;
  }
  .clickable {
    cursor: pointer;
    outline: none;
  }
  .clickable:hover {
    opacity: 0.8;
  }
  .clickable:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .status-icon {
    display: inline-flex;
    --mdc-icon-size: 16px;
  }
  .label-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .label-pill {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.7em;
    font-weight: 500;
    background: var(--divider-color);
    color: var(--secondary-text-color);
  }
  .empty-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 0.85em;
    color: var(--secondary-text-color);
    text-align: center;
    padding: 8px 0;
  }
  .section {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--divider-color);
  }
  .section:first-child {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8em;
    font-weight: 500;
    color: var(--secondary-text-color);
    margin-bottom: 6px;
  }
  .section-title ha-icon {
    --mdc-icon-size: 13px;
  }
  .section-title-value {
    margin-left: auto;
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .bar-track {
    height: 6px;
    border-radius: 3px;
    background: var(--divider-color);
    overflow: hidden;
    margin-bottom: 8px;
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
  .offline-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 0;
    color: var(--secondary-text-color);
    text-align: center;
  }
  .offline-state ha-icon {
    --mdc-icon-size: 28px;
    opacity: 0.5;
    margin-bottom: 6px;
  }
  .unavailable-hint {
    margin-top: 10px;
    padding: 8px;
    border-radius: 6px;
    background: rgba(255, 152, 0, 0.1);
    font-size: 0.75em;
    color: var(--secondary-text-color);
  }
  .unavailable-hint ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
  .error-state {
    padding: 16px;
    color: var(--error-color, #f44336);
    font-size: 0.9em;
  }
  /* Core messages — used only when the card would otherwise have nothing
   * else to show (a genuinely missing/disabled required entity), never
   * for supplementary "would show more" guidance (that lives in the
   * editor). Always paired with a warning/error icon so it doesn't read
   * as plain unstyled text. */
  .core-message {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .core-message ha-icon {
    --mdc-icon-size: 18px;
    flex-shrink: 0;
  }

  /* Shared "compact row list" pattern — used identically by the Stacks and
   * Containers cards (one row per stack/container). Card-specific extras
   * (Stacks' .item-type-pill, Containers' .item-status-icon.info and
   * .item-badge.unhealthy) stay in each card's own styles.ts, since only
   * one of the two cards needs them. */
  .row-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .item-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 4px;
    border-radius: 6px;
    font-size: 0.85em;
  }
  .item-row:not(:last-child) {
    border-bottom: 1px solid var(--divider-color);
  }
  .item-status-icon {
    --mdc-icon-size: 16px;
    flex-shrink: 0;
  }
  .item-status-icon.ok {
    color: var(--dockhand-status-ok-color);
  }
  .item-status-icon.warn {
    color: var(--dockhand-status-warn-color);
  }
  .item-status-icon.error {
    color: var(--dockhand-status-error-color);
  }
  .item-status-icon.neutral {
    color: var(--secondary-text-color);
  }
  .item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item-badge {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 0.85em;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }
  .item-badge ha-icon {
    --mdc-icon-size: 13px;
  }
  .item-badge.updates {
    color: var(--dockhand-status-warn-color);
  }

  /* Shared "metric row" pattern (CPU/memory-style bar rows with a label
   * and value line) — used identically by the Environment and Container
   * cards. */
  .metric-row {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--divider-color);
  }
  .metric-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8em;
    margin-bottom: 3px;
  }
  .metric-label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--secondary-text-color);
  }
  .metric-label ha-icon,
  .metric-label ha-state-icon {
    --mdc-icon-size: 13px;
  }
  .metric-value .used {
    color: var(--secondary-text-color);
    font-weight: normal;
  }
`;

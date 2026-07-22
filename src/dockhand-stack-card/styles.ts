import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .type-pill {
    padding: 1px 7px;
    border-radius: 8px;
    font-size: 0.68em;
    font-weight: 500;
    background: var(--divider-color);
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }
  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .status-word {
    font-size: 1.3em;
    font-weight: 600;
    text-transform: capitalize;
  }
  .status-word.running {
    color: var(--dockhand-status-ok-color);
  }
  .status-word.partial {
    color: var(--dockhand-status-warn-color);
  }
  .status-word.stopped {
    color: var(--dockhand-status-error-color);
  }
  .status-word.created {
    color: var(--secondary-text-color);
  }
  .container-count {
    font-size: 0.8em;
    color: var(--secondary-text-color);
  }
  .updates-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 8px;
    border-radius: 6px;
    font-size: 0.78em;
    font-weight: 500;
    margin-top: 8px;
    background: rgb(from var(--dockhand-status-warn-color) r g b / 0.12);
    color: var(--dockhand-status-warn-color);
  }
  .updates-badge ha-icon {
    --mdc-icon-size: 14px;
  }
  .git-section {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--divider-color);
  }
  .git-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8em;
    margin-bottom: 4px;
  }
  .git-row .label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--secondary-text-color);
  }
  .git-row .label ha-icon {
    --mdc-icon-size: 13px;
  }
  .sync-status {
    font-weight: 500;
    text-transform: capitalize;
  }
  .sync-status.synced {
    color: var(--dockhand-status-ok-color);
  }
  .sync-status.syncing {
    color: var(--dockhand-status-info-color);
  }
  .sync-status.pending {
    color: var(--secondary-text-color);
  }
  .sync-status.error {
    color: var(--dockhand-status-error-color);
  }
  .sync-error-banner {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 0.75em;
    margin-top: 6px;
    background: rgb(from var(--dockhand-status-error-color) r g b / 0.1);
    color: var(--dockhand-status-error-color);
  }
  .sync-error-banner ha-icon {
    --mdc-icon-size: 14px;
    flex-shrink: 0;
    margin-top: 1px;
  }
`;

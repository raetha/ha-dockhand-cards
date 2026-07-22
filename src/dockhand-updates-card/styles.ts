import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .bulk-button {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 0.78em;
    font-weight: 500;
    background: rgb(from var(--dockhand-accent-color) r g b / 0.12);
    color: var(--dockhand-accent-color);
    cursor: pointer;
    border: none;
  }
  .bulk-button.secondary {
    background: var(--divider-color);
    color: var(--secondary-text-color);
  }
  .bulk-button:hover {
    opacity: 0.85;
  }
  .bulk-button ha-icon {
    --mdc-icon-size: 14px;
  }
  .bulk-button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .spinning {
    animation: dockhand-spin 1s linear infinite;
  }
  @keyframes dockhand-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  .env-group {
    margin-top: 8px;
  }
  .env-group-title {
    font-size: 0.75em;
    font-weight: 500;
    color: var(--secondary-text-color);
    margin: 8px 0 4px;
  }
  .update-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 4px;
    border-radius: 6px;
    font-size: 0.85em;
  }
  .update-row:not(:last-child) {
    border-bottom: 1px solid var(--divider-color);
  }
  .update-row ha-icon {
    --mdc-icon-size: 15px;
    color: var(--dockhand-status-warn-color);
    flex-shrink: 0;
  }
  .update-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .update-versions {
    font-size: 0.85em;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }
`;

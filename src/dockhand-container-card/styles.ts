import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .state-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .state-word {
    font-size: 1.1em;
    font-weight: 600;
    text-transform: capitalize;
  }
  .state-word.running {
    color: var(--dockhand-status-ok-color);
  }
  .state-word.paused {
    color: var(--dockhand-status-warn-color);
  }
  .state-word.restarting {
    color: var(--dockhand-status-error-color);
  }
  .state-word.exited,
  .state-word.dead {
    color: var(--secondary-text-color);
  }
  .health-chip {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.75em;
    padding: 2px 7px;
    border-radius: 8px;
  }
  .health-chip ha-icon {
    --mdc-icon-size: 12px;
  }
  .health-chip.healthy {
    background: rgb(from var(--dockhand-status-ok-color) r g b / 0.12);
    color: var(--dockhand-status-ok-color);
  }
  .health-chip.unhealthy {
    background: rgb(from var(--dockhand-status-error-color) r g b / 0.12);
    color: var(--dockhand-status-error-color);
  }
  .health-chip.starting {
    background: rgb(from var(--dockhand-status-warn-color) r g b / 0.12);
    color: var(--dockhand-status-warn-color);
  }
  .io-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 16px;
    font-size: 0.8em;
    margin-top: 8px;
  }
  .io-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .io-item .label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--secondary-text-color);
  }
  .io-item .label ha-icon {
    --mdc-icon-size: 13px;
  }
`;

import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .sync-status.synced {
    color: var(--dockhand-status-ok-text-color);
  }
  .sync-status.syncing {
    color: var(--dockhand-status-info-text-color);
  }
  .sync-status.pending {
    color: var(--secondary-text-color);
  }
  .sync-status.error {
    color: var(--dockhand-status-error-text-color);
  }
  /* A container pill's state icon, colored as the Container card colors
   * its state. */
  .pill-state.ok {
    color: var(--dockhand-status-ok-text-color);
  }
  .pill-state.warn {
    color: var(--dockhand-status-warn-text-color);
  }
  .pill-state.error {
    color: var(--dockhand-status-error-text-color);
  }
  .pill-state.neutral {
    color: var(--secondary-text-color);
  }
  .sync-error-banner {
    align-items: flex-start;
  }
  .sync-error-banner ha-icon {
    flex-shrink: 0;
    margin-top: 1px;
  }
`;

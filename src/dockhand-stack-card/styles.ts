import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .sync-status {
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
    align-items: flex-start;
  }
  .sync-error-banner ha-icon {
    flex-shrink: 0;
    margin-top: 1px;
  }
`;

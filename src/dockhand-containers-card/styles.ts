import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .item-status-icon.info {
    color: var(--dockhand-status-info-color);
  }
  .item-badge.unhealthy {
    color: var(--dockhand-status-error-color);
  }
  .item-badge.healthy {
    color: var(--dockhand-status-ok-color);
  }
`;

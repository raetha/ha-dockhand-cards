import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .update-row ha-icon {
    color: var(--dockhand-status-warn-color);
  }
`;

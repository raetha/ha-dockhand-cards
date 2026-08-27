import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .overview {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  /* flex-wrap keeps items in source order, so on a narrow viewport each
   * environment's column becomes a full-width row and stacks below the
   * previous one — "finish one environment before the next" on mobile,
   * matching the desktop column order, with no separate mobile layout
   * needed. */
  .env-column {
    flex: 1 1 320px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
`;

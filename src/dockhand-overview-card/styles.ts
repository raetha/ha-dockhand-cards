import { css } from 'lit';

export const cardStyles = css`
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
  .env-column-title {
    font-size: 0.85em;
    font-weight: 500;
    color: var(--secondary-text-color);
    padding: 0 4px;
  }
  .empty-note {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 0.9em;
    color: var(--secondary-text-color);
    text-align: center;
    padding: 24px 0;
    width: 100%;
  }
  .empty-note ha-icon {
    --mdc-icon-size: 24px;
    opacity: 0.6;
  }
`;

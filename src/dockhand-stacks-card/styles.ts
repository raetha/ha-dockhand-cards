import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .name-and-type {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }
  /* Overrides the shared .item-name's own flex: 1 (which other cards rely
   * on to push everything after the name to the row's far right edge) —
   * here, .name-and-type itself takes over that growing role, so the
   * type pill sits immediately after the name instead. */
  .name-and-type .item-name {
    flex: 0 1 auto;
  }
  .item-type-pill {
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 0.7em;
    font-weight: 500;
    background: var(--divider-color);
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }
`;

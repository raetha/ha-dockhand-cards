import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .overview {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    column-gap: 16px;
    row-gap: 12px;
  }

  /* Each env-column is a flex column; sections stack vertically with a
   * fixed gap. JS height-equalisation (_equalizeColumnHeights in card.ts)
   * sets min-height on each .section-wrapper so matching section slots
   * line up across neighbouring columns without CSS subgrid (which
   * triggered a Chrome bug inflating the second column track's width).
   * auto-fill ensures each column occupies its own track, so on narrow
   * viewports the grid reduces to a single column and environments stack
   * vertically in source order. */
  .env-column {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* align_columns: false — opt-out flex-wrap layout restoring the
   * pre-alignment behaviour for users who prefer a more compact look
   * when section counts differ between columns. */
  .overview.no-align {
    display: flex;
    flex-wrap: wrap;
    column-gap: 16px;
    row-gap: 12px;
  }
  .no-align .env-column {
    flex: 1 1 320px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
`;

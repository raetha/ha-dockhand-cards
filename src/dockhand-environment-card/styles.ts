import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  /* The environment name is a line-height:1 span — .clickable's 6px
   * border-radius is disproportionately large at that height (~40% of
   * half-height) and looks pill-shaped instead of a subtle rounded rect.
   * It also causes overflow:hidden (from .truncate) to clip the first
   * glyph at the curved corner.  Small padding + negative margin extends
   * the hover footprint without shifting layout, and the lower border-
   * radius gives proportions matching a header-icon or row element rather
   * than a pill.  Scoped here (not in shared-styles) so the standard
   * .clickable shape is unchanged everywhere else, including label-pill. */
  .env-name.clickable {
    padding: 2px 4px;
    margin: -2px -4px;
    border-radius: 4px;
  }
  .breakdown .running {
    color: var(--dockhand-status-ok-color);
  }
  .breakdown .partial {
    color: var(--dockhand-status-warn-color);
  }
  .breakdown .stopped {
    color: var(--dockhand-status-error-color);
  }
  .chart-value {
    font-weight: 500;
  }
  .sparkline {
    width: 100%;
    height: 30px;
    display: block;
    cursor: crosshair;
  }
  .sparkline-wrap {
    position: relative;
  }
  .chart-tooltip {
    position: absolute;
    top: -4px;
    background: var(--card-background-color, #1c1c1c);
    border: 1px solid var(--divider-color);
    border-radius: 6px;
    padding: 4px 8px;
    /* Reconsidered from xs: unlike everything else on this card, a
     * tooltip only exists while actively hovering — it never competes
     * with other content for permanent screen space, so there's no
     * density reason to keep it smaller than the content it's
     * describing. Matches the card's own content-body size instead. */
    font-size: var(--ha-font-size-s, 12px);
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    z-index: 1;
  }
  .chart-tooltip.left {
    transform: translate(0, -100%);
  }
  .chart-tooltip.right {
    transform: translate(-100%, -100%);
  }
  .chart-tooltip-time {
    margin-bottom: 2px;
  }
  .chart-tooltip-value {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .chart-tooltip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .disk-chart-row {
    gap: 16px;
  }
  .disk-donut {
    width: 64px;
    height: 64px;
    flex-shrink: 0;
  }
  .disk-legend {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  /* Same context-padding contribution the shared mechanism gives
   * .body/.section/.list/.grid-2's own children (common/shared-
   * styles.ts) — kept local since .disk-legend/.full-left/.full-right
   * are all card-specific, not a shared concept, but need the
   * identical 4px top/bottom so their own direct children compose into
   * the standard 8px rhythm the same way every other container on this
   * card does. */
  .disk-legend > *,
  .full-left > *:not(.section):not(.grid-2):not(.divider),
  .full-right > *:not(.section):not(.grid-2):not(.divider) {
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .disk-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  /* Matches Dockhand's own 2x4 tile split (EnvironmentTile.svelte): left
   * column carries everything through top-containers, right column is
   * history + disk usage, divided by a vertical rule at genuinely wide
   * card widths. Below that width — a standard (12-wide) card, or any
   * card on a narrow/mobile viewport — everything just flows down as one
   * column instead, which is what a container query gives for free: it
   * responds to the card's own rendered width, not the dashboard section
   * or the viewport, so this is correct even if the card ends up nested
   * somewhere narrower than its own configured width (e.g. inside the
   * Overview card's per-environment columns). */
  .full-container {
    container-type: inline-size;
  }
  .full-left,
  .full-right {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  @container (max-width: 699.98px) {
    /* Below 700px, .full-layout falls back to normal block flow (no
     * grid — see the min-width query below), so full-left and
     * full-right stack instead of sitting side-by-side, making
     * full-left's own last section and full-right's own first section
     * adjacent with nothing between them. joinWithDividers only ever
     * places dividers within its own single list (see
     * common/section-join.ts), never at the seam between two entirely
     * separate calls like full-left's own and full-right's own — so
     * this boundary needs its own, explicit separator here, added
     * specifically for the stacked case (the side-by-side case below
     * uses a border-left instead, which already serves the same
     * purpose there). */
    .full-right {
      border-top: 1px solid var(--divider-color);
      padding-top: 4px;
      margin-top: 4px;
    }
  }
  @container (min-width: 700px) {
    .full-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      align-items: start;
    }
    .full-right {
      border-left: 1px solid var(--divider-color);
      padding-left: 16px;
      margin-left: 16px;
    }
  }
`;

import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .container-stats {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    font-size: 0.85em;
  }
  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .stat ha-icon {
    --mdc-icon-size: 14px;
  }
  .stat .total-label {
    font-size: 0.85em;
    color: var(--secondary-text-color);
  }
  .health-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 0.8em;
    font-weight: 500;
    margin-top: 8px;
  }
  .health-banner ha-icon {
    --mdc-icon-size: 14px;
  }
  .health-banner.ok {
    background: rgb(from var(--dockhand-status-ok-color) r g b / 0.12);
    color: var(--dockhand-status-ok-color);
  }
  .health-banner.warn {
    background: rgb(from var(--dockhand-status-warn-color) r g b / 0.12);
    color: var(--dockhand-status-warn-color);
  }
  .health-banner.error {
    background: rgb(from var(--dockhand-status-error-color) r g b / 0.12);
    color: var(--dockhand-status-error-color);
  }
  .resource-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 16px;
    font-size: 0.8em;
    margin-top: 8px;
  }
  .resource-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .resource-item .label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--secondary-text-color);
  }
  .resource-item .label ha-icon,
  .resource-item .label ha-state-icon {
    --mdc-icon-size: 13px;
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
  .events-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8em;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--divider-color);
    color: var(--secondary-text-color);
  }
  .events-row .label {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .events-row .label ha-icon,
  .events-row .label ha-state-icon {
    --mdc-icon-size: 13px;
  }
  .events-row .value {
    color: var(--primary-text-color);
    font-weight: 500;
  }
  .top-container-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 10px;
    font-size: 0.8em;
    padding: 3px 0;
  }
  .top-container-row .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .top-container-row .metric {
    display: flex;
    align-items: center;
    gap: 3px;
    color: var(--secondary-text-color);
  }
  .top-container-row .metric ha-icon {
    --mdc-icon-size: 12px;
  }
  .event-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78em;
    padding: 3px 0;
    color: var(--secondary-text-color);
  }
  .event-row ha-icon {
    --mdc-icon-size: 13px;
    flex-shrink: 0;
  }
  .event-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--primary-text-color);
  }
  .chart-block {
    margin-bottom: 10px;
  }
  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75em;
    margin-bottom: 4px;
  }
  .chart-header > span:first-child {
    color: var(--secondary-text-color);
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
    font-size: 0.72em;
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
    color: var(--secondary-text-color);
    margin-bottom: 2px;
  }
  .chart-tooltip-value {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
  }
  .chart-tooltip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .disk-chart-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .disk-donut {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    flex-shrink: 0;
    /* Punches the donut hole — a plain conic-gradient background alone
     * would be a solid pie, not a donut, so mask out the center. 35%
     * hole / 65% ring — halfway between Dockhand's own 50/50 ratio
     * (read as too thin at our smaller 64px) and a first attempt at
     * 20/80 (read as too thick). */
    mask: radial-gradient(circle at center, transparent 0 35%, black 36% 100%);
    -webkit-mask: radial-gradient(circle at center, transparent 0 35%, black 36% 100%);
  }
  .disk-legend {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.78em;
    flex: 1;
    min-width: 0;
  }
  .disk-legend-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .disk-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .disk-label {
    color: var(--secondary-text-color);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .disk-value {
    flex-shrink: 0;
    font-weight: 500;
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
  @container (min-width: 700px) {
    .full-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      align-items: start;
    }
    .full-left,
    .full-right {
      min-width: 0;
    }
    .full-right {
      border-left: 1px solid var(--divider-color);
      padding-left: 16px;
      margin-left: 16px;
    }
    .full-right .section:first-child {
      margin-top: 0;
      padding-top: 0;
      border-top: none;
    }
  }
`;

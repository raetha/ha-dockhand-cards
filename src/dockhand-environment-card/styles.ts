import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  /*
   * This card's own colors, as custom properties so a theme or card_mod can
   * change any of them (docs/styling.md). Event icons use HA's status colors
   * in Dockhand's grouping (start green, stop red, change amber, health
   * blue). The rest have no HA equivalent and default to Dockhand's colors.
   */
  :host {
    --dockhand-connection-socket-color: #22d3ee;
    --dockhand-connection-direct-color: #3b82f6;
    --dockhand-connection-hawser-standard-color: #a855f7;
    --dockhand-connection-hawser-edge-color: #22c55e;
    --dockhand-event-start-color: var(--dockhand-status-ok-color);
    --dockhand-event-stop-color: var(--dockhand-status-error-color);
    --dockhand-event-change-color: var(--dockhand-status-warn-color);
    --dockhand-event-health-color: var(--dockhand-status-info-color);
    --dockhand-event-other-color: var(--secondary-text-color);
    --dockhand-chart-cpu-color: #10b981;
    --dockhand-chart-memory-color: #3b82f6;
    --dockhand-disk-images-color: #0ea5e9;
    --dockhand-disk-containers-color: #10b981;
    --dockhand-disk-volumes-color: #f59e0b;
    --dockhand-disk-build-cache-color: #8b5cf6;
    --dockhand-label-1-color: #ef4444;
    --dockhand-label-2-color: #f97316;
    --dockhand-label-3-color: #eab308;
    --dockhand-label-4-color: #22c55e;
    --dockhand-label-5-color: #14b8a6;
    --dockhand-label-6-color: #3b82f6;
    --dockhand-label-7-color: #8b5cf6;
    --dockhand-label-8-color: #ec4899;
    --dockhand-label-9-color: #06b6d4;
    --dockhand-label-10-color: #84cc16;
    --dockhand-label-11-color: #6366f1;
    --dockhand-label-12-color: #d946ef;
  }

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
    color: var(--dockhand-status-ok-text-color);
  }
  .breakdown .partial {
    color: var(--dockhand-status-warn-text-color);
  }
  .breakdown .stopped {
    color: var(--dockhand-status-error-text-color);
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

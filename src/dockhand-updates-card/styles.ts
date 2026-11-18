import { css } from 'lit';
import { sharedStyles } from '../common/shared-styles';

export const cardStyles = css`
  ${sharedStyles}

  .update-row .update-icon {
    color: var(--dockhand-status-warn-color);
  }
  /* Nothing to install and nothing to do yet: a newer tag needs the
   * container's image tag changed; a held update is waiting out Dockhand's
   * minimum image age. A moved digest on a pinned image keeps the update
   * color, as in Dockhand: it wants attention, just not from Install. */
  .update-row .update-icon.tag,
  .update-row .update-icon.held {
    color: var(--secondary-text-color);
  }
  /* A cell that can shrink below its text (min-width 0), so the old
   * version, then the new, then a tag pill's text, is cut rather than the
   * name. */
  .update-row > .cell.version,
  .update-row .version-text {
    display: flex;
    align-items: center;
    gap: var(--ha-space-1, 4px);
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }
  .version-old,
  .version-new {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .version-old {
    flex: 0 1000 auto;
    min-width: 2ch;
  }
  /* No minimum of its own: one would leave a short version (18.7) short
   * of the right edge. The old version's far larger shrink factor still
   * cuts it first. */
  .version-new {
    flex: 0 1 auto;
  }
  .version-arrow {
    flex-shrink: 0;
  }
  .update-row > .cell.version {
    gap: var(--ha-space-2, 8px);
  }
  /* The version text first gives way, then the tag pill's text. */
  .version-text {
    flex: 0 1000 auto;
  }
  /* Same color as the update icon, on a tint of it, as Dockhand's own badge
   * (amber at 10%). */
  .version-tag-pill {
    color: var(--dockhand-status-warn-text-color);
    background: rgb(from var(--dockhand-status-warn-color) r g b / 0.1);
    flex: 0 1 auto;
    min-width: 0;
  }
  .version-tag-pill ha-icon {
    color: var(--dockhand-status-warn-color);
  }
  .version-tag-pill .pill-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

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
   * version, then the new, is cut rather than the name. */
  .update-row > .cell.version {
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
`;

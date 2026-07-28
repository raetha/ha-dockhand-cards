import type { LovelaceCardConfig } from 'custom-card-helpers';

/** Each is an independently-toggleable piece of the per-row display —
 * status icon/name always show (they're the row's identity, not
 * optional), everything else here can be turned off to reduce clutter
 * on a stack list with entities the user doesn't care to see per-row. */
export type StacksCardBadge = 'container_count' | 'updates' | 'type';

export const DEFAULT_STACKS_BADGES: StacksCardBadge[] = ['container_count', 'updates', 'type'];

export interface DockhandStacksCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-stacks-card';
  device_id: string;
  title?: string;
  show_settings_link?: boolean;
  visible_badges?: StacksCardBadge[];
}

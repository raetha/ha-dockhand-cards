import type { LovelaceCardConfig } from 'custom-card-helpers';

/** Each is an independently-toggleable piece of the per-row display —
 * status icon/name always show (they're the row's identity, not
 * optional). health/cpu/memory are proposed additions beyond what was
 * explicitly asked for (only updates was) — they're already
 * conditionally rendered based on entity availability, so letting the
 * user also turn them off independent of that gives the same
 * decluttering value the requested updates toggle does. */
export type ContainersCardBadge = 'health' | 'updates' | 'cpu' | 'memory';

export const DEFAULT_CONTAINERS_BADGES: ContainersCardBadge[] = ['health', 'updates', 'cpu', 'memory'];

export interface DockhandContainersCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-containers-card';
  device_id: string;
  title?: string;
  show_settings_link?: boolean;
  visible_badges?: ContainersCardBadge[];
}

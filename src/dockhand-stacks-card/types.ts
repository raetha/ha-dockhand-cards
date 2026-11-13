import type { LovelaceCardConfig } from 'custom-card-helpers';
import type { EntityNameItem } from '../common/ha-types';
import type { FiltersConfig } from '../common/filters';

/** Each is an independently-toggleable piece of the per-row display —
 * status icon/name always show (they're the row's identity, not
 * optional), everything else here can be turned off to reduce clutter
 * on a stack list with entities the user doesn't care to see per-row.
 * 'environment' is new alongside multi-environment support — same
 * checkbox-group convention as everything else here (docs/
 * editor-design.md rule 5), not a standalone toggle. */
export type StacksCardBadge = 'container_count' | 'updates' | 'type' | 'environment' | 'tags';

export const DEFAULT_STACKS_BADGES: StacksCardBadge[] = ['container_count', 'updates', 'type', 'tags'];

/** 'status'/'type' group by the same fields STATUS_ICON/the type pill
 * already expose per row in card.ts — no new data needed to support
 * either. */
export type StacksGroupBy = 'none' | 'environment' | 'status' | 'type';

/** 'status' sorts problems first, matching every other card's own
 * status-priority ordering (see card.ts's STATUS_RANK); 'containers'
 * puts the stacks with the most containers first. Ties fall back to the
 * name. */
export type StacksSortBy = 'name' | 'status' | 'containers';

export interface DockhandStacksCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-stacks-card';
  environments_order?: string[];
  exclude_device_ids?: string[];
  /** Composed (Area/Device/Entity/Floor) or Custom (a plain string) —
   * see common/card-name.ts. */
  name?: string | EntityNameItem | EntityNameItem[];
  show_settings_link?: boolean;
  /** Start / stop / restart on each row; off unless set. */
  show_controls?: boolean;
  visible_badges?: StacksCardBadge[];
  group_by?: StacksGroupBy;
  sort_by?: StacksSortBy;
  /** Which rows show; see common/filters.ts. */
  filters?: FiltersConfig;
  /** The "Hidden by filters" line; on unless false. */
  show_filtered_count?: boolean;
}

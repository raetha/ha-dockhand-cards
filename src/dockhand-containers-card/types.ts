import type { LovelaceCardConfig } from 'custom-card-helpers';
import type { EntityNameItem } from '../common/ha-types';
import type { FiltersConfig } from '../common/filters';

/** Each is an independently-toggleable piece of the per-row display —
 * status icon/name always show (they're the row's identity, not
 * optional). health/cpu/memory are proposed additions beyond what was
 * explicitly asked for (only updates was) — they're already
 * conditionally rendered based on entity availability, so letting the
 * user also turn them off independent of that gives the same
 * decluttering value the requested updates toggle does. 'environment'
 * is new alongside multi-environment support — same checkbox-group
 * convention as everything else here (docs/editor-design.md rule 5),
 * not a standalone toggle. */
export type ContainersCardBadge = 'health' | 'updates' | 'cpu' | 'memory' | 'environment' | 'tags';

export const DEFAULT_CONTAINERS_BADGES: ContainersCardBadge[] = ['health', 'updates', 'cpu', 'memory', 'tags'];

/** No 'type' option, unlike Stacks' equivalent — containers don't have a
 * comparable per-row type concept to group by. */
export type ContainersGroupBy = 'none' | 'environment' | 'status';

/** 'status' sorts problems first, matching every other card's own
 * status-priority ordering; 'cpu' and 'memory' put the busiest first.
 * Ties fall back to the name. */
export type ContainersSortBy = 'name' | 'status' | 'cpu' | 'memory';

export interface DockhandContainersCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-containers-card';
  environments_order?: string[];
  exclude_device_ids?: string[];
  /** Composed (Area/Device/Entity/Floor) or Custom (a plain string) —
   * see common/card-name.ts. */
  name?: string | EntityNameItem | EntityNameItem[];
  show_settings_link?: boolean;
  /** Start / stop / restart on each row; off unless set. */
  show_controls?: boolean;
  visible_badges?: ContainersCardBadge[];
  group_by?: ContainersGroupBy;
  sort_by?: ContainersSortBy;
  /** Which rows show; see common/filters.ts. */
  filters?: FiltersConfig;
  /** The "Hidden by filters" line; on unless false. */
  show_filtered_count?: boolean;
  /** Rows with a problem (see isProblem in card.ts) show whatever the
   * filters say; off unless set. */
  always_show_problems?: boolean;
}

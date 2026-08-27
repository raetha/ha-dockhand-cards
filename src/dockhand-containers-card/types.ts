import type { LovelaceCardConfig } from 'custom-card-helpers';
import type { EntityNameItem } from '../common/ha-types';

/** Each is an independently-toggleable piece of the per-row display —
 * status icon/name always show (they're the row's identity, not
 * optional). health/cpu/memory are proposed additions beyond what was
 * explicitly asked for (only updates was) — they're already
 * conditionally rendered based on entity availability, so letting the
 * user also turn them off independent of that gives the same
 * decluttering value the requested updates toggle does. 'environment'
 * is new alongside multi-environment support — same checkbox-group
 * convention as everything else here (docs/EDITOR_DESIGN.md rule 5),
 * not a standalone toggle. */
export type ContainersCardBadge = 'health' | 'updates' | 'cpu' | 'memory' | 'environment';

export const DEFAULT_CONTAINERS_BADGES: ContainersCardBadge[] = ['health', 'updates', 'cpu', 'memory'];

/** No 'type' option, unlike Stacks' equivalent — containers don't have a
 * comparable per-row type concept to group by. */
export type ContainersGroupBy = 'none' | 'environment' | 'status';

/** 'status' sorts problems first, matching every other card's own
 * status-priority ordering. */
export type ContainersSortBy = 'name' | 'status';

export interface DockhandContainersCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-containers-card';
  /** Legacy single-environment field — real, released since 1.0.0.
   * Never written by this card's own editor anymore once
   * environments_order/exclude_device_ids exist; kept purely so an
   * already-saved config with only this field keeps working exactly as
   * before, computed fresh each render rather than migrated in place.
   * See resolveIncludedOrderedWithLegacy in environment-scope.ts. */
  device_id?: string;
  environments_order?: string[];
  exclude_device_ids?: string[];
  /** Composed (Area/Device/Entity/Floor) or Custom (a plain string) —
   * see common/card-name.ts. */
  name?: string | EntityNameItem | EntityNameItem[];
  show_settings_link?: boolean;
  visible_badges?: ContainersCardBadge[];
  group_by?: ContainersGroupBy;
  sort_by?: ContainersSortBy;
}

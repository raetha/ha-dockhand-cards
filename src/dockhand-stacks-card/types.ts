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
export type StacksCardBadge = 'container_count' | 'updates' | 'cpu' | 'memory' | 'type' | 'environment' | 'tags' | 'controls';

/** CPU and memory are off by default: they go together, and memory is the
 * amount in use, as Dockhand's stacks list shows it (Dockhand reports no
 * percentage for a stack), which takes more room than a percentage. Both
 * show only while ha-dockhand's container and stack stats are on. */
/** The details in their order on a row (the name's side, then the
 * columns), which the editor lists them in. */
export const STACKS_BADGE_ORDER: readonly StacksCardBadge[] = ['type', 'environment', 'tags', 'updates', 'container_count', 'cpu', 'memory', 'controls'];

export const DEFAULT_STACKS_BADGES: StacksCardBadge[] = ['container_count', 'updates', 'type', 'tags'];

/** 'status'/'type' group by the same fields STATUS_ICON/the type pill
 * already expose per row in card.ts — no new data needed to support
 * either. */
export type StacksGroupBy = 'none' | 'environment' | 'status' | 'type';

/** 'status' sorts problems first, matching every other card's own
 * status-priority ordering (see card.ts's STATUS_RANK); 'containers'
 * puts the stacks with the most containers first, 'cpu' and 'memory' the
 * busiest (memory by the amount in use). Ties fall back to the name. */
export type StacksSortBy = 'name' | 'status' | 'containers' | 'cpu' | 'memory';

export interface DockhandStacksCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-stacks-card';
  environments_order?: string[];
  exclude_device_ids?: string[];
  /** Composed (Area/Device/Entity/Floor) or Custom (a plain string) —
   * see common/card-name.ts. */
  name?: string | EntityNameItem | EntityNameItem[];
  show_settings_link?: boolean;
  visible_badges?: StacksCardBadge[];
  group_by?: StacksGroupBy;
  sort_by?: StacksSortBy;
  /** Which rows show; see common/filters.ts. */
  filters?: FiltersConfig;
  /** The "Hidden by filters" line; on unless false. */
  show_filtered_count?: boolean;
  /** Rows with a problem (see isProblem in card.ts) show whatever the
   * filters say; off unless set. */
  always_show_problems?: boolean;
}

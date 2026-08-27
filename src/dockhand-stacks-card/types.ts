import type { LovelaceCardConfig } from 'custom-card-helpers';
import type { EntityNameItem } from '../common/ha-types';

/** Each is an independently-toggleable piece of the per-row display —
 * status icon/name always show (they're the row's identity, not
 * optional), everything else here can be turned off to reduce clutter
 * on a stack list with entities the user doesn't care to see per-row.
 * 'environment' is new alongside multi-environment support — same
 * checkbox-group convention as everything else here (docs/
 * EDITOR_DESIGN.md rule 5), not a standalone toggle. */
export type StacksCardBadge = 'container_count' | 'updates' | 'type' | 'environment';

export const DEFAULT_STACKS_BADGES: StacksCardBadge[] = ['container_count', 'updates', 'type'];

/** 'status'/'type' group by the same fields STATUS_ICON/the type pill
 * already expose per row in card.ts — no new data needed to support
 * either. */
export type StacksGroupBy = 'none' | 'environment' | 'status' | 'type';

/** 'status' sorts problems first, matching every other card's own
 * status-priority ordering (see card.ts's STATUS_RANK) rather than
 * introducing a different convention here. */
export type StacksSortBy = 'name' | 'status';

export interface DockhandStacksCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-stacks-card';
  /** Legacy single-environment field — real, released since 1.0.0.
   * Never written by this card's own editor anymore once
   * environments_order/exclude_device_ids exist; kept purely so an
   * already-saved config with only this field keeps working exactly as
   * before, computed fresh each render rather than migrated in place.
   * See resolveIncludedOrderedWithLegacy in environment-scope.ts
   * for the resolution logic, and that function's own comment for why
   * this deliberately isn't rewritten into the new fields automatically. */
  device_id?: string;
  environments_order?: string[];
  exclude_device_ids?: string[];
  /** Composed (Area/Device/Entity/Floor) or Custom (a plain string) —
   * see common/card-name.ts. */
  name?: string | EntityNameItem | EntityNameItem[];
  show_settings_link?: boolean;
  visible_badges?: StacksCardBadge[];
  group_by?: StacksGroupBy;
  sort_by?: StacksSortBy;
}

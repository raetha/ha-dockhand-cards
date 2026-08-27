import type { LovelaceCardConfig } from 'custom-card-helpers';
import type { EntityNameItem } from '../common/ha-types';

export type ScheduleSortBy = 'name' | 'next_run' | 'status';

export type ScheduleGroupBy = 'none' | 'environment' | 'type' | 'status';

export type ScheduleBadge = 'next_run' | 'environment';

export interface DockhandSchedulesCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-schedules-card';
  /** No scope field, deliberately — a design considered and rejected in
   * favor of what environments_order/exclude_device_ids already express
   * on their own: "all" is just "nothing excluded," "environment" is
   * just "everything but one excluded" (now one click via the per-row
   * "solo" action, not a separate control), and "global" is just
   * include_global on its own, unconditionally available rather than
   * gated behind a scope value. The environment list is always shown,
   * never conditionally hidden — see README.md for the resulting config
   * shape. */
  /** Composed (Area/Device/Entity/Floor, in any combination/order) or
   * Custom (a plain string) — borrowed directly from HA's own Tile card
   * editor's Name field via the entity_name selector, not a plain text
   * field the way this was before. See common/card-name.ts for the
   * schema entry and the render-time resolver both. */
  name?: string | EntityNameItem | EntityNameItem[];
  show_settings_link?: boolean;
  /** The icon+count status row (success/failed/running/disabled/total) —
   * a single on/off toggle, deliberately not a whole separate "view"
   * system like the Environment card's custom_sections: this card only
   * ever has the one optional section. */
  show_stats?: boolean;
  /** Which optional per-row details show — same shape as Stacks/
   * Containers' own visible_badges (checkboxes under one shared "Row
   * details" heading, not standalone toggles — see docs/EDITOR_DESIGN.md
   * rule 5). 'environment' replaces what was a standalone
   * show_environment_pill boolean; see resolveVisibleBadges for the
   * context-sensitive default this carries forward unchanged (hidden
   * specifically when group_by: 'environment', shown otherwise).
   * 'next_run' replaces what was a separate, always-true show_next_run
   * boolean. */
  visible_badges?: ScheduleBadge[];
  group_by?: ScheduleGroupBy;
  /** Device ids, in display order — the SAME list serves three jobs now:
   * which environments are included at all (paired with
   * exclude_device_ids), what order groups display in when group_by:
   * 'environment', and — via the editor's per-row "solo" action — the
   * fast path for "just this one environment," which used to be a
   * separate scope: 'environment' + device_id pair. Environments not
   * listed sort after, alphabetically — same convention as Overview's
   * own environments_order. Everything included by default (nothing
   * excluded) until something actually is — see
   * environment-scope.ts's own doc comment on why opt-out, not
   * opt-in-from-empty. */
  environments_order?: string[];
  exclude_device_ids?: string[];
  /** Whether genuinely global schedules (system cleanup, destination
   * maintenance — the ones with no environment at all) show alongside
   * whichever environments are included. Always available now, not
   * gated behind a scope value — defaults to true (opt-out, matching
   * environments_order/exclude_device_ids' own default). */
  include_global?: boolean;
  sort_by?: ScheduleSortBy;
}

/** Context-sensitive default for visible_badges — matches what
 * show_environment_pill/show_next_run's own defaults were before this
 * became one array field: 'next_run' always included, 'environment'
 * included except specifically when grouped by environment (redundant
 * with the group header there). Only applied when the person hasn't
 * explicitly set visible_badges themselves at all — an explicit array
 * (including a deliberately empty one, hiding both) is respected as-is,
 * not silently overridden the next time group_by changes. This is the
 * one place that distinction matters: within an explicitly-set array,
 * there's no equivalent "explicit vs defaulted" tracking per badge, the
 * same way a single boolean field never needed one either. */
export function resolveVisibleBadges(explicit: ScheduleBadge[] | undefined, groupBy: ScheduleGroupBy | undefined): ScheduleBadge[] {
  if (explicit !== undefined) return explicit;
  return groupBy === 'environment' ? ['next_run'] : ['next_run', 'environment'];
}

import type { LovelaceCardConfig } from 'custom-card-helpers';
import type { EntityNameItem } from '../common/ha-types';
import type { EnvironmentScope } from '../common/environment-scope';

export type UpdatesGroupBy = 'none' | 'environment';

export interface DockhandUpdatesCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-updates-card';
  /** Legacy fields — real, released since 1.1.0 (`scope: 'all' |
   * 'environment'`; `scope: 'selected'` was added later in this same
   * still-unreleased cycle and never shipped). Never written by this
   * card's own editor anymore once environments_order/exclude_device_ids
   * exist; kept purely so an already-saved config keeps working exactly
   * as before, computed fresh each render rather than migrated in place.
   * See resolveIncludedOrderedForUpdates in environment-scope.ts. */
  scope?: EnvironmentScope;
  device_id?: string;
  /** Device ids, in display order — which environments are included
   * (paired with exclude_device_ids) and what order groups display in.
   * Environments not listed sort after, alphabetically — same
   * convention as the Overview and Schedules cards' own
   * environments_order. */
  environments_order?: string[];
  exclude_device_ids?: string[];
  /** Defaults to 'environment' when unset (not 'none', unlike Schedules'
   * own default) — this card grouped by environment automatically,
   * unconditionally, before this field existed, so an already-saved
   * config with no group_by needs to keep doing exactly that rather
   * than silently switching to a flat list. 'none' is the new option:
   * every pending update across every included environment in one flat
   * list, sorted by name — there's no other meaningful sort available
   * here (unlike Stacks/Containers/Schedules' own name/status/etc.
   * choices), so this is really just "grouped or not," not a fuller
   * sort_by-style control. */
  group_by?: UpdatesGroupBy;
  /** Composed (Area/Device/Entity/Floor) or Custom (a plain string) —
   * see common/card-name.ts. */
  name?: string | EntityNameItem | EntityNameItem[];
  /** Hide the whole card when there are no pending updates. Implemented
   * via HA's own native card visibility feature (see the editor's
   * _updateConfig for the full reasoning) — this flag itself just drives
   * the editor's checkbox and whether it keeps `visibility` reconciled;
   * the actual hiding happens entirely through `visibility`, not this
   * flag directly. */
  hide_when_no_updates?: boolean;
  /** Not declared in custom-card-helpers' own LovelaceCardConfig type,
   * but a real, standard field every Lovelace card config supports —
   * HA's hui-card.ts reads this on every card, not something specific
   * to this one. Auto-managed by the editor when hide_when_no_updates
   * is on; left alone (or absent) otherwise, same as it would be for
   * any other card a user configures this way by hand. */
  visibility?: Record<string, unknown>[];
}

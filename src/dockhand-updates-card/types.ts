import type { LovelaceCardConfig } from 'custom-card-helpers';

export interface DockhandUpdatesCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-updates-card';
  scope: 'environment' | 'all';
  device_id?: string;
  title?: string;
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

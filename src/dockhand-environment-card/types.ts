import type { LovelaceCardConfig } from 'custom-card-helpers';

export type CardMode = 'compact' | 'standard' | 'detailed' | 'full' | 'custom';

/** Individual sections a user can toggle independently in "Custom" mode —
 * the same building blocks the four preset modes roll up into fixed
 * combinations of. Order here is also the fixed render order; custom mode
 * doesn't offer section *reordering*, just which ones show. */
export type CustomSection =
  | 'container_counts'
  | 'metrics'
  | 'resources'
  | 'events_summary'
  | 'recent_events'
  | 'top_containers'
  | 'disk_usage'
  | 'history_chart';

export const CUSTOM_SECTION_ORDER: CustomSection[] = [
  'container_counts',
  'metrics',
  'resources',
  'events_summary',
  'recent_events',
  'top_containers',
  'history_chart',
  'disk_usage'
];

/** A reasonable starting point the first time a user switches to Custom —
 * roughly Standard mode's content, not everything at once. */
export const DEFAULT_CUSTOM_SECTIONS: CustomSection[] = ['container_counts', 'metrics', 'resources', 'events_summary'];

export interface DockhandEnvironmentCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-environment-card';
  device_id: string;
  mode?: CardMode;
  /** Only meaningful when mode is 'custom' — which sections to show,
   * independent of any preset mode's fixed combination. */
  custom_sections?: CustomSection[];
  title?: string;
  show_settings_link?: boolean;
}

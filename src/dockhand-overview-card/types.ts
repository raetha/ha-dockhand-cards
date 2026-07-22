import type { LovelaceCardConfig } from 'custom-card-helpers';
import type { CardMode, CustomSection } from '../dockhand-environment-card/types';

export type OverviewSection = 'environments' | 'vulnerabilities' | 'stacks' | 'containers' | 'updates';

export const DEFAULT_SECTION_ORDER: OverviewSection[] = ['environments', 'vulnerabilities', 'updates', 'stacks', 'containers'];

export interface DockhandOverviewCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-overview-card';
  show_environments?: boolean;
  show_vulnerabilities?: boolean;
  show_stacks?: boolean;
  show_containers?: boolean;
  show_updates?: boolean;
  /** Passed through to every per-environment Updates card this generates
   * (each is independently scope: 'environment', so this correctly hides
   * only the specific environment's card that has no updates, never
   * affecting the others). */
  updates_hide_when_no_updates?: boolean;
  environment_mode?: CardMode;
  /** Only meaningful when environment_mode is 'custom' — same
   * custom_sections concept as the Environment card itself, applied
   * uniformly to every environment's column (shared, not per-environment,
   * matching how environment_mode is already a single shared setting
   * rather than configured separately per column). */
  environment_custom_sections?: CustomSection[];
  exclude_device_ids?: string[];
  /** Device ids in the order the user dragged them to, in the editor.
   * Environments not listed here (newly added ones) sort after the
   * ordered ones, alphabetically. */
  environment_order?: string[];
  /** Section order within each environment's column, user-arranged in
   * the editor the same way environment_order is. Sections not listed
   * (newly added ones, e.g. after an update) sort after the ordered
   * ones, in DEFAULT_SECTION_ORDER's relative order. */
  section_order?: OverviewSection[];
}

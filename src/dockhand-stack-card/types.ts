import type { LovelaceCardConfig } from 'custom-card-helpers';
import type { EntityNameItem } from '../common/ha-types';

/** Independently toggleable sections this card renders — order here is
 * also the fixed render order. Unlike Environment card's own
 * custom_sections, there's no separate mode to opt into first; every
 * section defaults to visible and can be hidden individually. */
export type StackSection = 'status' | 'containers' | 'git_sync';

export const STACK_SECTION_ORDER: StackSection[] = ['status', 'containers', 'git_sync'];

export const DEFAULT_STACK_SECTIONS: StackSection[] = ['status', 'containers', 'git_sync'];

export interface DockhandStackCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-stack-card';
  device_id: string;
  /** Which environment device_id is chosen scopes the editor's own
   * stack-picker options to that environment — genuinely redundant with
   * `device_id` (a stack's environment is always derivable from its own
   * device identifiers), but storing it turns the picker into a real
   * persisted schema field instead of scratch UI-only state. Never read
   * by the card itself at render time, only by the editor. */
  environment_device_id?: string;
  /** Which sections show — defaults to every section (DEFAULT_STACK_SECTIONS)
   * when unset, not an empty/hidden state. */
  visible_sections?: StackSection[];
  /** Composed (Area/Device/Entity/Floor) or Custom (a plain string) —
   * see common/card-name.ts. */
  name?: string | EntityNameItem | EntityNameItem[];
  show_settings_link?: boolean;
}

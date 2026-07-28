import type { LovelaceCardConfig } from 'custom-card-helpers';

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
  title?: string;
  show_settings_link?: boolean;
}

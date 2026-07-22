import type { LovelaceCardConfig } from 'custom-card-helpers';

export interface DockhandStackCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-stack-card';
  device_id: string;
  title?: string;
  show_settings_link?: boolean;
}

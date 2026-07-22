import type { LovelaceCardConfig } from 'custom-card-helpers';

export interface DockhandContainerCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-container-card';
  device_id: string;
  title?: string;
  show_settings_link?: boolean;
}

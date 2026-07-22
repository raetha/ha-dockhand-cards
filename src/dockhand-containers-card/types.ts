import type { LovelaceCardConfig } from 'custom-card-helpers';

export interface DockhandContainersCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-containers-card';
  device_id: string;
  title?: string;
}

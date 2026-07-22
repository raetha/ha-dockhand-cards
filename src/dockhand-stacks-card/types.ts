import type { LovelaceCardConfig } from 'custom-card-helpers';

export interface DockhandStacksCardConfig extends LovelaceCardConfig {
  type: 'custom:dockhand-stacks-card';
  device_id: string;
  title?: string;
}

import type { HomeAssistant as BaseHomeAssistant } from 'custom-card-helpers';

// hass.devices / hass.entities were added to the frontend's HomeAssistant
// object relatively recently and aren't part of custom-card-helpers' type
// yet. Declared here rather than pulling in the full HA frontend source
// tree as a dependency, matching what other maintained cards do.

export interface LovelaceGridOptions {
  columns?: number | 'full';
  rows?: number | 'auto';
  max_columns?: number;
  min_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

export interface DeviceRegistryEntry {
  id: string;
  name: string | null;
  name_by_user: string | null;
  model: string | null;
  manufacturer: string | null;
  identifiers: [string, string][];
  config_entries: string[];
  configuration_url: string | null;
  hw_version: string | null;
}

export interface EntityRegistryEntry {
  entity_id: string;
  device_id: string | null;
  platform: string;
  translation_key: string | null;
  unique_id: string;
  disabled_by: string | null;
  hidden_by: string | null;
  entity_category: string | null;
}

export interface HomeAssistant extends BaseHomeAssistant {
  devices: Record<string, DeviceRegistryEntry>;
  entities: Record<string, EntityRegistryEntry>;
}

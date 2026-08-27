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
  via_device_id: string | null;
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

/** Verified directly against HA frontend source
 * (src/common/entity/compute_entity_name_display.ts) — the same "Composed
 * from Area/Device/Entity/Floor, or Custom" value shape the Tile card's
 * own Name field uses (selector: { entity_name: {} }), which this repo's
 * own Name field (see environment-scope.ts's renderNameField) borrows
 * directly rather than reinvent. */
export type EntityNameItem = { type: 'entity' | 'device' | 'area' | 'floor' } | { type: 'text'; text: string };

export interface EntityNameOptions {
  separator?: string;
}

export interface HomeAssistant extends BaseHomeAssistant {
  devices: Record<string, DeviceRegistryEntry>;
  entities: Record<string, EntityRegistryEntry>;
  /** Real, public HA API (verified against src/types.ts) — resolves a
   * composed EntityNameItem/EntityNameItem[] (or a plain string, for a
   * Custom-mode value) against one entity's actual current area/device/
   * floor context. HA does the entire resolution itself; this repo never
   * needs its own area/device/floor lookup logic to use it. Not declared
   * by custom-card-helpers yet (a relatively recent HA addition), same
   * situation as devices/entities above. */
  formatEntityName(
    stateObj: { entity_id: string; attributes: Record<string, unknown> },
    type: string | EntityNameItem | EntityNameItem[] | undefined,
    options?: EntityNameOptions
  ): string;
}

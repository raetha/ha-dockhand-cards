import type {
  HomeAssistant as BaseHomeAssistant,
  DeviceRegistryEntry as BaseDeviceRegistryEntry,
  EntityRegistryDisplayEntry,
  EntityNameItem,
  EntityNameOptions
} from 'custom-card-helpers';

export type { EntityNameItem, EntityNameOptions };

// custom-card-helpers declares hass.devices and hass.entities with the
// fields every card needs; the cards also read a device's identifiers,
// config entry and parent, which it leaves out.

export interface LovelaceGridOptions {
  columns?: number | 'full';
  rows?: number | 'auto';
  max_columns?: number;
  min_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

export interface DeviceRegistryEntry extends BaseDeviceRegistryEntry {
  model: string | null;
  manufacturer: string | null;
  identifiers: [string, string][];
  config_entry_id: string | null;
  configuration_url: string | null;
  hw_version: string | null;
  via_device_id: string | null;
}

/** An entry of `hass.entities`: Home Assistant's display registry, which
 * holds enabled entities only (`config/entity_registry/list_for_display`
 * skips disabled ones; see disabled-entities.ts). */
export type EntityRegistryEntry = EntityRegistryDisplayEntry;

export interface HomeAssistant extends BaseHomeAssistant {
  devices: Record<string, DeviceRegistryEntry>;
  entities: Record<string, EntityRegistryEntry>;
  /** Required here: every Home Assistant the cards support (2026.8+) has
   * it, in the shape that takes a plain string, one EntityNameItem or a
   * list of them. */
  formatEntityName(
    stateObj: { entity_id: string; attributes: Record<string, unknown> },
    type: string | EntityNameItem | EntityNameItem[] | undefined,
    options?: EntityNameOptions
  ): string;
}

/**
 * What each list card can filter on, read from what ha-dockhand provides:
 * the values a row has for each filter (see common/filters.ts). The editor's
 * labels and option lists live in filters-editor.ts, so cards don't carry
 * them.
 */
import { html, nothing, type TemplateResult } from 'lit';
import type { HassEntity } from 'home-assistant-js-websocket';
import type { HomeAssistant } from './ha-types';
import { NONE, type FilterExtractor } from './filters';
import { findPrimaryEntityByDomain, resolveContainerEntities } from './entity-resolver';
import { getStackNameForContainerDevice } from './device-utils';
import { updateStatus } from './update-kind';
import { entityTags } from './tag-pills';
import { t } from './i18n-card';

const KNOWN = (state: string | undefined): state is string => !!state && state !== 'unknown' && state !== 'unavailable';

/** A container's state, with Exited split by exit code (ha-dockhand 2.0's
 * `exit_code`); an exited container without one matches neither. */
export function containerStateValues(stateObj: HassEntity | undefined): string[] {
  const st = stateObj?.state;
  if (!KNOWN(st)) return [];
  if (st !== 'exited') return [st];
  const code = stateObj?.attributes.exit_code;
  return typeof code === 'number' ? [code === 0 ? 'exited_ok' : 'exited_error'] : [];
}

/** A container's health; NONE when it has no health check (ha-dockhand only
 * creates the sensor for one). */
export function containerHealthValues(healthObj: HassEntity | undefined): string[] {
  if (!healthObj) return [NONE];
  return KNOWN(healthObj.state) ? [healthObj.state] : [];
}

export function containerStackValues(hass: HomeAssistant, deviceId: string): string[] {
  const device = hass.devices?.[deviceId];
  if (!device) return [];
  return [getStackNameForContainerDevice(hass, device) ?? NONE];
}

/** Up to date, or what kind of update an entity that's on means. */
export function containerUpdateValues(hass: HomeAssistant, deviceId: string): string[] {
  const update = findPrimaryEntityByDomain(hass, deviceId, 'update')?.state;
  if (update?.state === 'off') return ['up_to_date'];
  if (update?.state === 'on') return [updateStatus(update)!.kind];
  return [];
}

export function tagValues(stateObj: HassEntity | undefined): string[] {
  if (!stateObj) return [];
  const names = entityTags(stateObj).map((tag) => tag.name);
  return names.length ? names : [NONE];
}

/** The filters a row for a container device offers, read from its own
 * entities: the Containers and Updates cards' rows are both containers. */
export function containerFilters<Row>(deviceIdOf: (row: Row) => string | undefined) {
  const entities = (hass: HomeAssistant, row: Row) => {
    const deviceId = deviceIdOf(row);
    return deviceId ? resolveContainerEntities(hass, deviceId, ['state', 'health']).found : {};
  };
  const onDevice = (read: (hass: HomeAssistant, deviceId: string) => string[]): FilterExtractor<Row> => (row, hass) => {
    const deviceId = deviceIdOf(row);
    return deviceId ? read(hass, deviceId) : [];
  };
  return {
    state: ((row, hass) => containerStateValues(entities(hass, row).state?.state)) as FilterExtractor<Row>,
    health: ((row, hass) => containerHealthValues(entities(hass, row).health?.state)) as FilterExtractor<Row>,
    stack: onDevice(containerStackValues),
    update: onDevice(containerUpdateValues),
    tags: ((row, hass) => tagValues(entities(hass, row).state?.state)) as FilterExtractor<Row>
  };
}


/** The line under a filtered list saying how many rows filters hide, unless
 * the card turns it off (`show_filtered_count: false`). */
export function renderFilteredNote(hass: HomeAssistant, hidden: number, show: boolean | undefined): TemplateResult | typeof nothing {
  if (hidden === 0 || show === false) return nothing;
  return html`<div class="filtered-note">${t(hass, 'filtered_hidden', { count: hidden })}</div>`;
}

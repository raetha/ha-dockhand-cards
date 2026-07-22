import type { HomeAssistant } from './ha-types';
import { resolveEnvironmentEntities } from './entity-resolver';

/** The entity whose `pending_updates` attribute is the simplest available
 * aggregate for "does this environment have any pending container
 * update" — ha-dockhand's own per-environment containers count sensor.
 * Checking this one attribute is far simpler than an OR across every
 * per-container update entity, which is what "any pending update"
 * actually means underneath — this is already the aggregate ha-dockhand
 * computes for us, not something invented for this purpose.
 */
export function getPendingUpdatesEntityId(hass: HomeAssistant, deviceId: string): string | undefined {
  return resolveEnvironmentEntities(hass, deviceId, ['containers']).found.containers?.entityId;
}

export function hasPendingUpdates(hass: HomeAssistant, deviceId: string): boolean {
  const entityId = getPendingUpdatesEntityId(hass, deviceId);
  if (!entityId) return true; // unresolved: don't hide on missing data, show as normal
  const count = hass.states[entityId]?.attributes.pending_updates;
  return typeof count === 'number' ? count > 0 : true;
}

/** Builds the `visibility:` config HA's own hui-card.ts natively
 * understands (a real, first-class dashboard feature — see
 * docs/ARCHITECTURE.md for why this replaced an earlier
 * getGridOptions()-based approach). One numeric_state condition per
 * environment device, OR'd together when there's more than one — HA's
 * own condition schema, not something this card invented. Returns
 * undefined if no device resolves to a usable entity, so callers can
 * tell "nothing to build" apart from "build an empty array".
 */
export function buildUpdatesVisibilityCondition(
  hass: HomeAssistant,
  deviceIds: string[]
): Record<string, unknown>[] | undefined {
  const conditions = deviceIds
    .map((deviceId) => getPendingUpdatesEntityId(hass, deviceId))
    .filter((entityId): entityId is string => Boolean(entityId))
    .map((entityId) => ({
      condition: 'numeric_state',
      entity: entityId,
      attribute: 'pending_updates',
      above: 0
    }));

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions;
  return [{ condition: 'or', conditions }];
}

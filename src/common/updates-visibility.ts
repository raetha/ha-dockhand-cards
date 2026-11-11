import type { HomeAssistant } from './ha-types';
import { resolveEnvironmentEntities } from './entity-resolver';
import { numericState } from './format';

/** The environment's Pending updates sensor (ha-dockhand 2.0+): every
 * container whose update entity is on, system containers included, which is
 * what decides whether the Updates card has anything to show. Not
 * Installable updates, which leaves system containers out: the card's rows
 * show their updates too, so it would hide itself while one is pending.
 * One stable entity per environment, so it's safe to bake into a saved
 * `visibility:` config, unlike the per-container update entities, which
 * come and go as containers are recreated. */
export function getPendingUpdatesEntityId(hass: HomeAssistant, deviceId: string): string | undefined {
  return resolveEnvironmentEntities(hass, deviceId, ['pendingUpdates']).found.pendingUpdates?.entityId;
}

function pendingCount(hass: HomeAssistant, entityId: string | undefined): number | undefined {
  return entityId ? numericState(hass.states[entityId]?.state) : undefined;
}

export function hasPendingUpdates(hass: HomeAssistant, deviceId: string): boolean {
  const pending = pendingCount(hass, getPendingUpdatesEntityId(hass, deviceId));
  // Unresolved: don't hide on missing data.
  return pending === undefined ? true : pending > 0;
}

/** Sums the Pending updates sensors of the given environments, the same ones
 * `buildUpdatesVisibilityCondition()` reads, for the Updates card's header
 * count: one source for both "how many" and "whether to show". An
 * environment without a usable sensor adds 0. */
export function getTotalPendingUpdates(hass: HomeAssistant, deviceIds: string[]): number {
  return deviceIds.reduce((sum, deviceId) => sum + (pendingCount(hass, getPendingUpdatesEntityId(hass, deviceId)) ?? 0), 0);
}

/** Builds the `visibility:` config HA's own hui-card.ts natively
 * understands (a real, first-class dashboard feature — see
 * docs/architecture.md for why this replaced an earlier
 * getGridOptions()-based approach). One numeric_state condition per
 * environment device, OR'd together when there's more than one — HA's
 * own condition schema, not something this card invented.
 *
 * Deliberately NOT one condition per individual container's own update
 * entity, despite that being what actually determines "pending" per
 * container — tried exactly that first, and reverted it for two real
 * problems, not hypothetical ones. First: a `visibility:` array is
 * baked into saved YAML at edit time, but individual containers come
 * and go (recreated on every image update, added, removed) — a config
 * built today would silently go stale the moment the container set
 * changed, missing a new container's update or referencing one that no
 * longer exists, with no indication anything needed re-saving. Second:
 * scale — a real environment with 50+ containers turned this into a
 * 50+ condition array, for one toggle. The per-environment aggregate
 * entity this reverted to has neither problem: one stable id per
 * environment that never changes as containers churn, and the array
 * stays exactly N-environments long regardless of container count.
 * Returns undefined if no device resolves to a usable entity, so
 * callers can tell "nothing to build" apart from "build an empty
 * array".
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
      above: 0
    }));

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions;
  return [{ condition: 'or', conditions }];
}

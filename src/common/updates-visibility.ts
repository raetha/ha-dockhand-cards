import type { HomeAssistant } from './ha-types';
import { resolveEnvironmentEntities } from './entity-resolver';

/** The entity whose `pending_updates_total` attribute is the simplest
 * available aggregate for "does this environment have any pending
 * container update, of any kind" — ha-dockhand's own per-environment
 * containers count sensor. Checking this one attribute per environment
 * is what makes this safe to bake into a saved `visibility:` config at
 * all: unlike enumerating every individual container's own update
 * entity (tried, then reverted — see below), this entity id never
 * changes as containers are added, removed, or recreated, so a config
 * built today stays correct indefinitely with no re-edit ever required.
 *
 * Specifically `pending_updates_total`, not that same entity's sibling
 * `pending_updates` attribute — as of ha-dockhand 1.8.2, that sensor
 * exposes three related counts, kept deliberately separate: `pending_updates`
 * is the bulk-update-eligible count (excludes system containers, matching
 * what this integration's own bulk-update button would actually act on),
 * `pending_system_updates` is system containers only, and `pending_updates_total`
 * is the sum of both — "does anything at all need attention," regardless
 * of whether it's something ha-dockhand would ever bulk-update. This
 * card's own rows (dockhand-updates-card/card.ts's `_buildGroups()`)
 * already show a system container's own pending update — it's just as
 * real and just as individually actionable via its own update entity as
 * any other container's, just never bulk-actionable — so "should this
 * card hide itself" needs the total, not the bulk-eligible-only count.
 * Reading `pending_updates` here instead would make the card
 * incorrectly hide itself whenever the only pending update happened to
 * be on a system container, the exact bug this attribute split was
 * introduced to fix. See ha-dockhand's own sensor.py comment on
 * DockhandEnvContainerCountSensor for the full reasoning; this repo
 * just consumes whatever value the entity reports, correct or not, same
 * as any other entity it reads. */
export function getPendingUpdatesEntityId(hass: HomeAssistant, deviceId: string): string | undefined {
  return resolveEnvironmentEntities(hass, deviceId, ['containers']).found.containers?.entityId;
}

export function hasPendingUpdates(hass: HomeAssistant, deviceId: string): boolean {
  const entityId = getPendingUpdatesEntityId(hass, deviceId);
  if (!entityId) return true; // unresolved: don't hide on missing data, show as normal
  const count = hass.states[entityId]?.attributes.pending_updates_total;
  return typeof count === 'number' ? count > 0 : true;
}

/** Sums `pending_updates_total` across every given environment — the
 * same attribute, the same entities, `buildUpdatesVisibilityCondition()`
 * below already reads for the exact same set of environments. Used by
 * the Updates card for its own header count, deliberately in place of
 * separately tallying its own per-container row list
 * (`_buildGroups()`'s own `updates.length` sum) — a card that shows
 * "Updates (N)" using one source while deciding whether to hide itself
 * via a completely different one is exactly the kind of two-methods-
 * for-one-answer split this repo has hit real bugs from before. An
 * environment that doesn't resolve to a usable entity contributes 0 to
 * the sum rather than being skipped or treated as unresolved — unlike
 * `hasPendingUpdates()`'s "unknown means don't hide" default, a header
 * count has no equivalently safe non-zero fallback to default to. */
export function getTotalPendingUpdates(hass: HomeAssistant, deviceIds: string[]): number {
  return deviceIds.reduce((sum, deviceId) => {
    const entityId = getPendingUpdatesEntityId(hass, deviceId);
    const count = entityId ? hass.states[entityId]?.attributes.pending_updates_total : undefined;
    return sum + (typeof count === 'number' ? count : 0);
  }, 0);
}

/** Builds the `visibility:` config HA's own hui-card.ts natively
 * understands (a real, first-class dashboard feature — see
 * docs/ARCHITECTURE.md for why this replaced an earlier
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
      attribute: 'pending_updates_total',
      above: 0
    }));

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions;
  return [{ condition: 'or', conditions }];
}

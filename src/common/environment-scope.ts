import type { EnvironmentDeviceOption } from './device-utils';

/** Every known environment, in environments_order's configured order
 * first, then any not listed (a newly-added environment, or before this
 * has ever been touched) appended alphabetically after — same "unlisted
 * sorts after" convention as Overview's own environments_order and this
 * card's own badge_order. Exported separately from resolveIncludedOrdered
 * because the editor needs the *full* list (including excluded
 * environments, so they can still be re-included) while the card only
 * ever needs the filtered result. */
export function resolveEnvironmentOrder(all: EnvironmentDeviceOption[], order: string[] | undefined): EnvironmentDeviceOption[] {
  const byId = new Map(all.map((e) => [e.deviceId, e]));
  const ordered = (order ?? []).map((id) => byId.get(id)).filter((e): e is EnvironmentDeviceOption => e !== undefined);
  const orderedIds = new Set(ordered.map((e) => e.deviceId));
  const rest = all.filter((e) => !orderedIds.has(e.deviceId)).sort((a, b) => a.name.localeCompare(b.name));
  return [...ordered, ...rest];
}

/** "Every known environment, ordered, minus whatever's excluded" — the
 * function every multi-environment card's row-building calls. */
export function resolveIncludedOrdered(all: EnvironmentDeviceOption[], order: string[] | undefined, excluded: string[] | undefined): EnvironmentDeviceOption[] {
  const excludedSet = new Set(excluded ?? []);
  return resolveEnvironmentOrder(all, order).filter((e) => !excludedSet.has(e.deviceId));
}

/**
 * Buckets rows by environment, ordered the same way `envDevices` already
 * is — no separate "look up each bucket's position in environmentOrder"
 * step at all, which is exactly the mechanism that broke twice this
 * session (Schedules once, Stacks/Containers once): a derived key or
 * order array that could drift out of sync with the actual, already-
 * correct order `resolveEnvironmentOrder`/`resolveIncludedOrdered`
 * produce. The Updates card never had this bug, for exactly this
 * reason — it just iterates its own already-ordered device list
 * directly, one group per environment, and this function generalizes
 * that same approach for any card whose rows carry a device id.
 *
 * `envDevices` must already be in the desired display order (call
 * resolveIncludedOrdered first, the
 * same way every card already does before this) — this function only
 * groups and filters, it doesn't re-derive order from anything.
 * `sortWithinGroup` runs on each bucket's own rows afterward (whatever
 * sort_by means for that card — name, status, and so on), independent
 * of the bucket ordering itself.
 */
export function groupRowsByEnvironment<T extends { environmentDeviceId?: string }>(
  rows: T[],
  envDevices: EnvironmentDeviceOption[],
  sortWithinGroup: (rows: T[]) => T[]
): { label: string; rows: T[] }[] {
  const byDeviceId = new Map<string, T[]>();
  for (const row of rows) {
    if (row.environmentDeviceId === undefined) continue;
    if (!byDeviceId.has(row.environmentDeviceId)) byDeviceId.set(row.environmentDeviceId, []);
    byDeviceId.get(row.environmentDeviceId)!.push(row);
  }
  return envDevices
    .filter((env) => byDeviceId.has(env.deviceId))
    .map((env) => ({ label: env.name, rows: sortWithinGroup(byDeviceId.get(env.deviceId)!) }));
}

/**
 * Resolves a card's own group_by value against how many environments are
 * actually included, specifically for the 'environment' option — every
 * card that groups by environment (Stacks/Containers/Schedules/Updates)
 * now defaults to it, but grouping by environment when only one is
 * included produces a single, redundant group header with nothing to
 * distinguish it from — the same "makes the header pointless" case
 * Updates' own group header logic already excluded for its own single-
 * environment case, generalized here so every card gets it the same way
 * rather than reimplementing the same check once each. Only
 * 'environment' gets this treatment — other group_by values a given
 * card might support ('type', 'status') stay meaningful regardless of
 * how many environments are included, so they're returned unchanged. */
export function resolveEffectiveGroupBy<T extends string>(groupBy: T | 'environment' | 'none' | undefined, envDevices: EnvironmentDeviceOption[], defaultValue: T | 'environment'): T | 'environment' | 'none' {
  const resolved = groupBy ?? defaultValue;
  return resolved === 'environment' && envDevices.length <= 1 ? 'none' : resolved;
}

// renderEnvironmentOrderSection is in environment-scope-editor.ts: it depends
// on i18n and is editor-only.

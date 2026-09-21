import type { EnvironmentDeviceOption } from './device-utils';

/**
 * Three ways a card *used to* relate to "which environments" — real,
 * released legacy shapes for Updates specifically (`scope: 'all'` and
 * `scope: 'environment'` + `device_id`, both shipped in 1.1.0), kept only
 * as the `legacyScope` parameter type for resolveIncludedOrderedWithLegacy
 * below. Every card's own *current* config just uses environments_order/
 * exclude_device_ids directly — nothing new should introduce a `scope`
 * field, this type exists to describe what's already shipped, not as a
 * pattern to extend.
 */
export type EnvironmentScope = 'all' | 'selected' | 'environment';

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
 * function every current card's own row-building calls (directly, or via
 * resolveIncludedOrderedWithLegacy below for the few with a real legacy
 * shape to fall back to first). */
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
 * resolveIncludedOrdered/resolveIncludedOrderedWithLegacy first, the
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

/**
 * Single shared resolver for every card migrating from a legacy single-
 * environment (or, for Updates specifically, scope + single-environment)
 * shape to this shared `environments_order`/`exclude_device_ids` pair —
 * Stacks, Containers, and Updates as of this writing, all real, released
 * config shapes (`device_id` alone since 1.0.0 for the first two;
 * `scope: 'all' | 'environment'` + `device_id` since 1.1.0 for Updates;
 * `scope: 'selected'` was added later in this same still-unreleased
 * cycle and never shipped, so it needs no migration path of its own — an
 * already-`environments_order`/`exclude_device_ids` config from that
 * in-between state is handled by the normal resolveIncludedOrdered
 * branch below, same as a fully-migrated one).
 *
 * Deliberately does *not* migrate anything in the stored config, in
 * setConfig() or anywhere else: an existing legacy config keeps working
 * exactly as saved, indefinitely, computed fresh each time from
 * whichever fields are actually present, rather than being rewritten on
 * first load. Once the person actually interacts with the Environments
 * section (drag, exclude, solo — any of it), the editor's own
 * onMoved/onToggleExcluded callbacks write real environments_order/
 * exclude_device_ids values, which take over from the legacy fields from
 * that point on.
 *
 * `legacyScope` is what distinguishes the two real shapes this covers:
 * omitted entirely (Stacks/Containers, which never had a scope concept
 * at all) — solos `legacyDeviceId` whenever it's present, no scope check
 * needed. Passed explicitly (Updates) — only solos when scope is
 * specifically `'environment'`, so a `device_id` left over from some
 * hand-edited YAML doesn't accidentally solo an environment while scope
 * is `'all'`. Consolidated from two separate near-identical functions
 * (one per card), once it was clear they differed only in this one
 * respect — worth remembering as the shape any *future* card's own
 * legacy-shape migration should extend this same function to cover, not
 * a third near-copy.
 */
export function resolveIncludedOrderedWithLegacy(
  all: EnvironmentDeviceOption[],
  order: string[] | undefined,
  excluded: string[] | undefined,
  legacyDeviceId: string | undefined,
  legacyScope?: EnvironmentScope
): EnvironmentDeviceOption[] {
  if (order !== undefined || excluded !== undefined) {
    return resolveIncludedOrdered(all, order, excluded);
  }
  const shouldSolo = legacyScope !== undefined ? legacyScope === 'environment' : Boolean(legacyDeviceId);
  if (shouldSolo) {
    return legacyDeviceId ? all.filter((d) => d.deviceId === legacyDeviceId) : [];
  }
  return resolveIncludedOrdered(all, order, excluded);
}

// effectiveExcludeDeviceIds and renderEnvironmentOrderSection have moved to
// environment-scope-editor.ts — they depend on i18n and are editor-only.

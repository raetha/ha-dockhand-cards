/**
 * Deletes every key whose value is `undefined` from a merged config
 * object, in place, and returns it. Every editor's own `_updateConfig()`
 * runs its merged patch through this before firing `config-changed`: a
 * caller clears a field by passing `field: undefined`, but a plain object
 * spread keeps that key with the value `undefined` rather than removing
 * it, and an undefined key isn't the same as an absent one once the
 * config is saved.
 */
export function stripUndefinedKeys<T extends Record<string, unknown>>(config: T): T {
  for (const key of Object.keys(config)) {
    if (config[key] === undefined) delete config[key];
  }
  return config;
}

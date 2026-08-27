/**
 * Deletes every key whose value is `undefined` from a merged config
 * object, in place, and returns it. Every editor's own `_updateConfig()`
 * runs its merged patch through this before firing `config-changed` —
 * a caller clearing a legacy field (Stacks/Containers/Updates' own
 * `device_id`; Updates' own `scope`; Overview's own
 * `exclude_device_ids`/`environments_overrides`) does it by passing
 * `field: undefined` in its patch, which reads naturally and matches
 * every other optional field's own convention — but a plain object
 * spread (`{ ...config, ...patch }`) keeps that key with value
 * `undefined` rather than actually removing it. An object key set to
 * `undefined` isn't the same thing as an absent key once this config
 * gets serialized for storage, and depending on an assumption about
 * whether HA's own save path treats those two the same is exactly the
 * kind of thing not worth risking — `card-name.ts`'s own
 * `migrateTitleToName()` had this exact gap for a while (stripped a
 * deprecated field's value only in the branch that used it, silently
 * keeping the key forever in the one case it didn't), caught by a
 * maintainer question about whether deprecated keys were being cleaned
 * up properly, not by a test written beforehand. This is the one place
 * that "clear this field" intent, expressed via `undefined` at every
 * call site, becomes a real deletion.
 */
export function stripUndefinedKeys<T extends Record<string, unknown>>(config: T): T {
  for (const key of Object.keys(config)) {
    if (config[key] === undefined) delete config[key];
  }
  return config;
}

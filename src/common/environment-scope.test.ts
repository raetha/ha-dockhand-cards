import { describe, it, expect } from 'vitest';
import { resolveEnvironmentOrder, resolveIncludedOrdered, groupRowsByEnvironment, resolveEffectiveGroupBy } from './environment-scope';
import { makeDevice } from './test-fixtures';

const ENV_A = makeDevice({ id: 'a', identifiers: [['dockhand', 'env_1']], name: 'Aurora' });
const ENV_B = makeDevice({ id: 'b', identifiers: [['dockhand', 'env_2']], name: 'Bifrost' });
const ENV_C = makeDevice({ id: 'c', identifiers: [['dockhand', 'env_3']], name: 'Heimdall' });

describe('resolveEnvironmentOrder', () => {
  const all = [ENV_A, ENV_B, ENV_C].map((d) => ({ deviceId: d.id, name: d.name! }));

  it('returns everything alphabetical when order is unset', () => {
    expect(resolveEnvironmentOrder(all, undefined).map((e) => e.name)).toEqual(['Aurora', 'Bifrost', 'Heimdall']);
  });

  it('respects a full custom order', () => {
    expect(resolveEnvironmentOrder(all, ['c', 'a', 'b']).map((e) => e.name)).toEqual(['Heimdall', 'Aurora', 'Bifrost']);
  });

  it('appends environments missing from order after the named ones, alphabetically', () => {
    expect(resolveEnvironmentOrder(all, ['c']).map((e) => e.name)).toEqual(['Heimdall', 'Aurora', 'Bifrost']);
  });

  it('ignores order entries that no longer match a known device id', () => {
    expect(resolveEnvironmentOrder(all, ['nonexistent', 'a']).map((e) => e.name)).toEqual(['Aurora', 'Bifrost', 'Heimdall']);
  });
});

describe('resolveIncludedOrdered', () => {
  const all = [{ deviceId: 'a', name: 'Aurora' }, { deviceId: 'b', name: 'Bifrost' }, { deviceId: 'c', name: 'Heimdall' }];

  it('includes everything, alphabetical, when order/excluded are both unset', () => {
    expect(resolveIncludedOrdered(all, undefined, undefined).map((e) => e.name)).toEqual(['Aurora', 'Bifrost', 'Heimdall']);
  });

  it('respects a custom order and excludes the listed device ids', () => {
    const result = resolveIncludedOrdered(all, ['c', 'a', 'b'], ['b']);
    expect(result.map((e) => e.name)).toEqual(['Heimdall', 'Aurora']);
  });

  it('excluding everything leaves an empty list, not a fallback to "all"', () => {
    expect(resolveIncludedOrdered(all, undefined, ['a', 'b', 'c'])).toEqual([]);
  });
});

describe('groupRowsByEnvironment', () => {
  const envs = [
    { deviceId: 'z', name: 'Zeta' },
    { deviceId: 'a', name: 'Aurora' }
  ];

  it('groups rows by environmentDeviceId, ordered exactly as envDevices is passed in — not re-derived from any key comparison', () => {
    const rows = [
      { environmentDeviceId: 'a', name: 'row-a' },
      { environmentDeviceId: 'z', name: 'row-z' }
    ];
    const groups = groupRowsByEnvironment(rows, envs, (r) => r);
    expect(groups.map((g) => g.label)).toEqual(['Zeta', 'Aurora']);
  });

  it('an environment with no rows produces no bucket, even when present in envDevices', () => {
    const rows = [{ environmentDeviceId: 'a', name: 'row-a' }];
    const groups = groupRowsByEnvironment(rows, envs, (r) => r);
    expect(groups.map((g) => g.label)).toEqual(['Aurora']);
  });

  it('rows with no environmentDeviceId (a global/unscoped row) are excluded entirely, not bucketed under anything', () => {
    const rows = [{ environmentDeviceId: undefined, name: 'global-row' }, { environmentDeviceId: 'a', name: 'row-a' }];
    const groups = groupRowsByEnvironment(rows, envs, (r) => r);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows.map((r) => r.name)).toEqual(['row-a']);
  });

  it('applies sortWithinGroup to each bucket independently', () => {
    const rows = [
      { environmentDeviceId: 'a', name: 'b' },
      { environmentDeviceId: 'a', name: 'a' }
    ];
    const groups = groupRowsByEnvironment(rows, envs, (r) => [...r].sort((x, y) => x.name.localeCompare(y.name)));
    expect(groups[0].rows.map((r) => r.name)).toEqual(['a', 'b']);
  });
});

describe('resolveEffectiveGroupBy', () => {
  const oneEnv = [{ deviceId: 'a', name: 'Aurora' }];
  const twoEnvs = [
    { deviceId: 'a', name: 'Aurora' },
    { deviceId: 'b', name: 'Bifrost' }
  ];

  it('defaults to the given default value when group_by is unset', () => {
    expect(resolveEffectiveGroupBy(undefined, twoEnvs, 'environment')).toBe('environment');
  });

  it('suppresses environment to none when only one environment is included, whether from an explicit value or the default', () => {
    expect(resolveEffectiveGroupBy('environment', oneEnv, 'environment')).toBe('none');
    expect(resolveEffectiveGroupBy(undefined, oneEnv, 'environment')).toBe('none');
  });

  it('suppresses environment to none when zero environments are included too', () => {
    expect(resolveEffectiveGroupBy('environment', [], 'environment')).toBe('none');
  });

  it('keeps environment when more than one environment is included', () => {
    expect(resolveEffectiveGroupBy('environment', twoEnvs, 'environment')).toBe('environment');
  });

  it('leaves an explicit none alone regardless of environment count', () => {
    expect(resolveEffectiveGroupBy('none', twoEnvs, 'environment')).toBe('none');
    expect(resolveEffectiveGroupBy('none', oneEnv, 'environment')).toBe('none');
  });

  it('other group_by values (type/status) pass through unaffected by environment count, since only environment grouping becomes meaningless with one environment', () => {
    expect(resolveEffectiveGroupBy('type', oneEnv, 'environment')).toBe('type');
    expect(resolveEffectiveGroupBy('status', oneEnv, 'environment')).toBe('status');
  });
});


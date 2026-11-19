import { describe, it, expect } from 'vitest';
import { sortStackRows, groupStackRows, isProblem } from './card';
import type { HomeAssistant } from '../common/ha-types';
import type { EnvironmentDeviceOption } from '../common/device-utils';

function row(overrides: Partial<Parameters<typeof sortStackRows>[0][number]> = {}) {
  return {
    deviceId: 'stack_device',
    name: 'stack',
    type: 'compose',
    status: 'running',
    environment: 'Nebula',
    environmentDeviceId: 'env_nebula',
    found: {} as never,
    ...overrides
  };
}

function env(deviceId: string, name: string): EnvironmentDeviceOption {
  return { deviceId, name };
}

describe('sortStackRows', () => {
  it('sorts by name by default, then environment as a tiebreak', () => {
    const rows = [row({ name: 'b', environment: 'Vega' }), row({ name: 'a', environment: 'Nebula' }), row({ name: 'a', environment: 'Aurora' })];
    const sorted = sortStackRows(rows, 'name');
    expect(sorted.map((r) => `${r.name}/${r.environment}`)).toEqual(['a/Aurora', 'a/Nebula', 'b/Vega']);
  });

  it('sorts problems first when sorting by status', () => {
    const rows = [row({ name: 'z', status: 'running' }), row({ name: 'a', status: 'stopped' }), row({ name: 'm', status: 'partial' })];
    const sorted = sortStackRows(rows, 'status');
    expect(sorted.map((r) => r.status)).toEqual(['stopped', 'partial', 'running']);
  });

  it('sorts the most containers first, then by name; unknown counts last', () => {
    const count = (n: string | undefined) => ({ containersInStack: n === undefined ? undefined : { state: { state: n } } }) as never;
    const rows = [row({ name: 'plex', found: count('1') }), row({ name: 'unknown', found: count(undefined) }), row({ name: 'immich', found: count('4') }), row({ name: 'arr', found: count('1') })];
    expect(sortStackRows(rows, 'containers').map((r) => r.name)).toEqual(['immich', 'arr', 'plex', 'unknown']);
  });
});

describe('groupStackRows', () => {
  it('returns one ungrouped bucket when group_by is none or unset', () => {
    const rows = [row({ name: 'b' }), row({ name: 'a' })];
    expect(groupStackRows(rows, 'none', 'name')).toEqual([{ label: null, rows: sortStackRows(rows, 'name') }]);
    expect(groupStackRows(rows, undefined, 'name')).toEqual([{ label: null, rows: sortStackRows(rows, 'name') }]);
  });

  it('groups by environment, ordered exactly as envDevices is passed in — not re-derived from any separate order array', () => {
    // envDevices is the ordered list _buildRows() makes
    // (resolveIncludedOrderedWithLegacy), and groupStackRows follows it.
    // It's in neither ID nor name order, so only that order can pass.
    const rows = [row({ environment: 'Aurora', environmentDeviceId: 'env_a' }), row({ environment: 'Vega', environmentDeviceId: 'env_v' })];
    const groups = groupStackRows(rows, 'environment', 'name', [env('env_v', 'Vega'), env('env_a', 'Aurora')]);
    expect(groups.map((g) => g.label)).toEqual(['Vega', 'Aurora']);
  });

  it('an environment with no rows produces no bucket, even if listed in envDevices', () => {
    const rows = [row({ environment: 'Aurora', environmentDeviceId: 'env_a' })];
    const groups = groupStackRows(rows, 'environment', 'name', [env('env_a', 'Aurora'), env('env_v', 'Vega')]);
    expect(groups.map((g) => g.label)).toEqual(['Aurora']);
  });

  it('falls back to whatever order envDevices is passed in when nothing has been dragged — matching the Environments panel default (alphabetical by name)', () => {
    // _buildRows() always resolves envDevices via
    // resolveIncludedOrderedWithLegacy first, which already sorts
    // unlisted/undragged environments alphabetically by name — so
    // groupStackRows doesn't need its own "no order set" fallback logic
    // at all anymore, it just reflects whatever order it's handed.
    const rows = [row({ environment: 'Zeta', environmentDeviceId: 'env_z' }), row({ environment: 'Aurora', environmentDeviceId: 'env_a' })];
    const groups = groupStackRows(rows, 'environment', 'name', [env('env_a', 'Aurora'), env('env_z', 'Zeta')]);
    expect(groups.map((g) => g.label)).toEqual(['Aurora', 'Zeta']);
  });

  it('groups by status with problems first', () => {
    const rows = [row({ status: 'running' }), row({ status: 'stopped' }), row({ status: 'partial' })];
    const groups = groupStackRows(rows, 'status', 'name');
    expect(groups.map((g) => g.label)).toEqual(['Stopped', 'Partial', 'Running']);
  });

  it('groups by type', () => {
    const rows = [row({ type: 'git' }), row({ type: 'compose' })];
    const groups = groupStackRows(rows, 'type', 'name');
    expect(groups.map((g) => g.label).sort()).toEqual(['Compose', 'Git']);
  });
});

describe('isProblem', () => {
  it('is a stopped, partial or restarting stack, or one whose Git sync failed', () => {
    const hass = (sync?: string) =>
      ({
        entities: sync ? { 'sensor.git': { entity_id: 'sensor.git', device_id: 'stack_device', platform: 'dockhand', translation_key: 'git_stack_sync_status' } } : {},
        states: sync ? { 'sensor.git': { entity_id: 'sensor.git', state: sync, attributes: {} } } : {}
      }) as unknown as HomeAssistant;
    expect(['stopped', 'partial', 'restarting'].every((status) => isProblem(row({ status }), hass()))).toBe(true);
    expect(isProblem(row({ status: 'running' }), hass())).toBe(false);
    expect(isProblem(row({ status: 'running' }), hass('error'))).toBe(true);
    expect(isProblem(row({ status: 'running' }), hass('synced'))).toBe(false);
  });
});

describe('sortStackRows by resource use', () => {
  const stats = (cpu: string | undefined, memMiB: string | undefined) =>
    ({
      cpuPercent: cpu === undefined ? undefined : { state: { state: cpu, attributes: { unit_of_measurement: '%' } } },
      memoryUsage: memMiB === undefined ? undefined : { state: { state: memMiB, attributes: { unit_of_measurement: 'MiB' } } }
    }) as never;

  it('puts the busiest CPU first, in whole percent, then by name; none last', () => {
    const rows = [row({ name: 'b', found: stats('2.4', '1') }), row({ name: 'none', found: stats(undefined, undefined) }), row({ name: 'c', found: stats('9', '1') }), row({ name: 'a', found: stats('2.1', '1') })];
    expect(sortStackRows(rows, 'cpu').map((r) => r.name)).toEqual(['c', 'a', 'b', 'none']);
  });

  it('puts the most memory in use first, by amount, as Dockhand does', () => {
    const rows = [row({ name: 'small', found: stats('1', '100') }), row({ name: 'none', found: stats('1', undefined) }), row({ name: 'big', found: stats('1', '2048') })];
    expect(sortStackRows(rows, 'memory').map((r) => r.name)).toEqual(['big', 'small', 'none']);
  });
});

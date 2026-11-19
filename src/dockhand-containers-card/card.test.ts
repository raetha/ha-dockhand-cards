import { describe, it, expect } from 'vitest';
import { sortContainerRows, groupContainerRows, isProblem } from './card';
import type { EnvironmentDeviceOption } from '../common/device-utils';

function row(overrides: Partial<Parameters<typeof sortContainerRows>[0][number]> = {}) {
  return {
    deviceId: 'container_device',
    name: 'container',
    status: 'running',
    environment: 'Nebula',
    environmentDeviceId: 'env_nebula',
    found: {} as never,
    updateEntityId: null,
    ...overrides
  };
}

function env(deviceId: string, name: string): EnvironmentDeviceOption {
  return { deviceId, name };
}

describe('sortContainerRows', () => {
  it('sorts by name by default, then environment as a tiebreak', () => {
    const rows = [row({ name: 'b', environment: 'Vega' }), row({ name: 'a', environment: 'Nebula' }), row({ name: 'a', environment: 'Aurora' })];
    const sorted = sortContainerRows(rows, 'name');
    expect(sorted.map((r) => `${r.name}/${r.environment}`)).toEqual(['a/Aurora', 'a/Nebula', 'b/Vega']);
  });

  it('sorts problems first when sorting by status', () => {
    const rows = [row({ name: 'z', status: 'running' }), row({ name: 'a', status: 'dead' }), row({ name: 'm', status: 'paused' })];
    const sorted = sortContainerRows(rows, 'status');
    expect(sorted.map((r) => r.status)).toEqual(['dead', 'paused', 'running']);
  });

  it('sorts the busiest first by CPU or memory, then by name; rows without a value last', () => {
    const usage = (cpu: string | undefined, mem: string | undefined) =>
      ({
        cpuPercent: cpu === undefined ? undefined : { state: { state: cpu } },
        memoryPercent: mem === undefined ? undefined : { state: { state: mem } }
      }) as never;
    const rows = [
      row({ name: 'idle', found: usage('0', '1') }),
      row({ name: 'plex', found: usage('112', '3') }),
      row({ name: 'stopped', found: usage(undefined, undefined) }),
      row({ name: 'immich', found: usage('0', '4') }),
      row({ name: 'adguard', found: usage('0', 'unavailable') }),
      // Shows 0%, like idle and immich: sorts with them by name.
      row({ name: 'busybox', found: usage('0.43', '0.4') })
    ];
    expect(sortContainerRows(rows, 'cpu').map((r) => r.name)).toEqual(['plex', 'adguard', 'busybox', 'idle', 'immich', 'stopped']);
    expect(sortContainerRows(rows, 'memory').map((r) => r.name)).toEqual(['immich', 'plex', 'idle', 'busybox', 'adguard', 'stopped']);
  });
});

describe('groupContainerRows', () => {
  it('returns one ungrouped bucket when group_by is none or unset', () => {
    const rows = [row({ name: 'b' }), row({ name: 'a' })];
    expect(groupContainerRows(rows, 'none', 'name')).toEqual([{ label: null, rows: sortContainerRows(rows, 'name') }]);
    expect(groupContainerRows(rows, undefined, 'name')).toEqual([{ label: null, rows: sortContainerRows(rows, 'name') }]);
  });

  it('groups by environment, ordered exactly as envDevices is passed in — not re-derived from any separate order array', () => {
    const rows = [row({ environment: 'Aurora', environmentDeviceId: 'env_a' }), row({ environment: 'Vega', environmentDeviceId: 'env_v' })];
    const groups = groupContainerRows(rows, 'environment', 'name', [env('env_v', 'Vega'), env('env_a', 'Aurora')]);
    expect(groups.map((g) => g.label)).toEqual(['Vega', 'Aurora']);
  });

  it('an environment with no rows produces no bucket, even if listed in envDevices', () => {
    const rows = [row({ environment: 'Aurora', environmentDeviceId: 'env_a' })];
    const groups = groupContainerRows(rows, 'environment', 'name', [env('env_a', 'Aurora'), env('env_v', 'Vega')]);
    expect(groups.map((g) => g.label)).toEqual(['Aurora']);
  });

  it('falls back to whatever order envDevices is passed in when nothing has been dragged — matching the Environments panel default (alphabetical by name)', () => {
    const rows = [row({ environment: 'Zeta', environmentDeviceId: 'env_z' }), row({ environment: 'Aurora', environmentDeviceId: 'env_a' })];
    const groups = groupContainerRows(rows, 'environment', 'name', [env('env_a', 'Aurora'), env('env_z', 'Zeta')]);
    expect(groups.map((g) => g.label)).toEqual(['Aurora', 'Zeta']);
  });

  it('groups by status with problems first', () => {
    const rows = [row({ status: 'running' }), row({ status: 'dead' }), row({ status: 'paused' })];
    const groups = groupContainerRows(rows, 'status', 'name');
    expect(groups.map((g) => g.label)).toEqual(['Dead', 'Paused', 'Running']);
  });
});

describe('isProblem', () => {
  it('is an exited, dead or restarting container, or an unhealthy one', () => {
    const found = (state: string, exitCode?: number, health = 'healthy') =>
      ({ state: { state: { state, attributes: exitCode === undefined ? {} : { exit_code: exitCode } } }, health: { state: { state: health } } }) as never;
    expect(isProblem(row({ found: found('exited', 137) }))).toBe(true);
    expect(isProblem(row({ found: found('dead') }))).toBe(true);
    expect(isProblem(row({ found: found('restarting') }))).toBe(true);
    expect(isProblem(row({ found: found('running', undefined, 'unhealthy') }))).toBe(true);
    // A clean exit, or one without an exit code, isn't a problem.
    expect(isProblem(row({ found: found('exited', 0) }))).toBe(false);
    expect(isProblem(row({ found: found('exited') }))).toBe(false);
    expect(['running', 'paused', 'created'].some((state) => isProblem(row({ found: found(state) })))).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { sortContainerRows, groupContainerRows } from './card';
import type { EnvironmentDeviceOption } from '../common/device-utils';

function row(overrides: Partial<Parameters<typeof sortContainerRows>[0][number]> = {}) {
  return {
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

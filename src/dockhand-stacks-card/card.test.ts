import { describe, it, expect } from 'vitest';
import { sortStackRows, groupStackRows } from './card';
import type { EnvironmentDeviceOption } from '../common/device-utils';

function row(overrides: Partial<Parameters<typeof sortStackRows>[0][number]> = {}) {
  return {
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
});

describe('groupStackRows', () => {
  it('returns one ungrouped bucket when group_by is none or unset', () => {
    const rows = [row({ name: 'b' }), row({ name: 'a' })];
    expect(groupStackRows(rows, 'none', 'name')).toEqual([{ label: null, rows: sortStackRows(rows, 'name') }]);
    expect(groupStackRows(rows, undefined, 'name')).toEqual([{ label: null, rows: sortStackRows(rows, 'name') }]);
  });

  it('groups by environment, ordered exactly as envDevices is passed in — not re-derived from any separate order array', () => {
    // envDevices is the same already-ordered list _buildRows() produces
    // (via resolveIncludedOrderedWithLegacy) — groupStackRows no longer
    // does its own order lookup at all, so there's no separate array to
    // get out of sync with it. Deliberately passed in an order that
    // doesn't match either device-id or name alphabetical, so this only
    // passes if envDevices' own order is really what's driving bucket
    // order.
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

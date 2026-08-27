import { describe, it, expect } from 'vitest';
import { sortScheduleRows, groupScheduleRows, type ScheduleRow } from './card';

function row(overrides: Partial<ScheduleRow> & { name: string }): ScheduleRow {
  return {
    entityId: `sensor.${overrides.name}`,
    type: 'container_update',
    enabled: true,
    status: 'success',
    nextRunIso: null,
    ...overrides
  };
}

describe('sortScheduleRows', () => {
  it('sorts by name alphabetically', () => {
    const rows = [row({ name: 'zebra' }), row({ name: 'alpha' }), row({ name: 'mango' })];
    expect(sortScheduleRows(rows, 'name').map((r) => r.name)).toEqual(['alpha', 'mango', 'zebra']);
  });

  it('breaks a name tie by environment name — e.g. two environments each with a git stack called "myapp"', () => {
    const rows = [
      row({ name: 'Git sync: myapp', environment: 'Heimdall' }),
      row({ name: 'Git sync: myapp', environment: 'Aurora' })
    ];
    expect(sortScheduleRows(rows, 'name').map((r) => r.environment)).toEqual(['Aurora', 'Heimdall']);
  });

  it('sorts a global schedule (no environment) ahead of a same-named environment-scoped one in a tie', () => {
    const rows = [row({ name: 'Cleanup', environment: 'Heimdall' }), row({ name: 'Cleanup', environment: undefined })];
    expect(sortScheduleRows(rows, 'name').map((r) => r.environment)).toEqual([undefined, 'Heimdall']);
  });

  it("doesn't let environment resolution order silently influence tie-breaking — only the schedule's own name/environment values matter, not array position", () => {
    // Same names, same environments, but rows arrive in the opposite order
    // from what an environment-order-based iteration would naturally
    // produce — result should be identical either way, since the tiebreak
    // is now explicit rather than incidentally preserving input order
    // (Array.sort is stable, so this used to matter).
    const forward = [row({ name: 'Backup', environment: 'Aurora' }), row({ name: 'Backup', environment: 'Bifrost' })];
    const reversed = [row({ name: 'Backup', environment: 'Bifrost' }), row({ name: 'Backup', environment: 'Aurora' })];
    const forwardResult = sortScheduleRows(forward, 'name').map((r) => r.environment);
    const reversedResult = sortScheduleRows(reversed, 'name').map((r) => r.environment);
    expect(forwardResult).toEqual(reversedResult);
    expect(forwardResult).toEqual(['Aurora', 'Bifrost']);
  });

  it('sorts by next_run ascending, with no-next-run rows last', () => {
    const rows = [
      row({ name: 'later', nextRunIso: '2026-01-02T00:00:00Z' }),
      row({ name: 'disabled', nextRunIso: null }),
      row({ name: 'soonest', nextRunIso: '2026-01-01T00:00:00Z' })
    ];
    expect(sortScheduleRows(rows, 'next_run').map((r) => r.name)).toEqual(['soonest', 'later', 'disabled']);
  });

  it('sorts multiple no-next-run rows alphabetically among themselves, still last', () => {
    const rows = [
      row({ name: 'zebra', nextRunIso: null }),
      row({ name: 'has-run', nextRunIso: '2026-01-01T00:00:00Z' }),
      row({ name: 'alpha', nextRunIso: null })
    ];
    expect(sortScheduleRows(rows, 'next_run').map((r) => r.name)).toEqual(['has-run', 'alpha', 'zebra']);
  });

  it('sorts by status, attention-first: failed/error/cancelled before warning/stale before running before queued/skipped before success', () => {
    const rows = [
      row({ name: 'ok', status: 'success' }),
      row({ name: 'bad', status: 'failed' }),
      row({ name: 'busy', status: 'running' }),
      row({ name: 'stale-one', status: 'stale' }),
      row({ name: 'waiting', status: 'queued' })
    ];
    expect(sortScheduleRows(rows, 'status').map((r) => r.name)).toEqual(['bad', 'stale-one', 'busy', 'waiting', 'ok']);
  });

  it('sorts a schedule that never ran (status: null) after everything else, even after success', () => {
    const rows = [row({ name: 'never-run', status: null }), row({ name: 'succeeded', status: 'success' })];
    expect(sortScheduleRows(rows, 'status').map((r) => r.name)).toEqual(['succeeded', 'never-run']);
  });

  it('an unrecognized future status ranks alongside queued/skipped, not treated as an error', () => {
    const rows = [
      row({ name: 'brand-new-status', status: 'something_dockhand_adds_later' }),
      row({ name: 'failed-one', status: 'failed' }),
      row({ name: 'success-one', status: 'success' })
    ];
    const result = sortScheduleRows(rows, 'status').map((r) => r.name);
    expect(result[0]).toBe('failed-one');
    expect(result[result.length - 1]).toBe('success-one');
    expect(result).toContain('brand-new-status');
  });
});

describe('groupScheduleRows', () => {
  it('returns a single ungrouped group when group_by is none/undefined', () => {
    const rows = [row({ name: 'b', type: 'image_prune' }), row({ name: 'a', type: 'container_update' })];
    expect(groupScheduleRows(rows, undefined, 'name')[0].label).toBeNull();
    expect(groupScheduleRows(rows, 'none', 'name')[0].label).toBeNull();
    expect(groupScheduleRows(rows, 'none', 'name')[0].rows.map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('groups by type, sorted alphabetically by humanized type label, sort applied within each group', () => {
    const rows = [
      row({ name: 'zebra-update', type: 'container_update' }),
      row({ name: 'alpha-update', type: 'container_update' }),
      row({ name: 'prune-1', type: 'image_prune' })
    ];
    const groups = groupScheduleRows(rows, 'type', 'name');
    expect(groups.map((g) => g.label)).toEqual(['Container update', 'Image prune']);
    expect(groups[0].rows.map((r) => r.name)).toEqual(['alpha-update', 'zebra-update']);
    expect(groups[1].rows.map((r) => r.name)).toEqual(['prune-1']);
  });

  it('humanizes the type label by replacing underscores and capitalizing the first letter only', () => {
    const rows = [row({ name: 'a', type: 'git_stack_sync' })];
    const groups = groupScheduleRows(rows, 'type', 'name');
    expect(groups[0].label).toBe('Git stack sync');
  });

  it('groups by environment, ordered exactly as envDevices is passed in, with global (no environment) schedules bucketed separately and sorted first', () => {
    // envDevices deliberately in an order that doesn't match either
    // device-id or name alphabetical, so this only passes if envDevices'
    // own order is really what's driving bucket order — not a separate
    // re-derived comparison.
    const rows = [
      row({ name: 'a', environment: 'Heimdall', environmentDeviceId: 'env_heimdall' }),
      row({ name: 'b', environment: 'Bifrost', environmentDeviceId: 'env_bifrost' }),
      row({ name: 'c', environment: undefined })
    ];
    const groups = groupScheduleRows(rows, 'environment', 'name', [
      { deviceId: 'env_heimdall', name: 'Heimdall' },
      { deviceId: 'env_bifrost', name: 'Bifrost' }
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Global', 'Heimdall', 'Bifrost']);
  });

  it('does not confuse a real environment literally named "Global" with the global-schedules bucket', () => {
    const rows = [
      row({ name: 'a', environment: 'Global', environmentDeviceId: 'env_global' }),
      row({ name: 'b', environment: undefined }),
      row({ name: 'c', environment: 'Aurora', environmentDeviceId: 'env_aurora' })
    ];
    const groups = groupScheduleRows(rows, 'environment', 'name', [
      { deviceId: 'env_global', name: 'Global' },
      { deviceId: 'env_aurora', name: 'Aurora' }
    ]);
    // Both buckets are labeled "Global" (one is the real environment, one
    // is the synthetic bucket) — what matters is there are two distinct
    // groups, not one merged bucket with 2 rows.
    expect(groups).toHaveLength(3);
    expect(groups.filter((g) => g.label === 'Global')).toHaveLength(2);
    expect(groups.map((g) => g.rows.length).sort()).toEqual([1, 1, 1]);
  });

  it('an environment with no rows produces no bucket, even if listed in envDevices', () => {
    const rows = [row({ name: 'a', environment: 'Aurora', environmentDeviceId: 'env_a' })];
    const groups = groupScheduleRows(rows, 'environment', 'name', [
      { deviceId: 'env_a', name: 'Aurora' },
      { deviceId: 'env_v', name: 'Vega' }
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Aurora']);
  });

  it('ignores envDevices ordering entirely when grouping by anything other than environment', () => {
    const rows = [row({ name: 'a', type: 'image_prune' }), row({ name: 'b', type: 'container_update' })];
    const groups = groupScheduleRows(rows, 'type', 'name', [{ deviceId: 'irrelevant', name: 'should be ignored' }]);
    expect(groups.map((g) => g.label)).toEqual(['Container update', 'Image prune']);
  });

  it('groups by status, attention-first: failed/error before stale/warning before running before queued/skipped before success before never-run before disabled', () => {
    const rows = [
      row({ name: 'ok', status: 'success' }),
      row({ name: 'bad', status: 'failed' }),
      row({ name: 'off', status: 'success', enabled: false }),
      row({ name: 'fresh', status: null })
    ];
    const groups = groupScheduleRows(rows, 'status', 'name');
    expect(groups.map((g) => g.label)).toEqual(['Failed', 'Success', 'Never run', 'Disabled']);
  });

  it('a disabled schedule groups under Disabled regardless of its last recorded status', () => {
    const rows = [row({ name: 'a', status: 'failed', enabled: false })];
    const groups = groupScheduleRows(rows, 'status', 'name');
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Disabled');
  });
});

import { describe, it, expect } from 'vitest';
import { eventLookupKey, pendingUpdateSummary } from './card';

describe('eventLookupKey', () => {
  it('passes through a bare action word unchanged', () => {
    expect(eventLookupKey('start')).toBe('start');
    expect(eventLookupKey('die')).toBe('die');
    expect(eventLookupKey('restart')).toBe('restart');
  });

  it('normalizes any health_status compound value to the bare "health_status" key', () => {
    // Dockhand's own stored value is a compound string like
    // "health_status: healthy" / "health_status: unhealthy" — this must
    // match both, and any other health_status-prefixed variant, to the
    // one key EVENT_ICON/EVENT_COLOR are actually keyed by.
    expect(eventLookupKey('health_status: healthy')).toBe('health_status');
    expect(eventLookupKey('health_status: unhealthy')).toBe('health_status');
    expect(eventLookupKey('health_status')).toBe('health_status');
  });

  it('does not normalize an action that merely contains, but does not start with, health_status', () => {
    expect(eventLookupKey('container_health_status')).toBe('container_health_status');
  });

  it('passes an unrecognized action through unchanged, deliberately not replicating Dockhand’s own frontend bug of never matching health_status at all', () => {
    // Dockhand's own frontend does a strict-equality match against the
    // compound string, which never hits its own 'health_status' case —
    // this repo's own lookup intentionally diverges from that, since
    // matching a probable oversight has less value than a health event
    // actually standing out. An unrelated unknown action still falls
    // through to the caller's own "unrecognized" handling either way.
    expect(eventLookupKey('some_future_action')).toBe('some_future_action');
  });
});

describe('pendingUpdateSummary', () => {
  it('counts the total, matching the Updates card rows, not just installable updates', () => {
    const r = pendingUpdateSummary({ installable: 1, system: 1, versionTag: 2, total: 4 });
    expect(r.count).toBe(4);
    expect(r.title).toBe('Pending updates — Installable: 1, System: 1, New version tags: 2');
  });

  it('keeps the plain title when only one kind is pending', () => {
    expect(pendingUpdateSummary({ installable: 0, system: 0, versionTag: 3, total: 3 })).toEqual({
      count: 3,
      title: 'Pending updates'
    });
  });

  it('treats missing counts as zero', () => {
    expect(pendingUpdateSummary({})).toEqual({ count: 0, title: 'Pending updates' });
  });
});

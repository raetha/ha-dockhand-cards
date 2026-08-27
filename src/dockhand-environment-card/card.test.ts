import { describe, it, expect } from 'vitest';
import { eventLookupKey } from './card';

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

import { describe, it, expect } from 'vitest';
import { resolveVisibleBadges } from './types';

describe('resolveVisibleBadges', () => {
  it('defaults to next_run only when grouping by environment and no explicit value is set', () => {
    expect(resolveVisibleBadges(undefined, 'environment')).toEqual(['next_run']);
  });

  it('defaults to next_run and environment for every other grouping when no explicit value is set', () => {
    expect(resolveVisibleBadges(undefined, 'none')).toEqual(['next_run', 'environment']);
    expect(resolveVisibleBadges(undefined, 'type')).toEqual(['next_run', 'environment']);
    expect(resolveVisibleBadges(undefined, 'status')).toEqual(['next_run', 'environment']);
    expect(resolveVisibleBadges(undefined, undefined)).toEqual(['next_run', 'environment']);
  });

  it('respects an explicit array regardless of group_by, including an explicitly empty one', () => {
    expect(resolveVisibleBadges(['environment'], 'environment')).toEqual(['environment']);
    expect(resolveVisibleBadges([], 'type')).toEqual([]);
    expect(resolveVisibleBadges(['next_run'], 'none')).toEqual(['next_run']);
  });
});

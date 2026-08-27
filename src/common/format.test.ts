import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatBytes, barColorClass, formatRelativeTime } from './format';

describe('formatBytes', () => {
  it('handles null/undefined/NaN as a dash', () => {
    expect(formatBytes(undefined)).toBe('—');
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(NaN)).toBe('—');
  });

  it('formats zero explicitly', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('picks the right unit and rounds to one decimal above bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
});

describe('barColorClass', () => {
  it('matches Dockhand thresholds: >=90 red, >=70 amber, else green', () => {
    expect(barColorClass(0)).toBe('ok');
    expect(barColorClass(69.9)).toBe('ok');
    expect(barColorClass(70)).toBe('warn');
    expect(barColorClass(89.9)).toBe('warn');
    expect(barColorClass(90)).toBe('error');
    expect(barColorClass(100)).toBe('error');
  });
});

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-01-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for missing/invalid input', () => {
    expect(formatRelativeTime(null)).toBeNull();
    expect(formatRelativeTime(undefined)).toBeNull();
    expect(formatRelativeTime('not-a-date')).toBeNull();
  });

  it('formats future timestamps as "in Nx"', () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 30_000).toISOString())).toBe('just now');
    expect(formatRelativeTime(new Date(NOW.getTime() + 4 * 60_000).toISOString())).toBe('in 4m');
    expect(formatRelativeTime(new Date(NOW.getTime() + 3 * 3_600_000).toISOString())).toBe('in 3h');
    expect(formatRelativeTime(new Date(NOW.getTime() + 2 * 86_400_000).toISOString())).toBe('in 2d');
  });

  it('formats past timestamps as "Nx ago"', () => {
    expect(formatRelativeTime(new Date(NOW.getTime() - 45_000).toISOString())).toBe('just now');
    expect(formatRelativeTime(new Date(NOW.getTime() - 10 * 60_000).toISOString())).toBe('10m ago');
    expect(formatRelativeTime(new Date(NOW.getTime() - 2 * 3_600_000).toISOString())).toBe('2h ago');
    expect(formatRelativeTime(new Date(NOW.getTime() - 5 * 86_400_000).toISOString())).toBe('5d ago');
  });
});

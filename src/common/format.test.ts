import { describe, it, expect } from 'vitest';
import { formatBytes, barColorClass } from './format';

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

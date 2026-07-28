import { describe, it, expect } from 'vitest';
import { getLabelColors } from './label-colors';

describe('getLabelColors', () => {
  it('is deterministic for the same label', () => {
    expect(getLabelColors('backend')).toEqual(getLabelColors('backend'));
  });

  it('matches Dockhand\u2019s own hash for known labels, so colors agree with Dockhand\u2019s UI', () => {
    // Values computed directly from Dockhand's hashString()/LABEL_COLORS
    // (label-colors.ts) rather than asserted against this port's own
    // output -- a hash that's merely internally consistent but disagrees
    // with Dockhand would defeat the point of porting it at all.
    expect(getLabelColors('backend').color).toBe('#06b6d4'); // cyan-500
    expect(getLabelColors('frontend').color).toBe('#8b5cf6'); // violet-500
    expect(getLabelColors('critical').color).toBe('#d946ef'); // fuchsia-500
  });

  it('pairs each color with its matching background at the same palette index', () => {
    expect(getLabelColors('backend')).toEqual({ color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.15)' });
  });

  it('differs across different labels (not a constant fallback)', () => {
    expect(getLabelColors('backend').color).not.toBe(getLabelColors('frontend').color);
  });

  it('handles the empty string without throwing', () => {
    expect(() => getLabelColors('')).not.toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import { computeDonutSegments, boundaryAngles } from './donut-geometry';

const TAU = 2 * Math.PI;

describe('computeDonutSegments', () => {
  it('returns an empty array when there is nothing to show', () => {
    expect(computeDonutSegments([])).toEqual([]);
    expect(computeDonutSegments([{ color: '#000', bytes: 0 }])).toEqual([]);
  });

  it('a single item spans the full circle', () => {
    const segments = computeDonutSegments([{ color: '#0ea5e9', bytes: 100 }]);
    expect(segments).toHaveLength(1);
    expect(segments[0].startAngle).toBeCloseTo(0);
    expect(segments[0].endAngle).toBeCloseTo(TAU);
  });

  it('splits proportionally by byte count, in the order given', () => {
    const segments = computeDonutSegments([
      { color: 'a', bytes: 50 },
      { color: 'b', bytes: 30 },
      { color: 'c', bytes: 20 }
    ]);
    expect(segments[0].startAngle).toBeCloseTo(0);
    expect(segments[0].endAngle).toBeCloseTo(TAU * 0.5);
    expect(segments[1].startAngle).toBeCloseTo(TAU * 0.5);
    expect(segments[1].endAngle).toBeCloseTo(TAU * 0.8);
    expect(segments[2].startAngle).toBeCloseTo(TAU * 0.8);
    expect(segments[2].endAngle).toBeCloseTo(TAU);
  });

  it('handles a genuinely tiny segment (the actual proportions that surfaced real bugs this session) without producing a negative or inverted span', () => {
    // Images 60%, Containers 1.95%, Volumes 32.5%, Build cache 5.55% —
    // the real mock-data proportions that exposed the gap-distribution
    // and corner-radius bugs found and fixed this session.
    const segments = computeDonutSegments([
      { color: 'images', bytes: 12884901888 },
      { color: 'containers', bytes: 419430400 },
      { color: 'volumes', bytes: 6979321856 },
      { color: 'buildCache', bytes: 1191182336 }
    ]);
    expect(segments).toHaveLength(4);
    for (const seg of segments) {
      expect(seg.endAngle).toBeGreaterThan(seg.startAngle);
    }
    // The tiny "containers" segment (~1.95%) should still have a real,
    // positive, proportionally small span — not zero, not negative.
    const containers = segments[1];
    const span = containers.endAngle - containers.startAngle;
    expect(span).toBeGreaterThan(0);
    expect(span).toBeCloseTo(TAU * (419430400 / (12884901888 + 419430400 + 6979321856 + 1191182336)), 5);
  });

  it('segments are contiguous end-to-end with no gap or overlap between them', () => {
    const segments = computeDonutSegments([
      { color: 'a', bytes: 7 },
      { color: 'b', bytes: 3 },
      { color: 'c', bytes: 11 }
    ]);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].startAngle).toBeCloseTo(segments[i - 1].endAngle);
    }
  });

  it('the full set of segments always sums to exactly one full circle', () => {
    const segments = computeDonutSegments([
      { color: 'a', bytes: 123 },
      { color: 'b', bytes: 456 },
      { color: 'c', bytes: 789 },
      { color: 'd', bytes: 1 }
    ]);
    expect(segments[segments.length - 1].endAngle).toBeCloseTo(TAU);
  });

  it('preserves each item own color', () => {
    const segments = computeDonutSegments([
      { color: '#0ea5e9', bytes: 1 },
      { color: '#10b981', bytes: 1 }
    ]);
    expect(segments.map((s) => s.color)).toEqual(['#0ea5e9', '#10b981']);
  });
});

describe('boundaryAngles', () => {
  it('is empty for zero or one segment — nothing to separate from', () => {
    expect(boundaryAngles([])).toEqual([]);
    expect(boundaryAngles(computeDonutSegments([{ color: 'a', bytes: 1 }]))).toEqual([]);
  });

  it('returns one boundary angle per segment, matching each own start (including the wrap-around boundary between the last segment and the first)', () => {
    const segments = computeDonutSegments([
      { color: 'a', bytes: 1 },
      { color: 'b', bytes: 1 },
      { color: 'c', bytes: 1 }
    ]);
    const boundaries = boundaryAngles(segments);
    expect(boundaries).toHaveLength(3);
    expect(boundaries[0]).toBeCloseTo(0);
    expect(boundaries[1]).toBeCloseTo(segments[1].startAngle);
    expect(boundaries[2]).toBeCloseTo(segments[2].startAngle);
  });
});

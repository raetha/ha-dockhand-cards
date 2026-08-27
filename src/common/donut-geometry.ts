/** A single slice's own share of the whole, before any angle math. */
export interface DonutItem {
  color: string;
  bytes: number;
}

/** A slice's own computed angular span, in radians, 0 at 12 o'clock,
 * increasing clockwise — matching every other angular chart in this
 * repo (the CPU/memory history sparklines). */
export interface DonutSegment {
  color: string;
  startAngle: number;
  endAngle: number;
}

/** Converts each item's own byte count into a proportional angular
 * span, laid out end-to-end around the full circle — deliberately no
 * gap between segments here at all. The visible gap between slices is
 * a separate concern (an "eraser" spoke drawn on top at each
 * boundary's own angle, in the card's own background color, at a
 * genuinely constant pixel width — see _renderDiskUsage), not baked
 * into the wedge angles themselves. Keeping this function this simple
 * is deliberate: the wedge shape (including rounded corners) is
 * delegated entirely to d3-shape's own arc generator, which already
 * correctly handles the part this repo's own hand-rolled version got
 * wrong three times in a row — the different curvature of the inner
 * and outer radii needing different treatment for a visually
 * consistent rounded corner, not just the same corner radius applied
 * identically to both.
 *
 * Zero-byte items are expected to already be filtered out by the
 * caller (this repo's own convention, matching Dockhand's own
 * behavior of only ever showing populated categories) — an item with
 * `bytes <= 0` here would produce a zero-length (invisible) segment
 * rather than being skipped, which is intentional: this function
 * doesn't make assumptions about what the caller has or hasn't
 * already decided to show.
 */
export function computeDonutSegments(items: DonutItem[]): DonutSegment[] {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.bytes), 0);
  if (total <= 0) return [];

  let cursor = 0;
  return items.map((item) => {
    const startAngle = cursor;
    const sweep = (Math.max(0, item.bytes) / total) * (2 * Math.PI);
    cursor += sweep;
    return { color: item.color, startAngle, endAngle: cursor };
  });
}

/** The angle of every boundary between adjacent segments, including
 * the wrap-around boundary between the last segment and the first —
 * one angle per segment, since each segment's own startAngle already
 * is the boundary immediately before it (segments are laid out
 * cumulatively with no gap, per computeDonutSegments's own contract).
 * Used to position each "eraser" spoke that visually separates two
 * neighboring slices. */
export function boundaryAngles(segments: DonutSegment[]): number[] {
  if (segments.length <= 1) return [];
  return segments.map((s) => s.startAngle);
}

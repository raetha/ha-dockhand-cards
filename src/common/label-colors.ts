/**
 * Environment label colors — ported from Dockhand's own
 * `src/lib/utils/label-colors.ts` (`hashString` + `LABEL_COLORS`/
 * `LABEL_BG_COLORS`) so a label renders with the same color here as it does
 * in Dockhand's own UI, rather than a plain neutral pill.
 *
 * Dockhand also supports a per-label custom-color override
 * (`customColors: Record<string, string>`), but that mapping isn't exposed
 * by any ha-dockhand entity — only the plain `labels` array attribute is —
 * so this only reproduces the deterministic hash-based default. If a label
 * has a custom color set in Dockhand, this card has no way to know that and
 * will still show the hashed color.
 */

const LABEL_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#14b8a6', // teal-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#6366f1', // indigo-500
  '#d946ef' // fuchsia-500
];

const LABEL_BG_COLORS = [
  'rgba(239, 68, 68, 0.15)', // red
  'rgba(249, 115, 22, 0.15)', // orange
  'rgba(234, 179, 8, 0.15)', // yellow
  'rgba(34, 197, 94, 0.15)', // green
  'rgba(20, 184, 166, 0.15)', // teal
  'rgba(59, 130, 246, 0.15)', // blue
  'rgba(139, 92, 246, 0.15)', // violet
  'rgba(236, 72, 153, 0.15)', // pink
  'rgba(6, 182, 212, 0.15)', // cyan
  'rgba(132, 204, 22, 0.15)', // lime
  'rgba(99, 102, 241, 0.15)', // indigo
  'rgba(217, 70, 239, 0.15)' // fuchsia
];

/** Same hash Dockhand uses (a 32-bit string hash, absolute value) — must
 * match exactly, not just be "a" hash, or colors would disagree with
 * Dockhand's own UI for the same label. */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getLabelColors(label: string): { color: string; bgColor: string } {
  const index = hashString(label) % LABEL_COLORS.length;
  return { color: LABEL_COLORS[index], bgColor: LABEL_BG_COLORS[index] };
}

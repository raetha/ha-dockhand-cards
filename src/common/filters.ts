/**
 * List card filters (`filters:` in a card's config): which rows a list card
 * shows. Each filter names values a row must have (`[a, b]`) or must not
 * have (`{ not: [a, b] }`); values within one filter are alternatives, and
 * every set filter applies. A row with no value for a filter fails "is" and
 * passes "is not"; where having no value is worth picking on purpose, it is
 * an option of its own (`NONE`). See docs/architecture.md §21.
 */
import type { HomeAssistant } from './ha-types';

/** "Has no value": no stack, no tags, no health check, never run. Neither a
 * Compose project name nor a Dockhand tag can contain parentheses. */
export const NONE = '(none)';

export type FilterSpec = string[] | { not: string[] };
export type FiltersConfig = Record<string, FilterSpec>;

export interface FilterRule {
  values: string[];
  exclude: boolean;
}

/** One filter a card offers: the values a row has, read from Home Assistant.
 * An empty list means the row's value isn't known. */
export type FilterExtractor<Row> = (row: Row, hass: HomeAssistant) => string[];

const words = (list: unknown[]): string[] => list.filter((v): v is string => typeof v === 'string' && v !== '');

/** A filter as written in YAML, or null when it doesn't restrict anything. */
export function readFilter(spec: unknown): FilterRule | null {
  if (Array.isArray(spec)) {
    const values = words(spec);
    return values.length ? { values, exclude: false } : null;
  }
  if (spec && typeof spec === 'object' && Array.isArray((spec as { not?: unknown }).not)) {
    const values = words((spec as { not: unknown[] }).not);
    return values.length ? { values, exclude: true } : null;
  }
  return null;
}

/** Whether a row with these values passes a rule. Case doesn't matter: tags
 * match whatever their case, as in Dockhand. */
export function passes(rowValues: string[], rule: FilterRule): boolean {
  const wanted = new Set(rule.values.map((v) => v.toLowerCase()));
  const hit = rowValues.some((v) => wanted.has(v.toLowerCase()));
  return rule.exclude ? !hit : hit;
}

/** The rows that pass every filter the card offers, and how many didn't.
 * Filters the card doesn't offer (a newer release's, a typo) are ignored. */
export function applyFilters<Row>(
  rows: Row[],
  hass: HomeAssistant,
  extractors: Record<string, FilterExtractor<Row>>,
  filters: FiltersConfig | undefined
): { rows: Row[]; hidden: number } {
  const rules = activeRules(extractors, filters);
  if (rules.length === 0) return { rows, hidden: 0 };
  const kept = rows.filter((row) => rules.every(([extract, rule]) => passes(extract(row, hass), rule)));
  return { rows: kept, hidden: rows.length - kept.length };
}

function activeRules<Row>(extractors: Record<string, FilterExtractor<Row>>, filters: FiltersConfig | undefined): [FilterExtractor<Row>, FilterRule][] {
  const rules: [FilterExtractor<Row>, FilterRule][] = [];
  for (const [key, extract] of Object.entries(extractors)) {
    const rule = readFilter(filters?.[key]);
    if (rule) rules.push([extract, rule]);
  }
  return rules;
}

/** How many of these filters restrict anything. */
export function activeFilterCount(keys: string[], filters: FiltersConfig | undefined): number {
  return keys.filter((key) => readFilter(filters?.[key])).length;
}

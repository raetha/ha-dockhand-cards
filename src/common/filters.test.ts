import { describe, it, expect } from 'vitest';
import { NONE, activeFilterCount, applyFilters, passes, readFilter } from './filters';
import { filtersFormData, filtersFromForm, CONTAINERS_FILTER_FIELDS } from './filters-editor';
import type { HomeAssistant } from './ha-types';

describe('readFilter', () => {
  it('reads "is" lists and "is not" objects, ignoring empty or odd ones', () => {
    expect(readFilter(['a', 'b'])).toEqual({ values: ['a', 'b'], exclude: false });
    expect(readFilter({ not: ['a'] })).toEqual({ values: ['a'], exclude: true });
    expect(readFilter([])).toBeNull();
    expect(readFilter({ not: [] })).toBeNull();
    expect(readFilter([1, '', null])).toBeNull();
    expect(readFilter('a')).toBeNull();
    expect(readFilter(undefined)).toBeNull();
  });
});

describe('passes', () => {
  it('matches any value, case-insensitively; "is not" matches none', () => {
    expect(passes(['Media'], { values: ['media', 'infra'], exclude: false })).toBe(true);
    expect(passes(['web'], { values: ['media'], exclude: false })).toBe(false);
    expect(passes(['infra', 'web'], { values: ['infra'], exclude: true })).toBe(false);
    expect(passes(['web'], { values: ['infra'], exclude: true })).toBe(true);
  });

  it('fails "is" and passes "is not" for a row with no known value', () => {
    expect(passes([], { values: ['running'], exclude: false })).toBe(false);
    expect(passes([], { values: ['running'], exclude: true })).toBe(true);
  });
});

describe('applyFilters', () => {
  const hass = {} as HomeAssistant;
  const rows = [
    { name: 'a', state: 'running', tags: ['media'] },
    { name: 'b', state: 'exited', tags: [] },
    { name: 'c', state: 'running', tags: ['infra'] }
  ];
  const extractors = {
    state: (r: (typeof rows)[number]) => [r.state],
    tags: (r: (typeof rows)[number]) => (r.tags.length ? r.tags : [NONE])
  };

  it('shows the rows Always show problems picks out, whatever the filters say', () => {
    const result = applyFilters(rows, hass, extractors, { state: ['running'], tags: { not: ['infra'] } }, (r) => r.state === 'exited');
    expect(result.rows.map((r) => r.name)).toEqual(['a', 'b']);
    expect(result.hidden).toBe(1);
  });

  it('keeps rows passing every filter, counting the rest', () => {
    const result = applyFilters(rows, hass, extractors, { state: ['running'], tags: { not: ['infra'] } });
    expect(result.rows.map((r) => r.name)).toEqual(['a']);
    expect(result.hidden).toBe(2);
  });

  it('lets "no value" be chosen on purpose', () => {
    expect(applyFilters(rows, hass, extractors, { tags: [NONE] }).rows.map((r) => r.name)).toEqual(['b']);
  });

  it('ignores filters the card does not offer, and no filters at all', () => {
    expect(applyFilters(rows, hass, extractors, { owner: ['me'] }).hidden).toBe(0);
    expect(applyFilters(rows, hass, extractors, undefined).rows).toBe(rows);
  });

  it('counts only the filters that restrict something', () => {
    expect(activeFilterCount(['state', 'tags'], { state: ['running'], tags: [], other: ['x'] })).toBe(1);
  });
});

describe('the editor form and filters:', () => {
  it('round-trips "is" and "is not", keeping filters this editor does not show', () => {
    const filters = { state: ['dead'], tags: { not: ['infra'] }, future: ['x'] };
    const data = filtersFormData(CONTAINERS_FILTER_FIELDS, filters);
    expect(data).toMatchObject({ filter_state: ['dead'], filter_state_match: 'is', filter_tags: ['infra'], filter_tags_match: 'is_not', filter_health: undefined });
    expect(filtersFromForm(CONTAINERS_FILTER_FIELDS, data, filters)).toEqual(filters);
  });

  it('drops a cleared filter, and the key once nothing is filtered', () => {
    const data = { ...filtersFormData(CONTAINERS_FILTER_FIELDS, { state: ['dead'] }), filter_state: [] };
    expect(filtersFromForm(CONTAINERS_FILTER_FIELDS, data, { state: ['dead'] })).toBeUndefined();
  });

  it('switches a filter to "is not"', () => {
    const data = { ...filtersFormData(CONTAINERS_FILTER_FIELDS, { state: ['dead'] }), filter_state_match: 'is_not' };
    expect(filtersFromForm(CONTAINERS_FILTER_FIELDS, data, { state: ['dead'] })).toEqual({ state: { not: ['dead'] } });
  });
});

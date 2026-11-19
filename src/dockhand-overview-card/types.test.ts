import { describe, it, expect } from 'vitest';
import { DEFAULT_SECTION_ORDER, enabledSections, type DockhandOverviewCardConfig } from './types';

const base: DockhandOverviewCardConfig = { type: 'custom:dockhand-overview-card' };

describe('enabledSections', () => {
  it('keeps only sections the config turns on, in the given order', () => {
    expect(enabledSections(DEFAULT_SECTION_ORDER, { ...base, show_environments: true, show_stacks: true, show_containers: true })).toEqual([
      'environments',
      'stacks',
      'containers'
    ]);
  });

  it('follows a custom order', () => {
    expect(enabledSections(['containers', 'environments', 'updates'], { ...base, show_environments: true, show_containers: true, show_updates: true })).toEqual([
      'containers',
      'environments',
      'updates'
    ]);
  });

  it('returns nothing when every section is off', () => {
    expect(enabledSections(DEFAULT_SECTION_ORDER, base)).toEqual([]);
  });
});

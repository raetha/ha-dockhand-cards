// @vitest-environment jsdom
/**
 * Every card and editor rendered against the screenshot harness's mock
 * Home Assistant (four environments with stacks, containers, schedules,
 * updates and vulnerabilities), in each display mode the README shows, plus
 * the states a user can hit: an offline environment, a missing device, an
 * empty config, another language. Catches render code that throws or draws
 * nothing, which the screenshots only show when someone looks.
 */
import { describe, it, expect } from 'vitest';
import { CARDS, EDITORS, type Card } from './render.dom.test-elements';
import type { HomeAssistant } from './common/ha-types';
import { harnessHass, mount } from './common/mount.test-helpers';

type Element_ = HTMLElement & {
  hass: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
  getCardSize?: () => number | Promise<number>;
  getGridOptions?: () => unknown;
};

const CASES: [Card, Record<string, unknown>][] = [
  ['environment', { device_id: 'env_2', mode: 'compact' }],
  ['environment', { device_id: 'env_2', mode: 'standard' }],
  ['environment', { device_id: 'env_1', mode: 'detailed' }],
  ['environment', { device_id: 'env_4', mode: 'full' }],
  ['environment', { device_id: 'env_3', mode: 'standard' }],
  ['environment', { device_id: 'env_1', mode: 'custom', custom_sections: ['metrics', 'containers', 'disk', 'updates'] }],
  ['vulnerability', { device_id: 'env_1' }],
  ['vulnerability', { device_id: 'env_3' }],
  ['stack', { device_id: 'stack_1_core' }],
  ['stack', { device_id: 'stack_1_monitoring' }],
  ['container', { device_id: 'container_1_web' }],
  ['container', { device_id: 'container_1_backup' }],
  ['stacks', { device_id: 'env_1' }],
  ['stacks', { group_by: 'status', sort_by: 'status', visible_badges: ['container_count', 'updates', 'type', 'environment', 'tags'] }],
  ['stacks', { group_by: 'type', visible_badges: ['container_count', 'updates', 'type', 'tags', 'controls'] }],
  ['containers', { device_id: 'env_1' }],
  ['containers', { group_by: 'environment', sort_by: 'status', visible_badges: ['health', 'updates', 'cpu', 'memory', 'tags', 'controls'] }],
  ['updates', { scope: 'all' }],
  ['updates', { group_by: 'environment' }],
  ['schedules', { group_by: 'environment' }],
  ['schedules', { group_by: 'status', show_stats: true, visible_badges: ['environment', 'next_run', 'controls'] }],
  ['schedules', { group_by: 'type', sort_by: 'next_run' }],
  ['overview', { show_environments: true, environment_mode: 'compact', show_stacks: true, show_containers: true }],
  [
    'overview',
    {
      show_environments: true,
      show_vulnerabilities: true,
      show_stacks: true,
      show_containers: true,
      show_updates: true,
      show_schedules: true,
      align_columns: false,
      environments_order: ['env_2', 'env_1'],
      environments_overrides: { env_1: { environment: { mode: 'detailed' } } }
    }
  ]
];

describe('every card renders', () => {
  it.each(CASES)('%s %j', async (card, config) => {
    const el = await mount<Element_>(`dockhand-${card}-card`, config, harnessHass({ darkMode: true }));
    const root = el.shadowRoot!;
    expect(root.innerHTML.length).toBeGreaterThan(0);
    expect(root.querySelector('.card-message.error')).toBeNull();
    if (el.getCardSize) expect(await el.getCardSize()).toBeGreaterThan(0);
    if (el.getGridOptions) expect(el.getGridOptions()).toBeTruthy();
  });

  it.each(Object.keys(CARDS) as Card[])('%s in another language', async (card) => {
    const config = CASES.find(([c]) => c === card)![1];
    const el = await mount(`dockhand-${card}-card`, config, harnessHass({ darkMode: true, language: 'de' }));
    expect(el.shadowRoot!.innerHTML.length).toBeGreaterThan(0);
  });

  it.each(['environment', 'vulnerability', 'stack', 'container'] as Card[])('%s for a device that is gone', async (card) => {
    const el = await mount(`dockhand-${card}-card`, { device_id: 'no-such-device' }, harnessHass({ darkMode: true }));
    expect(el.shadowRoot!.textContent).not.toBe('');
  });
});

describe('every editor renders', () => {
  it.each(CASES.filter(([card], i) => CASES.findIndex(([c]) => c === card) === i))('%s', async (card, config) => {
    const el = await mount(`dockhand-${card}-card-editor`, config, harnessHass({ darkMode: true }));
    expect(el.shadowRoot!.innerHTML.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(EDITORS) as Card[])('%s with an empty config', async (card) => {
    const el = await mount(`dockhand-${card}-card-editor`, {}, harnessHass({ darkMode: true, language: 'fr' }));
    expect(el.shadowRoot!.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('Stacks card resource use', () => {
  it('shows neither CPU nor memory by default, and memory in use in whole units when chosen', async () => {
    const hass = harnessHass();
    const add = (key: string, state: string, unit: string) => {
      const entityId = `sensor.core_${key}`;
      hass.entities[entityId] = { entity_id: entityId, device_id: 'stack_1_core', platform: 'dockhand', translation_key: key } as never;
      hass.states[entityId] = { entity_id: entityId, state, attributes: { unit_of_measurement: unit }, last_changed: '', last_updated: '', context: { id: '' } } as never;
    };
    add('stack_cpu_percent', '12.6', '%');
    add('stack_memory_usage', '512', 'MiB');
    hass.entities = { ...hass.entities };
    const byDefault = (await mount('dockhand-stacks-card', {}, hass)).shadowRoot!.textContent!.replace(/\s+/g, ' ');
    expect(byDefault).not.toContain('13%');
    expect(byDefault).not.toContain('MB');
    hass.states['sensor.core_stack_memory_usage'] = { ...hass.states['sensor.core_stack_memory_usage'], state: '512.6' } as never;
    const chosen = (await mount('dockhand-stacks-card', { visible_badges: ['cpu', 'memory'] }, hass)).shadowRoot!.textContent!.replace(/\s+/g, ' ');
    expect(chosen).toContain('13%');
    expect(chosen).toContain('513 MB');
  });
});

describe('Stacks card update count', () => {
  it('comes from the stack’s Pending updates sensor', async () => {
    const hass = harnessHass();
    const core = Object.values(hass.entities).find((e) => e.device_id === 'stack_1_core' && e.translation_key === 'stack_pending_updates')!;
    hass.states[core.entity_id] = { ...hass.states[core.entity_id], state: '7' };
    const el = await mount('dockhand-stacks-card', { visible_badges: ['updates'] }, hass);
    const badges = [...el.shadowRoot!.querySelectorAll('[title]')].map((n) => n.textContent!.trim()).filter((t) => /^\d+$/.test(t));
    expect(badges).toContain('7');
  });
});

describe('Aligned list columns', () => {
  const list = async (card: string, config: Record<string, unknown>) => (await mount(`dockhand-${card}-card`, config, harnessHass())).shadowRoot!.querySelector<HTMLElement>('.list.aligned')!;
  const columns = (el: HTMLElement) => el.style.gridTemplateColumns.split(' ').filter((c) => c === 'auto').length;

  it('gives every Stacks row a cell per column, one list across the groups', async () => {
    const el = await list('stacks', { visible_badges: ['updates', 'container_count', 'controls'] });
    const rows = [...el.querySelectorAll<HTMLElement>(':scope > .row')];
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) expect(row.children.length).toBe(1 + columns(el));
    expect(el.querySelector(':scope > .group-header')).not.toBeNull();
    // The name side keeps type, environment and tags; the columns hold none.
    expect(el.querySelector('.cell .label-pill, .cell .tag-pills')).toBeNull();
  });

  it('gives Schedules rows a next-run column and a controls column', async () => {
    const el = await list('schedules', { visible_badges: ['next_run', 'controls'] });
    expect(columns(el)).toBe(2);
    expect(el.querySelector(':scope > .row > .cell')!.textContent!.trim()).not.toBe('');
    expect(columns(await list('schedules', { visible_badges: [] }))).toBe(0);
  });

  it('lines up the Environment card’s top containers by CPU and memory', async () => {
    const el = await list('environment', { device_id: 'env_1', mode: 'full' });
    expect(columns(el)).toBe(2);
    expect(el.querySelector(':scope > .row > .row-left .item-name')).not.toBeNull();
  });
});

describe('List card editors', () => {
  it.each([
    ['containers', ['environment', 'tags', 'updates', 'health', 'vulnerabilities', 'cpu', 'memory', 'controls']],
    ['stacks', ['type', 'environment', 'tags', 'updates', 'container_count', 'cpu', 'memory', 'controls']],
    ['schedules', ['environment', 'next_run', 'controls']]
  ])('list the %s card’s row details in their order on a row', async (card, order) => {
    const el = await mount(`dockhand-${card}-card-editor`, {}, harnessHass());
    const forms = [...el.shadowRoot!.querySelectorAll<HTMLElement & { schema: unknown }>('ha-form')];
    const find = (schema: unknown): Record<string, string> | undefined => {
      for (const field of schema as { name?: string; options?: Record<string, string>; schema?: unknown }[]) {
        if (field.name === 'visible_badges') return field.options;
        const nested = field.schema ? find(field.schema) : undefined;
        if (nested) return nested;
      }
      return undefined;
    };
    const options = forms.map((form) => find(form.schema)).find(Boolean);
    expect(Object.keys(options!)).toEqual(order);
  });
});

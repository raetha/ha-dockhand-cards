// @vitest-environment jsdom
/**
 * Every list card's filters against the screenshot harness's mock data:
 * which rows each filter keeps, the "hidden by filters" line, the
 * nothing-matches message, and the editors' Filters section.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMockHass } from '../scripts/screenshot-harness/mock-data.mjs';
import './render.dom.test-elements';
import type { HomeAssistant } from './common/ha-types';
import { migrateIncludeGlobal } from './dockhand-schedules-card/editor';

type Lit = HTMLElement & {
  hass: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
};

function mockHass(): HomeAssistant {
  const { devices, entities, states } = buildMockHass();
  return {
    devices,
    entities,
    states,
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: 'language' },
    themes: { darkMode: false },
    callApi: vi.fn().mockResolvedValue([]),
    callService: vi.fn().mockResolvedValue(undefined),
    callWS: vi.fn().mockResolvedValue({})
  } as unknown as HomeAssistant;
}

const mounted: HTMLElement[] = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
});

async function mount(card: string, config: Record<string, unknown>, editor = false): Promise<Lit> {
  const el = document.createElement(`dockhand-${card}-card${editor ? '-editor' : ''}`) as Lit;
  el.setConfig({ type: `custom:dockhand-${card}-card`, ...config });
  el.hass = mockHass();
  document.body.appendChild(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
}

const names = (el: Lit): string[] => [...el.shadowRoot!.querySelectorAll('.item-name')].map((n) => n.textContent!.trim());
const note = (el: Lit): string | undefined => el.shadowRoot!.querySelector('.filtered-note')?.textContent?.trim();
const message = (el: Lit): string | undefined => el.shadowRoot!.querySelector('.card-message')?.textContent?.trim();

describe('Containers card filters', () => {
  const nebula = { exclude_device_ids: ['env_2', 'env_3', 'env_4'] };

  it('shows containers outside any stack (issue #4)', async () => {
    const el = await mount('containers', { ...nebula, filters: { stack: ['(none)'] } });
    expect(names(el)).toEqual(['backup']);
    expect(note(el)).toBe('Hidden by filters: 5');
  });

  it('splits Exited by exit code, and chains with other filters', async () => {
    expect(names(await mount('containers', { ...nebula, filters: { state: ['exited_error'] } }))).toEqual(['backup']);
    expect(names(await mount('containers', { ...nebula, filters: { state: ['exited_ok'] } }))).toEqual([]);
    const el = await mount('containers', { ...nebula, filters: { stack: ['monitoring'], health: ['healthy'], update: ['held'] } });
    expect(names(el)).toEqual(['redis']);
  });

  it('excludes with "is not", and picks "no health check" and "no tags" on purpose', async () => {
    expect(names(await mount('containers', { ...nebula, filters: { tags: { not: ['critical', 'edge'] } } }))).toEqual(['backup', 'redis', 'web', 'worker']);
    expect(names(await mount('containers', { ...nebula, filters: { health: ['(none)'] } }))).toEqual(['backup', 'traefik']);
    expect(names(await mount('containers', { ...nebula, filters: { update: ['up_to_date', 'pinned'] } }))).toEqual(['backup', 'worker']);
  });

  it('says when nothing matches, and can leave out the count', async () => {
    const el = await mount('containers', { ...nebula, filters: { state: ['dead'] }, show_filtered_count: false });
    expect(message(el)).toBe('Nothing matches this card’s filters.');
    expect(note(el)).toBeUndefined();
  });
});

describe('Stacks card filters', () => {
  it('filters by type, status, updates, git sync and tags', async () => {
    const one = { exclude_device_ids: ['env_2', 'env_3', 'env_4'] };
    expect(names(await mount('stacks', { ...one, filters: { type: ['git'] } }))).toEqual(['core']);
    expect(names(await mount('stacks', { ...one, filters: { status: ['partial'] } }))).toEqual(['monitoring']);
    expect(names(await mount('stacks', { ...one, filters: { git_sync: ['pending'], tags: ['critical'] } }))).toEqual(['core']);
    expect(names(await mount('stacks', { ...one, filters: { updates: ['none'] } }))).toEqual([]);
  });
});

describe('Updates card filters', () => {
  it('lists only matching updates, counts them in the header, and limits Update all to them', async () => {
    const el = await mount('updates', { exclude_device_ids: ['env_2', 'env_3', 'env_4'], filters: { update: ['tag'] } });
    expect([...el.shadowRoot!.querySelectorAll('.update-row .item-name')].map((n) => n.textContent)).toEqual(['postgres']);
    expect(el.shadowRoot!.querySelector('.card-header .truncate')!.textContent).toContain('(1)');
    // A newer tag can't be installed from here, so Update listed stays, disabled, saying why.
    const updateListed = el.shadowRoot!.querySelector('.header-icon.filled')!;
    expect(updateListed.textContent).toContain('Update listed');
    expect(updateListed.getAttribute('title')).toMatch(/^Nothing listed can be installed/);
    expect(note(el)).toMatch(/^Hidden by filters: \d+$/);
  });

  it('says no updates match rather than everything is up to date', async () => {
    const el = await mount('updates', { filters: { stack: ['no-such-stack'] } });
    expect(message(el)).toBe('No updates match this card’s filters.');
  });
});

describe('Schedules card filters', () => {
  it('filters by where, type, last result, enabled and origin', async () => {
    expect(names(await mount('schedules', { filters: { scope: ['global'] } }))).toEqual(['Container event cleanup']);
    const failed = await mount('schedules', { filters: { last_result: ['failed', 'warning'], scope: { not: ['global'] } } });
    expect(names(failed)).toHaveLength(2);
    expect(names(await mount('schedules', { filters: { origin: ['system'] } }))).toEqual(['Container event cleanup']);
    expect(names(await mount('schedules', { filters: { enabled: ['disabled'] } }))).toEqual(['Update environment: Vega']);
    expect(names(await mount('schedules', { filters: { type: ['image_prune'] } }))).toHaveLength(1);
  });

  it('still honours include_global: false', async () => {
    expect(names(await mount('schedules', { include_global: false, filters: { scope: ['global'] } }))).toEqual([]);
  });
});

describe('Schedules editor: include_global becomes the Where filter', () => {
  it('turns include_global: false into "not global", once', () => {
    expect(migrateIncludeGlobal({ type: 'custom:dockhand-schedules-card', include_global: false }, false)).toEqual({
      type: 'custom:dockhand-schedules-card',
      filters: { scope: { not: ['global'] } }
    });
    const kept = { type: 'custom:dockhand-schedules-card' as const, include_global: false, filters: { scope: ['global'] } };
    expect(migrateIncludeGlobal(kept, false)).toEqual({ type: 'custom:dockhand-schedules-card', filters: { scope: ['global'] } });
  });

  it('leaves it alone when embedded in the Overview, or when it was on', () => {
    const config = { type: 'custom:dockhand-schedules-card' as const, include_global: false };
    expect(migrateIncludeGlobal(config, true)).toBe(config);
    const on = { type: 'custom:dockhand-schedules-card' as const };
    expect(migrateIncludeGlobal(on, false)).toBe(on);
  });
});

describe('Filters section in the editors', () => {
  type Form = HTMLElement & { schema: { name: string; title?: string; schema?: { schema?: { name: string; visible?: unknown }[] }[] }[]; data: Record<string, unknown> };
  const filterForm = (el: Lit): Form => [...el.shadowRoot!.querySelectorAll<Form>('ha-form')].find((f) => f.schema[0]?.name === 'filters')!;

  it.each([
    ['containers', 'tags', 'critical'],
    ['stacks', 'tags', 'critical'],
    ['updates', 'tags', 'critical'],
    ['schedules', 'type', 'backup']
  ])('%s: counts active filters and writes changes back', async (card, key, value) => {
    const el = await mount(card, { filters: { [key]: [value] } }, true);
    const form = filterForm(el);
    expect(form.schema[0].title).toBe('Filters · 1 active');
    const seen: Record<string, unknown>[] = [];
    el.addEventListener('config-changed', (ev) => seen.push((ev as CustomEvent).detail.config));
    form.dispatchEvent(
      new CustomEvent('value-changed', { detail: { value: { ...form.data, [`filter_${key}`]: [value], [`filter_${key}_match`]: 'is_not', show_filtered_count: false } } })
    );
    expect(seen[0]).toMatchObject({ filters: { [key]: { not: [value] } }, show_filtered_count: false });
    // "is / is not" shows once values are picked, through ha-form's condition.
    const [values, match] = form.schema[0].schema![0].schema!;
    expect(match.visible).toEqual({ field: values.name, operator: 'exists' });
  });

  it('offers Dockhand’s tags, not image tags', async () => {
    const el = document.createElement('dockhand-stacks-card-editor') as Lit;
    el.setConfig({ type: 'custom:dockhand-stacks-card' });
    const hass = mockHass();
    // An image sensor's `tags` are its image tags, which no stack has.
    hass.entities['sensor.nginx_image'] = { entity_id: 'sensor.nginx_image', platform: 'dockhand', translation_key: 'image', device_id: 'env_1' } as (typeof hass.entities)[string];
    hass.states['sensor.nginx_image'] = { entity_id: 'sensor.nginx_image', state: 'latest', attributes: { tags: ['nginx:latest'] } } as unknown as (typeof hass.states)[string];
    el.hass = hass;
    document.body.appendChild(el);
    mounted.push(el);
    await el.updateComplete;
    const schema = JSON.stringify(filterForm(el).schema);
    expect(schema).toContain('"critical"');
    expect(schema).not.toContain('nginx:latest');
  });

  it('offers no Where filter in the Overview', async () => {
    const el = document.createElement('dockhand-schedules-card-editor') as Lit & { cardIsEmbedded: boolean };
    el.cardIsEmbedded = true;
    el.setConfig({ type: 'custom:dockhand-schedules-card' });
    el.hass = mockHass();
    document.body.appendChild(el);
    mounted.push(el);
    await el.updateComplete;
    expect(JSON.stringify(filterForm(el).schema)).not.toContain('filter_scope');
  });
});

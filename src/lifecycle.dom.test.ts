// @vitest-environment jsdom
/**
 * What Home Assistant calls on a card outside rendering: its stub config,
 * editor, size and grid options, the legacy `title` key, a card with no
 * device chosen, the card picker's entity suggestions (index.ts), and the
 * Environment card's history sparklines.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMockHass } from '../scripts/screenshot-harness/mock-data.mjs';
import type { HomeAssistant } from './common/ha-types';

vi.mock('./common/editor-loader', () => ({ loadEditor: vi.fn().mockResolvedValue(undefined), editorUrl: (u: string) => u }));

const { CARDS } = await import('./render.dom.test-elements');

type CardClass = {
  getStubConfig?: (hass: HomeAssistant) => Record<string, unknown>;
  getConfigElement?: () => Promise<HTMLElement>;
};
type Lit = HTMLElement & {
  hass: HomeAssistant | undefined;
  config: Record<string, unknown>;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
  getCardSize?: () => number | Promise<number>;
  getGridOptions?: () => Record<string, unknown>;
};

function mockHass(history: unknown[] = []): HomeAssistant {
  const { devices, entities, states } = buildMockHass();
  return {
    devices,
    entities,
    states,
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: 'language' },
    themes: { darkMode: true },
    callApi: vi.fn().mockResolvedValue(history),
    callService: vi.fn().mockResolvedValue(undefined),
    callWS: vi.fn().mockResolvedValue({}),
    formatEntityName: vi.fn().mockReturnValue('Composed name')
  } as unknown as HomeAssistant;
}

const mounted: HTMLElement[] = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
  vi.useRealTimers();
});

async function mount(card: string, config: Record<string, unknown>, hass = mockHass()): Promise<Lit> {
  const el = document.createElement(`dockhand-${card}-card`) as Lit;
  el.config = { type: `custom:dockhand-${card}-card`, ...config };
  el.hass = hass;
  document.body.appendChild(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
}

describe.each(Object.keys(CARDS))('%s card', (card) => {
  const cls = CARDS[card as keyof typeof CARDS] as unknown as CardClass;

  it('offers a stub config and its editor', async () => {
    const hass = mockHass();
    const stub = cls.getStubConfig?.(hass);
    expect(stub?.type).toBe(`custom:dockhand-${card}-card`);
    expect((await cls.getConfigElement!()).localName).toBe(`dockhand-${card}-card-editor`);
    // The stub renders as is.
    const el = await mount(card, stub ?? {}, hass);
    expect(el.shadowRoot!.innerHTML).not.toBe('');
  });

  it('reports its size and keeps the hass it was given', async () => {
    const hass = mockHass();
    const el = await mount(card, { title: 'Old title' }, hass);
    expect(el.hass).toBe(hass);
    if (el.getCardSize) expect(await el.getCardSize()).toBeGreaterThan(0);
    if (el.getGridOptions) expect(el.getGridOptions()).toHaveProperty('columns');
  });

  it('draws nothing before it has hass', async () => {
    const el = document.createElement(`dockhand-${card}-card`) as Lit;
    el.setConfig({ type: `custom:dockhand-${card}-card` });
    document.body.appendChild(el);
    mounted.push(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('ha-card .row')).toBeNull();
  });

  it('copes with no environments at all', async () => {
    const hass = { ...mockHass(), devices: {}, entities: {}, states: {} } as HomeAssistant;
    expect(cls.getStubConfig?.(hass)).toBeTruthy();
    const el = await mount(card, {}, hass);
    expect(el.shadowRoot).not.toBeNull();
  });
});

describe('Environment card history', () => {
  const now = Date.now();
  const series = (base: number) =>
    Array.from({ length: 6 }, (_, i) => ({ state: String(base + i), last_changed: new Date(now - (6 - i) * 60_000).toISOString() })).concat([{ state: 'unavailable', last_changed: new Date(now).toISOString() }]);

  it('draws CPU and memory sparklines with a hover readout, and refreshes them', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hass = mockHass([series(3), series(40)]);
    const el = await mount('environment', { device_id: 'env_4', mode: 'full' }, hass);
    await vi.waitFor(() => expect(el.shadowRoot!.querySelectorAll('svg.sparkline').length).toBe(2));
    const svg = el.shadowRoot!.querySelector('svg.sparkline')!;
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 5 }));
    await el.updateComplete;
    svg.dispatchEvent(new MouseEvent('mouseleave'));
    await el.updateComplete;
    const calls = vi.mocked(hass.callApi).mock.calls.length;
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(vi.mocked(hass.callApi).mock.calls.length).toBeGreaterThan(calls);
    el.remove();
  });

  it('leaves the charts out when history is unavailable', async () => {
    const hass = mockHass();
    vi.mocked(hass.callApi).mockRejectedValue(new Error('no recorder'));
    const el = await mount('environment', { device_id: 'env_4', mode: 'full' }, hass);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('svg.sparkline')).toBeNull();
  });
});

describe('Environment card with sensors missing', () => {
  const ALL = ['container_counts', 'metrics', 'resources', 'events_summary', 'recent_events', 'top_containers', 'history_chart', 'disk_usage'];
  const MODES: Record<string, unknown>[] = [
    { mode: 'compact' },
    { mode: 'standard' },
    { mode: 'detailed' },
    { mode: 'full' },
    { mode: 'custom', custom_sections: ALL },
    { mode: 'custom', custom_sections: [] }
  ];

  /** The environment's sensors with only `keep` left in the state machine,
   * every attribute removed when `bare`. */
  function sparse(keep: (entityId: string) => boolean, bare = false): HomeAssistant {
    const hass = mockHass();
    const states = Object.fromEntries(
      Object.entries(hass.states)
        .filter(([id]) => keep(id))
        .map(([id, s]) => [id, bare ? { ...s, attributes: {} } : s])
    );
    return { ...hass, states } as HomeAssistant;
  }

  it.each(MODES)('renders %j with no sensors, bare sensors, or only CPU', async (config) => {
    const envEntities = new Set(
      Object.values(mockHass().entities)
        .filter((e) => e.device_id === 'env_4')
        .map((e) => e.entity_id)
    );
    const status = [...envEntities].find((id) => id.includes('status'));
    for (const hass of [
      sparse((id) => id === status),
      sparse(() => true, true),
      sparse((id) => !envEntities.has(id) || !id.includes('memory'))
    ]) {
      const el = await mount('environment', { device_id: 'env_4', ...config }, hass);
      expect(el.shadowRoot!.querySelector('ha-card')).not.toBeNull();
      el.remove();
    }
  });
});

describe('editors with stale or partial setups', () => {
  type Form = HTMLElement & { schema: { name?: string; schema?: unknown[] }[]; computeHelper?: (s: unknown) => unknown; computeLabel?: (s: unknown) => unknown };
  const flat = (schema: Form['schema']): Form['schema'] => schema.flatMap((s) => [s, ...flat((s.schema ?? []) as Form['schema'])]);

  function variants(): HomeAssistant[] {
    const hass = mockHass();
    const disabled = Object.fromEntries(Object.entries(hass.entities).map(([id, e]) => [id, { ...e, disabled_by: 'user' }]));
    return [hass, { ...hass, states: {} } as HomeAssistant, { ...hass, entities: disabled, states: {} } as HomeAssistant, { ...hass, entities: {}, states: {} } as HomeAssistant];
  }

  const CONFIGS: [string, Record<string, unknown>][] = [
    ['environment', { device_id: 'env_1', mode: 'full' }],
    ['environment', { device_id: 'gone' }],
    ['vulnerability', { device_id: 'env_1' }],
    ['stack', { device_id: 'stack_1_core' }],
    ['stack', { device_id: 'gone', environment_device_id: 'gone' }],
    ['stack', { device_id: 'env_1' }],
    ['container', { device_id: 'container_1_web' }],
    ['container', { device_id: 'gone', environment_device_id: 'gone' }],
    ['container', { device_id: 'env_1' }],
    ['stacks', { device_id: 'env_1' }],
    ['containers', { device_id: 'env_1' }],
    ['updates', { device_id: 'env_1', scope: 'selected' }],
    ['schedules', { device_id: 'env_1', group_by: 'environment' }]
  ];

  it.each(CONFIGS)('%s editor %j', async (card, config) => {
    for (const hass of variants()) {
      const el = document.createElement(`dockhand-${card}-card-editor`) as Lit;
      el.setConfig({ type: `custom:dockhand-${card}-card`, ...config });
      el.hass = hass;
      document.body.appendChild(el);
      mounted.push(el);
      await el.updateComplete;
      for (const form of el.shadowRoot!.querySelectorAll<Form>('ha-form')) {
        for (const field of flat(form.schema ?? [])) {
          form.computeHelper?.(field);
          form.computeLabel?.(field);
        }
      }
      expect(el.shadowRoot).not.toBeNull();
    }
  });
});

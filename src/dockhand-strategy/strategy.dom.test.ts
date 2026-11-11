// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMockHass } from '../../scripts/screenshot-harness/mock-data.mjs';
import '../render.dom.test-elements';
import { DockhandDashboardStrategy, DockhandEnvironmentViewStrategy, type DockhandEnvironmentViewConfig } from './strategy';
import './editor';
import type { HomeAssistant } from '../common/ha-types';

vi.mock('../common/editor-loader', () => ({ loadEditor: vi.fn().mockResolvedValue(undefined), editorUrl: (u: string) => u }));

type Card = Record<string, unknown> & { cards?: Card[] };
type Section = Card & { cards: Card[] };
type View = { title: string; path: string; subview?: boolean; max_columns?: number; strategy?: DockhandEnvironmentViewConfig; sections?: Section[] };

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

const dashboard = async (config: Record<string, unknown> = {}, hass = mockHass()) =>
  ((await DockhandDashboardStrategy.generate({ type: 'custom:dockhand', ...config }, hass)) as { views: View[] }).views;

const environmentView = async (view: View, hass = mockHass()) =>
  ((await DockhandEnvironmentViewStrategy.generate(view.strategy!, hass)) as { sections: Section[] }).sections;

const types = (cards: Card[]): string[] => cards.map((c) => (c.type as string).replace(/^custom:dockhand-|-card$/g, ''));

describe('Dockhand dashboard strategy', () => {
  it('builds an overview and a subview per environment, with unique paths', async () => {
    const views = await dashboard();
    expect(views[0].title).toBe('Overview');
    const environments = views.slice(1);
    expect(environments.map((v) => v.title)).toEqual(['Aurora', 'Nebula', 'Orion', 'Vega']);
    expect(environments.every((v) => v.subview && v.strategy?.type === 'custom:dockhand-environment')).toBe(true);
    expect(new Set(views.map((v) => v.path)).size).toBe(views.length);
  });

  it('lays the overview out as environments across two columns, then updates and vulnerabilities, then schedules', async () => {
    const [overview, ...environments] = await dashboard();
    const [envSection, updates, schedules] = overview.sections!;
    expect(overview.max_columns).toBe(4);
    expect(envSection.column_span).toBe(2);
    expect(envSection.cards.every((c) => (c.grid_options as { columns: number }).columns === 12)).toBe(true);
    const headings = envSection.cards.map((stack) => stack.cards![0]);
    expect(headings.map((h) => (h.tap_action as { navigation_path: string }).navigation_path)).toEqual(environments.map((v) => v.path));
    expect(envSection.cards.map((stack) => stack.cards![1].mode)).toEqual(['standard', 'standard', 'standard', 'standard']);
    expect(types(updates.cards)).toEqual(['updates', 'vulnerability']);
    expect(updates.cards[1]).not.toHaveProperty('device_id');
    expect(types(schedules.cards)).toEqual(['schedules']);
  });

  it('makes a single environment’s own view the dashboard, with the global schedules', async () => {
    const hass = mockHass();
    const views = await dashboard({ exclude_device_ids: ['env_2', 'env_3', 'env_4'] }, hass);
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ title: 'Nebula', strategy: { device_id: 'env_1', alone: true } });
    expect(views[0].subview).toBeUndefined();
    const sections = await environmentView(views[0], hass);
    expect(sections[1].cards[2]).not.toHaveProperty('include_global');
  });

  it('follows its settings: order, exclusions, layout and section defaults', async () => {
    const views = await dashboard({
      environments_order: ['env_4'],
      exclude_device_ids: ['env_2'],
      overview_layout: [['updates', 'environments', 'bogus', 'updates'], [], ['schedules']],
      updates_show_controls: true,
      environment_show_settings_link: false
    });
    expect(views.slice(1).map((v) => v.title)).toEqual(['Vega', 'Nebula', 'Orion']);
    const [first, schedules, ...rest] = views[0].sections!;
    // Three environments: their column takes two, and the updates card its
    // whole width. The empty column is skipped.
    expect(first.column_span).toBe(2);
    expect(types(first.cards)).toEqual(['updates', 'vertical-stack', 'vertical-stack', 'vertical-stack']);
    expect(first.cards[0]).toMatchObject({ show_controls: true, exclude_device_ids: ['env_2'], environments_order: ['env_4'], grid_options: { columns: 'full' } });
    expect(first.cards[1].cards![1]).toMatchObject({ mode: 'standard', show_settings_link: false });
    expect(types(schedules.cards)).toEqual(['schedules']);
    expect(rest).toEqual([]);
    expect(views[0]).toMatchObject({ max_columns: 3 });
  });

  it('keeps two environments to one column', async () => {
    const [overview] = await dashboard({ exclude_device_ids: ['env_3', 'env_4'] });
    const [envSection] = overview.sections!;
    expect(envSection.column_span).toBeUndefined();
    expect(envSection.cards.map((c) => c.grid_options)).toEqual([{ columns: 'full' }, { columns: 'full' }]);
    expect(overview).toMatchObject({ max_columns: 3 });
  });

  it('can be limited to one Dockhand instance', async () => {
    const hass = mockHass();
    hass.devices.env_3 = { ...hass.devices.env_3, config_entry_id: 'other' };
    const views = await dashboard({ config_entry_id: hass.devices.env_1.config_entry_id }, hass);
    expect(views.slice(1).map((v) => v.title)).not.toContain(hass.devices.env_3.name);
    expect(views[0].sections![1].cards[0].exclude_device_ids).toEqual(['env_3']);
  });

  it('says what to do when there are no environments', async () => {
    const views = (await dashboard({}, { ...mockHass(), devices: {}, entities: {} } as HomeAssistant)) as unknown as { cards: { content: string }[] }[];
    expect(views[0].cards[0].content).toContain('Add the Dockhand integration');
  });

  it('is built again only when the environments change', () => {
    const hass = mockHass();
    expect(DockhandDashboardStrategy.shouldRegenerate({}, hass, { ...hass, states: {} } as HomeAssistant)).toBe(false);
    const fewer = { ...hass, devices: Object.fromEntries(Object.entries(hass.devices).filter(([id]) => id !== 'env_4')) } as HomeAssistant;
    expect(DockhandDashboardStrategy.shouldRegenerate({}, hass, fewer)).toBe(true);
    expect(DockhandEnvironmentViewStrategy.shouldRegenerate({}, hass, fewer)).toBe(true);
  });

  it('suggests a title and icon, and has a settings editor', async () => {
    expect(DockhandDashboardStrategy.getCreateSuggestions()).toEqual({ title: 'Dockhand', icon: 'mdi:docker' });
    expect(((await DockhandDashboardStrategy.getConfigElement()) as unknown as HTMLElement).localName).toBe('dockhand-dashboard-strategy-editor');
  });
});

describe('Dockhand environment view', () => {
  /** Nebula's view (env_1). */
  const firstView = async (config: Record<string, unknown> = {}) => (await dashboard(config)).find((v) => v.strategy?.device_id === 'env_1')!;

  it('puts the environment card alone, the short cards together, then stacks and containers, each list solo’d', async () => {
    const sections = await environmentView(await firstView());
    expect(sections.map((s) => types(s.cards))).toEqual([['environment'], ['vulnerability', 'updates', 'schedules'], ['stacks'], ['containers']]);
    expect(sections[0].cards[0]).toMatchObject({ mode: 'full', device_id: 'env_1' });
    expect(sections[1].cards[2]).toMatchObject({ include_global: false });
    expect(sections[1].cards[0]).not.toHaveProperty('device_id');
    for (const c of sections.flatMap((s) => s.cards).filter((c) => 'exclude_device_ids' in c)) expect(c.exclude_device_ids).toEqual(['env_2', 'env_3', 'env_4']);
  });

  it('follows the layout, defaults and overrides', async () => {
    const view = await firstView({
      environment_layout: [['containers'], ['schedules', 'vulnerabilities'], ['environments'], [], ['stacks']],
      environment_mode: 'compact',
      environments_overrides: { env_1: { containers: { show_controls: true } } }
    });
    const sections = await environmentView(view);
    // At most four columns; an empty one is skipped.
    expect(sections.map((s) => types(s.cards))).toEqual([['containers'], ['schedules', 'vulnerability'], ['environment']]);
    expect(sections[0].cards[0]).toMatchObject({ show_controls: true });
    expect(sections[2].cards[0]).toMatchObject({ mode: 'compact' });
  });

  it('leaves out vulnerabilities where scanning is not set up', async () => {
    const hass = mockHass();
    for (const [id, entry] of Object.entries(hass.entities)) if (entry.translation_key === 'vulnerabilities') delete hass.entities[id];
    const sections = await environmentView(await firstView(), hass);
    expect(sections.flatMap((s) => types(s.cards))).not.toContain('vulnerability');
    const [overview] = await dashboard({}, hass);
    expect(overview.sections!.flatMap((s) => types(s.cards))).not.toContain('vulnerability');
  });

  it('generates configs every card accepts', async () => {
    const hass = mockHass();
    const [overview, view] = await dashboard({}, hass);
    expect(view.strategy?.device_id).toBe('env_2');
    const cards = [...overview.sections!.flatMap((s) => s.cards.flatMap((c) => c.cards ?? [c])), ...(await environmentView(view, hass)).flatMap((s) => s.cards)];
    for (const config of cards.filter((c) => (c.type as string).startsWith('custom:'))) {
      const el = document.createElement((config.type as string).replace('custom:', '')) as HTMLElement & {
        setConfig(c: unknown): void;
        hass: HomeAssistant;
        updateComplete: Promise<boolean>;
      };
      el.setConfig(config);
      el.hass = hass;
      document.body.appendChild(el);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('ha-card')).not.toBeNull();
      el.remove();
    }
  });
});

describe('Dockhand dashboard settings', () => {
  type Editor = HTMLElement & { hass: HomeAssistant; setConfig(c: unknown): void; updateComplete: Promise<boolean> };
  type Inner = HTMLElement & { _config: Record<string, unknown>; dashboardStrategy: boolean; updateComplete: Promise<boolean> };
  let el: Editor | undefined;
  afterEach(() => el?.remove());

  async function mount(config: Record<string, unknown>, hass = mockHass()): Promise<{ inner: Inner; seen: Record<string, unknown>[] }> {
    el = document.createElement('dockhand-dashboard-strategy-editor') as Editor;
    el.setConfig({ type: 'custom:dockhand', ...config });
    document.body.appendChild(el);
    el.hass = hass;
    await el.updateComplete;
    const inner = el.shadowRoot!.querySelector('dockhand-overview-card-editor') as Inner;
    await inner.updateComplete;
    const seen: Record<string, unknown>[] = [];
    el.addEventListener('config-changed', (ev) => seen.push((ev as CustomEvent).detail.config));
    return { inner, seen };
  }

  const panel = (n: number): HTMLElement => el!.shadowRoot!.querySelectorAll<HTMLElement>('ha-expansion-panel')[n];
  const columns = (n: number): string[][] =>
    [...panel(n).querySelectorAll('.column')].map((c) => [...c.querySelectorAll<HTMLElement>('.card-chip')].map((chip) => chip.dataset.card!));
  const sortable = (n: number, column: number): HTMLElement => panel(n).querySelectorAll<HTMLElement>('ha-sortable')[column];

  it('lays out both pages in columns, with what isn’t shown last', async () => {
    await mount({ environment_layout: [['environments'], ['containers']] });
    expect(columns(0)).toEqual([['environments'], ['updates', 'vulnerabilities'], ['schedules'], []]);
    expect(columns(1)).toEqual([['environments'], ['containers'], ['vulnerabilities', 'updates', 'schedules', 'stacks']]);
    expect(panel(0).querySelector('.column-count')!.textContent).toBe('3');
  });

  it('moves a card between columns, within one, and out of the layout', async () => {
    const { seen } = await mount({});
    // Schedules dropped into the first column, after Environments.
    sortable(0, 0).dispatchEvent(new CustomEvent('item-added', { detail: { index: 1, data: 'schedules' } }));
    expect(seen.pop()).toEqual({ type: 'custom:dockhand', overview_layout: [['environments', 'schedules'], ['updates', 'vulnerabilities'], []] });
    // Vulnerabilities above Updates.
    sortable(0, 1).dispatchEvent(new CustomEvent('item-moved', { detail: { oldIndex: 1, newIndex: 0 } }));
    expect(seen.pop()!.overview_layout).toEqual([['environments'], ['vulnerabilities', 'updates'], ['schedules']]);
    // Stacks to Not shown.
    sortable(1, 4).dispatchEvent(new CustomEvent('item-added', { detail: { index: 0, data: 'stacks' } }));
    expect(seen.pop()!.environment_layout).toEqual([['environments'], ['vulnerabilities', 'updates', 'schedules'], [], ['containers']]);
    // Reordering Not shown means nothing.
    sortable(1, 4).dispatchEvent(new CustomEvent('item-moved', { detail: { oldIndex: 0, newIndex: 1 } }));
    expect(seen).toEqual([]);
  });

  it('adds and removes columns, the last one’s cards joining the one before', async () => {
    const { seen } = await mount({});
    panel(1).querySelector<HTMLElement>('.fewer')!.click();
    expect(seen.pop()!.environment_layout).toEqual([['environments'], ['vulnerabilities', 'updates', 'schedules'], ['stacks', 'containers']]);
    panel(0).querySelector<HTMLElement>('.more')!.click();
    expect(seen.pop()!.overview_layout).toEqual([['environments'], ['updates', 'vulnerabilities'], ['schedules'], []]);
  });

  it('offers an instance only when there are several', async () => {
    await mount({});
    expect(el!.shadowRoot!.querySelector(':host > ha-form, ha-form')).toBeNull();
    el!.remove();
    const hass = mockHass();
    hass.devices.env_3 = { ...hass.devices.env_3, config_entry_id: 'other' };
    const { seen } = await mount({}, hass);
    const form = el!.shadowRoot!.querySelector('ha-form') as HTMLElement & { schema: { selector: { select: { options: { value: string }[] } } }[] };
    expect(form.schema[0].selector.select.options.map((o) => o.value)).toEqual(['', hass.devices.env_1.config_entry_id, 'other']);
    form.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { config_entry_id: 'other' } } }));
    expect(seen.pop()).toEqual({ type: 'custom:dockhand', config_entry_id: 'other' });
    form.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { config_entry_id: '' } } }));
    expect(seen.pop()).toEqual({ type: 'custom:dockhand' });
  });

  it("has the Overview card's editor for card settings, without show, order or alignment", async () => {
    const { inner } = await mount({ stacks_group_by: 'status' });
    expect(inner.dashboardStrategy).toBe(true);
    expect(inner._config).toMatchObject({ show_stacks: true, stacks_group_by: 'status', environment_mode: 'full' });
    const html = inner.shadowRoot!.innerHTML;
    expect(html).not.toContain('align_columns');
    expect(inner.shadowRoot!.querySelector('.section-order-row .order-handle')).toBeNull();
    el!.hass = mockHass();
    expect((inner as unknown as { _hass: unknown })._hass).toBe((el as unknown as { _hass: unknown })._hass);
  });

  it('writes back only what differs from the defaults, under the strategy type', async () => {
    const { inner, seen } = await mount({ overview_layout: [['environments']] });
    inner.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: {
          config: {
            type: 'custom:dockhand-overview-card',
            show_environments: true,
            section_order: ['stacks'],
            align_columns: true,
            environment_mode: 'full',
            stacks_group_by: 'status',
            overview_layout: [['environments']],
            name: undefined
          }
        },
        bubbles: true,
        composed: true
      })
    );
    expect(seen).toEqual([{ type: 'custom:dockhand', stacks_group_by: 'status', overview_layout: [['environments']] }]);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMockHass } from '../../scripts/screenshot-harness/mock-data.mjs';
import '../render.dom.test-elements';
import { DockhandDashboardStrategy, DockhandDevicesViewStrategy, DockhandEnvironmentViewStrategy, type DockhandDevicesViewConfig, type DockhandEnvironmentViewConfig } from './strategy';
import './editor';
import type { HomeAssistant } from '../common/ha-types';

vi.mock('../common/editor-loader', () => ({ loadEditor: vi.fn().mockResolvedValue(undefined), editorUrl: (u: string) => u }));

type Card = Record<string, unknown> & { cards?: Card[] };
type Section = Card & { cards: Card[] };
type View = { title: string; path: string; subview?: boolean; back_path?: string; max_columns?: number; strategy?: DockhandEnvironmentViewConfig | DockhandDevicesViewConfig; sections?: Section[] };

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
  ((await DockhandEnvironmentViewStrategy.generate(view.strategy as DockhandEnvironmentViewConfig, hass)) as { sections: Section[] }).sections;

const devicesView = async (view: View, hass = mockHass()) =>
  (await DockhandDevicesViewStrategy.generate(view.strategy as DockhandDevicesViewConfig, hass)) as { max_columns: number; sections: Section[] };

const environmentViews = (views: View[]) => views.filter((v) => v.strategy?.type === 'custom:dockhand-environment');

const types = (cards: Card[]): string[] => cards.map((c) => (c.type as string).replace(/^custom:dockhand-|-card$/g, ''));

describe('Dockhand dashboard strategy', () => {
  it('builds an overview, and per environment a subview with its Stacks and Containers pages, with unique paths', async () => {
    const views = await dashboard();
    expect(views[0].title).toBe('Overview');
    const environments = environmentViews(views);
    expect(environments.map((v) => v.title)).toEqual(['Aurora', 'Nebula', 'Orion', 'Vega']);
    expect(environments.every((v) => v.subview)).toBe(true);
    const pages = views.filter((v) => v.strategy?.type === 'custom:dockhand-devices');
    expect(pages).toHaveLength(8);
    const nebula = environments.find((v) => v.title === 'Nebula')!;
    expect(pages.filter((v) => v.back_path === nebula.path).map((v) => (v.strategy as DockhandDevicesViewConfig).kind)).toEqual(['stacks', 'containers']);
    expect(pages.every((v) => v.subview)).toBe(true);
    expect(pages.filter((v) => v.back_path === nebula.path).map((v) => v.title)).toEqual(['Nebula — Stacks', 'Nebula — Containers']);
    expect(new Set(views.map((v) => v.path)).size).toBe(views.length);
  });

  it('lays the overview out as environments across two columns, then vulnerabilities above updates, then schedules', async () => {
    const views = await dashboard();
    const [overview] = views;
    const [envSection, middle, schedules] = overview.sections!;
    expect(overview.max_columns).toBe(4);
    expect(envSection.column_span).toBe(2);
    expect(envSection.cards.every((c) => (c.grid_options as { columns: number }).columns === 12)).toBe(true);
    const headings = envSection.cards.map((stack) => stack.cards![0]);
    expect(headings.map((h) => (h.tap_action as { navigation_path: string }).navigation_path)).toEqual(environmentViews(views).map((v) => v.path));
    expect(envSection.cards.map((stack) => stack.cards![1].mode)).toEqual(['standard', 'standard', 'standard', 'standard']);
    expect(types(middle.cards)).toEqual(['vulnerability', 'updates']);
    expect(middle.cards[0]).not.toHaveProperty('device_id');
    expect(types(schedules.cards)).toEqual(['schedules']);
    expect(schedules.cards[0]).toMatchObject({ show_stats: true });
  });

  it('makes a single environment’s own view the dashboard, with the global schedules and its two pages', async () => {
    const hass = mockHass();
    const views = await dashboard({ exclude_device_ids: ['env_2', 'env_3', 'env_4'] }, hass);
    expect(views).toHaveLength(3);
    expect(views[0]).toMatchObject({ title: 'Nebula', strategy: { device_id: 'env_1', alone: true } });
    expect(views[0].subview).toBeUndefined();
    expect(views.slice(1).map((v) => v.back_path)).toEqual([views[0].path, views[0].path]);
    const sections = await environmentView(views[0], hass);
    expect(sections[1].cards[2]).not.toHaveProperty('include_global');
  });

  it('follows its settings: order, exclusions, layout and the overview’s card settings', async () => {
    const views = await dashboard({
      environments_order: ['env_4'],
      exclude_device_ids: ['env_2'],
      overview_layout: [['updates', 'environments', 'bogus', 'updates'], [], ['schedules']],
      cards: { overview: { updates: { show_controls: true }, environments: { show_settings_link: false, mode: 'compact' } }, environment: { updates: { show_controls: false } } }
    });
    expect(environmentViews(views).map((v) => v.title)).toEqual(['Vega', 'Nebula', 'Orion']);
    const [first, schedules, ...rest] = views[0].sections!;
    // Three environments: their column takes two, and the updates card its
    // whole width. The empty column is skipped.
    expect(first.column_span).toBe(2);
    expect(types(first.cards)).toEqual(['updates', 'vertical-stack', 'vertical-stack', 'vertical-stack']);
    expect(first.cards[0]).toMatchObject({ show_controls: true, exclude_device_ids: ['env_2'], environments_order: ['env_4'], grid_options: { columns: 'full' } });
    expect(first.cards[1].cards![1]).toMatchObject({ mode: 'compact', show_settings_link: false });
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
    expect(environmentViews(views).map((v) => v.title)).not.toContain(hass.devices.env_3.name);
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
  const firstView = async (config: Record<string, unknown> = {}) => (await dashboard(config)).find((v) => v.strategy?.type === 'custom:dockhand-environment' && v.strategy.device_id === 'env_1')!;

  it('puts the environment card alone, the short cards together, then stacks and containers under links to their pages, each list solo’d', async () => {
    const view = await firstView();
    const sections = await environmentView(view);
    expect(sections.map((s) => types(s.cards))).toEqual([['environment'], ['vulnerability', 'updates', 'schedules'], ['heading', 'stacks'], ['heading', 'containers']]);
    expect(sections[0].cards[0]).toMatchObject({ mode: 'full', device_id: 'env_1' });
    expect(sections[1].cards[2]).toMatchObject({ include_global: false });
    expect(sections[1].cards[0]).not.toHaveProperty('device_id');
    expect(sections[2].cards[0]).toMatchObject({ heading: 'Stack details', tap_action: { action: 'navigate', navigation_path: `${view.path}-stacks` } });
    expect(sections[3].cards[0]).toMatchObject({ heading: 'Container details', tap_action: { navigation_path: `${view.path}-containers` } });
    for (const c of sections.flatMap((s) => s.cards).filter((c) => 'exclude_device_ids' in c)) expect(c.exclude_device_ids).toEqual(['env_2', 'env_3', 'env_4']);
  });

  it('follows the layout and the environment pages’ card settings', async () => {
    const view = await firstView({
      environment_layout: [['containers'], ['schedules', 'vulnerabilities'], ['environments'], [], ['stacks']],
      cards: { environment: { environments: { mode: 'compact' }, containers: { show_controls: true } }, overview: { containers: { show_controls: false } } }
    });
    const sections = await environmentView(view);
    // At most four columns; an empty one is skipped.
    expect(sections.map((s) => types(s.cards))).toEqual([['heading', 'containers'], ['schedules', 'vulnerability'], ['environment']]);
    expect(sections[0].cards[1]).toMatchObject({ show_controls: true });
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
    const views = await dashboard({}, hass);
    const [overview] = views;
    const view = environmentViews(views)[0];
    expect(view.strategy?.device_id).toBe('env_2');
    const pages = views.filter((v) => v.strategy?.type === 'custom:dockhand-devices' && v.strategy.device_id === 'env_1');
    const cards = [
      ...overview.sections!.flatMap((s) => s.cards.flatMap((c) => c.cards ?? [c])),
      ...(await environmentView(view, hass)).flatMap((s) => s.cards),
      ...(await Promise.all(pages.map((p) => devicesView(p, hass)))).flatMap((p) => p.sections.flatMap((s) => s.cards))
    ];
    expect(types(cards)).toEqual(expect.arrayContaining(['stack', 'container']));
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

describe('Dockhand Stacks and Containers pages', () => {
  const page = async (kind: 'stacks' | 'containers', config: Record<string, unknown> = {}, hass = mockHass()) => {
    const views = await dashboard(config, hass);
    return views.find((v) => v.strategy?.type === 'custom:dockhand-devices' && v.strategy.device_id === 'env_1' && v.strategy.kind === kind)!;
  };

  it('shows a Stack card per stack, by name, with the Stack card settings', async () => {
    const { sections, max_columns } = await devicesView(await page('stacks', { cards: { stack: { show_controls: false } } }));
    expect(max_columns).toBe(4);
    expect(sections.map((s) => s.cards[0])).toEqual([
      { type: 'custom:dockhand-stack-card', show_controls: false, device_id: 'stack_1_core' },
      { type: 'custom:dockhand-stack-card', show_controls: false, device_id: 'stack_1_monitoring' }
    ]);
  });

  it('shows a Container card per container, by name, with the Container card settings', async () => {
    const { sections } = await devicesView(await page('containers', { cards: { container: { visible_sections: ['status'] } } }));
    expect(sections.map((s) => s.cards[0].device_id)).toEqual(['container_1_backup', 'container_1_postgres', 'container_1_redis', 'container_1_traefik', 'container_1_web', 'container_1_worker']);
    expect(sections[0].cards[0]).toMatchObject({ type: 'custom:dockhand-container-card', visible_sections: ['status'] });
  });

  it('says so when there are none, and is built again when they come and go', async () => {
    const hass = mockHass();
    const view = await page('stacks', {}, hass);
    const none = { ...hass, devices: Object.fromEntries(Object.entries(hass.devices).filter(([id]) => !id.startsWith('stack_1_'))) } as HomeAssistant;
    const { sections } = await devicesView(view, none);
    expect(sections[0].cards[0]).toMatchObject({ type: 'markdown', content: 'No stacks in this environment.' });
    const config = view.strategy as DockhandDevicesViewConfig;
    expect(DockhandDevicesViewStrategy.shouldRegenerate(config, hass, { ...hass, states: {} } as HomeAssistant)).toBe(false);
    expect(DockhandDevicesViewStrategy.shouldRegenerate(config, hass, none)).toBe(true);
    expect(DockhandDevicesViewStrategy.shouldRegenerate({ ...config, device_id: 'gone' }, hass, none)).toBe(false);
  });
});

describe('Dockhand dashboard settings', () => {
  type Editor = HTMLElement & { hass: HomeAssistant; setConfig(c: unknown): void; updateComplete: Promise<boolean> };
  type CardEditor = HTMLElement & { cardIsEmbedded: boolean; scopeFixed?: boolean; hideTitle?: boolean; _config: Record<string, unknown>; updateComplete: Promise<boolean> };
  let el: Editor | undefined;
  afterEach(() => el?.remove());

  async function mount(config: Record<string, unknown>, hass = mockHass()): Promise<{ seen: Record<string, unknown>[] }> {
    el = document.createElement('dockhand-dashboard-strategy-editor') as Editor;
    el.setConfig({ type: 'custom:dockhand', ...config });
    document.body.appendChild(el);
    el.hass = hass;
    await el.updateComplete;
    const seen: Record<string, unknown>[] = [];
    el.addEventListener('config-changed', (ev) => seen.push((ev as CustomEvent).detail.config));
    return { seen };
  }

  const root = () => el!.shadowRoot!;
  const panel = (key: string): HTMLElement => root().querySelector<HTMLElement>(`ha-expansion-panel[data-layout="${key}"]`)!;
  const columns = (key: string): string[][] =>
    [...panel(key).querySelectorAll('.column')].map((c) => [...c.querySelectorAll<HTMLElement>('.card-chip')].map((chip) => chip.dataset.card!));
  const sortable = (key: string, column: number): HTMLElement => panel(key).querySelectorAll<HTMLElement>('ha-sortable')[column];

  /** Opens a card's settings with its pencil, and the card editor it shows. */
  async function open(target: HTMLElement): Promise<CardEditor> {
    target.querySelector<HTMLElement>('.edit-card')!.click();
    await el!.updateComplete;
    const editor = root().querySelector<CardEditor>('.card-editor')!;
    await editor.updateComplete;
    return editor;
  }

  it('lays out both pages in columns, with what isn’t shown last', async () => {
    await mount({ environment_layout: [['environments'], ['containers']] });
    expect(columns('overview_layout')).toEqual([['environments'], ['vulnerabilities', 'updates'], ['schedules'], []]);
    expect(columns('environment_layout')).toEqual([['environments'], ['containers'], ['vulnerabilities', 'updates', 'schedules', 'stacks']]);
    expect(panel('overview_layout').querySelector('.column-count')!.textContent).toBe('3');
    // Only the overview says the environments may take two columns.
    expect(panel('overview_layout').querySelector('.hint')!.textContent).toContain('two columns');
    expect(panel('environment_layout').querySelector('.hint')!.textContent).not.toContain('two columns');
    // The drop point for leaving cards out says what it holds.
    const hiddenTitle = (key: string) => panel(key).querySelector('.hidden-cards .column-title')!.textContent;
    expect(hiddenTitle('overview_layout')).toBe('Hide');
    expect(hiddenTitle('environment_layout')).toBe('Hidden');
  });

  it('starts with every page’s panel folded, and keeps one open on the way back from a card', async () => {
    await mount({});
    const environments = root().querySelector('ha-expansion-panel:not([data-layout])')!;
    expect(environments.hasAttribute('expanded')).toBe(true);
    expect(environments.hasAttribute('no-collapse')).toBe(false);
    const overview = () => panel('overview_layout') as HTMLElement & { expanded: boolean };
    expect(overview().expanded).toBe(false);
    expect((panel('environment_layout') as HTMLElement & { expanded: boolean }).expanded).toBe(false);
    expect((panel('device_pages') as HTMLElement & { expanded: boolean }).expanded).toBe(false);
    overview().dispatchEvent(new CustomEvent('expanded-changed', { detail: { expanded: true } }));
    await el!.updateComplete;
    await open(overview().querySelector<HTMLElement>('.card-chip[data-card="updates"]')!);
    root().querySelector<HTMLElement>('.back')!.click();
    await el!.updateComplete;
    expect(overview().expanded).toBe(true);
    overview().dispatchEvent(new CustomEvent('expanded-changed', { detail: { expanded: false } }));
    await el!.updateComplete;
    expect(overview().expanded).toBe(false);
  });

  it('leaves out the overview’s layout when one environment is shown, as the dashboard opens on its page', async () => {
    await mount({ exclude_device_ids: ['env_2', 'env_3', 'env_4'] });
    expect(panel('overview_layout')).toBeNull();
    expect(panel('environment_layout')).not.toBeNull();
  });

  it('moves a card between columns, within one, and out of the layout', async () => {
    const { seen } = await mount({});
    // Schedules dropped into the first column, after Environments.
    sortable('overview_layout', 0).dispatchEvent(new CustomEvent('item-added', { detail: { index: 1, data: 'schedules' } }));
    expect(seen.pop()).toEqual({ type: 'custom:dockhand', overview_layout: [['environments', 'schedules'], ['vulnerabilities', 'updates'], []] });
    // Updates above Vulnerabilities.
    sortable('overview_layout', 1).dispatchEvent(new CustomEvent('item-moved', { detail: { oldIndex: 1, newIndex: 0 } }));
    expect(seen.pop()!.overview_layout).toEqual([['environments'], ['updates', 'vulnerabilities'], ['schedules']]);
    // Stacks to Hide.
    sortable('environment_layout', 4).dispatchEvent(new CustomEvent('item-added', { detail: { index: 0, data: 'stacks' } }));
    expect(seen.pop()!.environment_layout).toEqual([['environments'], ['vulnerabilities', 'updates', 'schedules'], [], ['containers']]);
    // Reordering Hide means nothing.
    sortable('environment_layout', 4).dispatchEvent(new CustomEvent('item-moved', { detail: { oldIndex: 0, newIndex: 1 } }));
    expect(seen).toEqual([]);
  });

  it('adds and removes columns, the last one’s cards joining the one before', async () => {
    const { seen } = await mount({});
    panel('environment_layout').querySelector<HTMLElement>('.fewer')!.click();
    expect(seen.pop()!.environment_layout).toEqual([['environments'], ['vulnerabilities', 'updates', 'schedules'], ['stacks', 'containers']]);
    panel('overview_layout').querySelector<HTMLElement>('.more')!.click();
    expect(seen.pop()!.overview_layout).toEqual([['environments'], ['vulnerabilities', 'updates'], ['schedules'], []]);
  });

  it('chooses the environments', async () => {
    const { seen } = await mount({ exclude_device_ids: ['env_2'] });
    const list = [...root().querySelectorAll<HTMLElement>('.order-row:not(.card-chip)')];
    expect(list.map((r) => r.querySelector('.order-name')!.textContent)).toEqual(['Aurora', 'Nebula', 'Orion', 'Vega']);
    expect(list[0].classList.contains('hidden')).toBe(true);
    const actions = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>('ha-icon-button')];
    // Solo, then show or hide one.
    actions(list[2])[0].click();
    expect(seen.pop()).toEqual({ type: 'custom:dockhand', exclude_device_ids: ['env_2', 'env_1', 'env_4'] });
    actions(list[0])[1].click();
    expect(seen.pop()).toEqual({ type: 'custom:dockhand' });
    actions(list[1])[1].click();
    expect(seen.pop()).toEqual({ type: 'custom:dockhand', exclude_device_ids: ['env_2', 'env_1'] });
    const [all, none] = root().querySelectorAll<HTMLElement>('.link-btn');
    all.click();
    expect(seen.pop()).toEqual({ type: 'custom:dockhand' });
    none.click();
    expect(seen.pop()!.exclude_device_ids).toHaveLength(4);
    list[0].closest('ha-sortable')!.dispatchEvent(new CustomEvent('item-moved', { detail: { oldIndex: 0, newIndex: 3 } }));
    expect(seen.pop()).toMatchObject({ environments_order: ['env_1', 'env_3', 'env_4', 'env_2'] });
  });

  it('offers an instance only when there are several', async () => {
    await mount({});
    expect(root().querySelector('ha-form')).toBeNull();
    el!.remove();
    const hass = mockHass();
    hass.devices.env_3 = { ...hass.devices.env_3, config_entry_id: 'other' };
    const { seen } = await mount({}, hass);
    const form = root().querySelector('ha-form') as HTMLElement & { schema: { selector: { select: { options: { value: string }[] } } }[] };
    expect(form.schema[0].selector.select.options.map((o) => o.value)).toEqual(['', hass.devices.env_1.config_entry_id, 'other']);
    form.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { config_entry_id: 'other' } } }));
    expect(seen.pop()).toEqual({ type: 'custom:dockhand', config_entry_id: 'other' });
    form.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { config_entry_id: '' } } }));
    expect(seen.pop()).toEqual({ type: 'custom:dockhand' });
  });

  it('edits an overview card with its own editor, across the dashboard’s environments', async () => {
    const { seen } = await mount({ cards: { overview: { schedules: { group_by: 'none' } } } });
    const chip = panel('overview_layout').querySelector<HTMLElement>('.card-chip[data-card="schedules"]')!;
    const editor = await open(chip);
    expect(editor.localName).toBe('dockhand-schedules-card-editor');
    expect([editor.cardIsEmbedded, editor.scopeFixed, editor.hideTitle]).toEqual([false, true, false]);
    expect(editor._config).toMatchObject({ type: 'custom:dockhand-schedules-card', show_stats: true, group_by: 'none' });
    expect(root().querySelector('.detail-name')!.textContent).toBe('Overview page · Schedules');
    editor.dispatchEvent(new CustomEvent('config-changed', { detail: { config: { type: 'custom:dockhand-schedules-card', show_stats: false, group_by: 'none', exclude_device_ids: [] } }, bubbles: true, composed: true }));
    expect(seen).toEqual([{ type: 'custom:dockhand', cards: { overview: { schedules: { show_stats: false, group_by: 'none' } } } }]);
    root().querySelector<HTMLElement>('.back')!.click();
    await el!.updateComplete;
    expect(panel('overview_layout')).not.toBeNull();
  });

  it('edits an environment page’s card for every environment', async () => {
    const { seen } = await mount({ cards: { environment: { containers: { show_controls: true } }, overview: { updates: { show_controls: true } } } });
    const editor = await open(panel('environment_layout').querySelector<HTMLElement>('.card-chip[data-card="environments"]')!);
    expect(editor.localName).toBe('dockhand-environment-card-editor');
    expect([editor.cardIsEmbedded, editor.hideTitle]).toEqual([true, true]);
    expect(editor._config).toMatchObject({ mode: 'full' });
    editor.dispatchEvent(new CustomEvent('config-changed', { detail: { config: { type: 'custom:dockhand-environment-card', device_id: '', mode: 'compact' } } }));
    expect(seen.pop()).toEqual({
      type: 'custom:dockhand',
      cards: { environment: { containers: { show_controls: true }, environments: { mode: 'compact' } }, overview: { updates: { show_controls: true } } }
    });
    // A new hass reaches the open editor.
    const hass = mockHass();
    el!.hass = hass;
    expect((editor as unknown as { _hass: unknown })._hass).toBe(hass);
  });

  it('drops a card, then its page, once their settings are cleared', async () => {
    const { seen } = await mount({ cards: { environment: { containers: { show_controls: true }, vulnerabilities: { show_settings_link: false } } } });
    const editor = await open(panel('environment_layout').querySelector<HTMLElement>('.card-chip[data-card="vulnerabilities"]')!);
    expect(editor.localName).toBe('dockhand-vulnerability-card-editor');
    editor.dispatchEvent(new CustomEvent('config-changed', { detail: { config: { type: 'custom:dockhand-vulnerability-card' } } }));
    expect(seen.pop()).toEqual({ type: 'custom:dockhand', cards: { environment: { containers: { show_controls: true } } } });
    el!.setConfig({ type: 'custom:dockhand', cards: { environment: { vulnerabilities: { show_settings_link: false } } } });
    await el!.updateComplete;
    editor.dispatchEvent(new CustomEvent('config-changed', { detail: { config: { type: 'custom:dockhand-vulnerability-card' } } }));
    expect(seen.pop()).toEqual({ type: 'custom:dockhand' });
  });

  it('edits the Stack and Container cards of their pages, and drops cleared settings', async () => {
    const { seen } = await mount({ cards: { stack: { show_controls: false } } });
    const stack = await open(panel('device_pages').querySelector<HTMLElement>('.card-row[data-page="stack"]')!);
    expect(stack.localName).toBe('dockhand-stack-card-editor');
    expect(stack.cardIsEmbedded).toBe(true);
    // No stack to pick, and no name.
    const form = stack.shadowRoot!.querySelector('ha-form') as HTMLElement & { schema: { name: string; schema?: { name: string }[] }[] };
    expect(form.schema.map((f) => f.name)).toEqual(['content']);
    expect(form.schema[0].schema!.map((f) => f.name)).not.toContain('name');
    stack.dispatchEvent(new CustomEvent('config-changed', { detail: { config: { type: 'custom:dockhand-stack-card' } } }));
    expect(seen.pop()).toEqual({ type: 'custom:dockhand' });

    root().querySelector<HTMLElement>('.back')!.click();
    await el!.updateComplete;
    const container = await open(panel('device_pages').querySelector<HTMLElement>('.card-row[data-page="container"]')!);
    expect(container.localName).toBe('dockhand-container-card-editor');
    const containerForm = container.shadowRoot!.querySelector('ha-form')!;
    containerForm.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { type: 'custom:dockhand-container-card', environment_device_id: undefined, show_controls: false } } }));
    expect(seen.pop()).toEqual({ type: 'custom:dockhand', cards: { stack: { show_controls: false }, container: { show_controls: false } } });
  });
});

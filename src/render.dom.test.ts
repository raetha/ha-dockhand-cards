// @vitest-environment jsdom
/**
 * Every card and editor rendered against the screenshot harness's mock
 * Home Assistant (four environments with stacks, containers, schedules,
 * updates and vulnerabilities), in each display mode the README shows, plus
 * the states a user can hit: an offline environment, a missing device, an
 * empty config, another language. Catches render code that throws or draws
 * nothing, which the screenshots only show when someone looks.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMockHass } from '../scripts/screenshot-harness/mock-data.mjs';
import { DockhandEnvironmentCard } from './dockhand-environment-card/card';
import { DockhandVulnerabilityCard } from './dockhand-vulnerability-card/card';
import { DockhandStackCard } from './dockhand-stack-card/card';
import { DockhandContainerCard } from './dockhand-container-card/card';
import { DockhandStacksCard } from './dockhand-stacks-card/card';
import { DockhandContainersCard } from './dockhand-containers-card/card';
import { DockhandUpdatesCard } from './dockhand-updates-card/card';
import { DockhandSchedulesCard } from './dockhand-schedules-card/card';
import { DockhandOverviewCard } from './dockhand-overview-card/card';
import { DockhandEnvironmentCardEditor } from './dockhand-environment-card/editor';
import { DockhandVulnerabilityCardEditor } from './dockhand-vulnerability-card/editor';
import { DockhandStackCardEditor } from './dockhand-stack-card/editor';
import { DockhandContainerCardEditor } from './dockhand-container-card/editor';
import { DockhandStacksCardEditor } from './dockhand-stacks-card/editor';
import { DockhandContainersCardEditor } from './dockhand-containers-card/editor';
import { DockhandUpdatesCardEditor } from './dockhand-updates-card/editor';
import { DockhandSchedulesCardEditor } from './dockhand-schedules-card/editor';
import { DockhandOverviewCardEditor } from './dockhand-overview-card/editor';
import type { HomeAssistant } from './common/ha-types';

type Element_ = HTMLElement & {
  hass: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
  getCardSize?: () => number | Promise<number>;
  getGridOptions?: () => unknown;
};

const CARDS = {
  environment: DockhandEnvironmentCard,
  vulnerability: DockhandVulnerabilityCard,
  stack: DockhandStackCard,
  container: DockhandContainerCard,
  stacks: DockhandStacksCard,
  containers: DockhandContainersCard,
  updates: DockhandUpdatesCard,
  schedules: DockhandSchedulesCard,
  overview: DockhandOverviewCard
} as const;
type Card = keyof typeof CARDS;

const EDITORS: Record<Card, CustomElementConstructor> = {
  environment: DockhandEnvironmentCardEditor,
  vulnerability: DockhandVulnerabilityCardEditor,
  stack: DockhandStackCardEditor,
  container: DockhandContainerCardEditor,
  stacks: DockhandStacksCardEditor,
  containers: DockhandContainersCardEditor,
  updates: DockhandUpdatesCardEditor,
  schedules: DockhandSchedulesCardEditor,
  overview: DockhandOverviewCardEditor
};

// Registered under the real names: the Overview card creates the others by
// name, and its editor embeds the other editors.
for (const [card, cls] of Object.entries(CARDS)) {
  if (!customElements.get(`dockhand-${card}-card`)) customElements.define(`dockhand-${card}-card`, cls as unknown as CustomElementConstructor);
}
for (const [card, cls] of Object.entries(EDITORS)) {
  if (!customElements.get(`dockhand-${card}-card-editor`)) customElements.define(`dockhand-${card}-card-editor`, cls);
}

function mockHass(language = 'en'): HomeAssistant {
  const { devices, entities, states } = buildMockHass();
  return {
    devices,
    entities,
    states,
    language,
    locale: { language, number_format: 'language', time_format: 'language' },
    themes: { darkMode: true },
    callApi: vi.fn().mockResolvedValue([]),
    callService: vi.fn().mockResolvedValue(undefined),
    callWS: vi.fn().mockResolvedValue({})
  } as unknown as HomeAssistant;
}

const mounted: HTMLElement[] = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
});

async function mount(tag: string, config: Record<string, unknown>, hass: HomeAssistant): Promise<Element_> {
  const el = document.createElement(tag) as Element_;
  el.setConfig({ type: `custom:${tag.replace(/-editor$/, '')}`, ...config });
  el.hass = hass;
  document.body.appendChild(el);
  mounted.push(el);
  await el.updateComplete;
  // The Overview card's sub-cards render in their own updates.
  for (const child of el.shadowRoot?.querySelectorAll<Element_>('[class*="dockhand"], dockhand-environment-card, dockhand-stacks-card, dockhand-containers-card, dockhand-updates-card, dockhand-schedules-card, dockhand-vulnerability-card') ?? []) {
    await child.updateComplete;
  }
  return el;
}

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
  ['stacks', { group_by: 'type', show_controls: true }],
  ['containers', { device_id: 'env_1' }],
  ['containers', { group_by: 'environment', sort_by: 'status', show_controls: true }],
  ['updates', { scope: 'all' }],
  ['updates', { group_by: 'environment' }],
  ['schedules', { group_by: 'environment' }],
  ['schedules', { group_by: 'status', show_stats: true, show_controls: true }],
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
    const el = await mount(`dockhand-${card}-card`, config, mockHass());
    const root = el.shadowRoot!;
    expect(root.innerHTML.length).toBeGreaterThan(0);
    expect(root.querySelector('.card-message.error')).toBeNull();
    if (el.getCardSize) expect(await el.getCardSize()).toBeGreaterThan(0);
    if (el.getGridOptions) expect(el.getGridOptions()).toBeTruthy();
  });

  it.each(Object.keys(CARDS) as Card[])('%s in another language', async (card) => {
    const config = CASES.find(([c]) => c === card)![1];
    const el = await mount(`dockhand-${card}-card`, config, mockHass('de'));
    expect(el.shadowRoot!.innerHTML.length).toBeGreaterThan(0);
  });

  it.each(['environment', 'vulnerability', 'stack', 'container'] as Card[])('%s for a device that is gone', async (card) => {
    const el = await mount(`dockhand-${card}-card`, { device_id: 'no-such-device' }, mockHass());
    expect(el.shadowRoot!.textContent).not.toBe('');
  });
});

describe('every editor renders', () => {
  it.each(CASES.filter(([card], i) => CASES.findIndex(([c]) => c === card) === i))('%s', async (card, config) => {
    const el = await mount(`dockhand-${card}-card-editor`, config, mockHass());
    expect(el.shadowRoot!.innerHTML.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(EDITORS) as Card[])('%s with an empty config', async (card) => {
    const el = await mount(`dockhand-${card}-card-editor`, {}, mockHass('fr'));
    expect(el.shadowRoot!.innerHTML.length).toBeGreaterThan(0);
  });
});

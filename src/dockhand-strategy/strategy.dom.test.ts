// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildMockHass } from '../../scripts/screenshot-harness/mock-data.mjs';
import '../render.dom.test-elements';
import { DockhandDashboardStrategy, DockhandEnvironmentViewStrategy, type DockhandEnvironmentViewConfig } from './strategy';
import type { HomeAssistant } from '../common/ha-types';

type View = { title: string; path: string; strategy?: DockhandEnvironmentViewConfig; sections?: { cards: Record<string, unknown>[] }[] };

function mockHass(): HomeAssistant {
  const { devices, entities, states } = buildMockHass();
  return { devices, entities, states, language: 'en', locale: { language: 'en' }, themes: { darkMode: false } } as unknown as HomeAssistant;
}

describe('Dockhand dashboard strategy', () => {
  it('builds an overview and a lazily built view per environment, with unique paths', async () => {
    const hass = mockHass();
    const { views } = (await DockhandDashboardStrategy.generate({}, hass)) as { views: View[] };
    expect(views[0].title).toBe('Overview');
    const environments = views.slice(1);
    expect(environments.map((v) => v.title)).toEqual(['Aurora', 'Nebula', 'Orion', 'Vega']);
    expect(new Set(views.map((v) => v.path)).size).toBe(views.length);
    expect(environments.every((v) => v.strategy?.type === 'custom:dockhand-environment')).toBe(true);
    // Each environment's heading on the overview opens its view.
    const headings = views[0].sections!.flatMap((s) => s.cards).filter((c) => c.type === 'heading');
    expect(headings.map((h) => (h.tap_action as { navigation_path: string }).navigation_path)).toEqual(environments.map((v) => v.path));
  });

  it('says what to do when there are no environments', async () => {
    const { views } = (await DockhandDashboardStrategy.generate({}, { ...mockHass(), devices: {}, entities: {} } as HomeAssistant)) as {
      views: { cards: { content: string }[] }[];
    };
    expect(views[0].cards[0].content).toContain('Add the Dockhand integration');
  });

  it('is built again only when the environments change', () => {
    const hass = mockHass();
    expect(DockhandDashboardStrategy.shouldRegenerate({}, hass, { ...hass, states: {} } as HomeAssistant)).toBe(false);
    const fewer = { ...hass, devices: Object.fromEntries(Object.entries(hass.devices).filter(([id]) => id !== 'env_4')) } as HomeAssistant;
    expect(DockhandDashboardStrategy.shouldRegenerate({}, hass, fewer)).toBe(true);
    expect(DockhandEnvironmentViewStrategy.shouldRegenerate({}, hass, fewer)).toBe(true);
  });

  it('suggests a title and icon, and has no settings', () => {
    expect(DockhandDashboardStrategy.getCreateSuggestions()).toEqual({ title: 'Dockhand', icon: 'mdi:docker' });
    expect(DockhandDashboardStrategy.noEditor).toBe(true);
  });
});

describe('Dockhand environment view', () => {
  const view = async (hass: HomeAssistant, deviceId: string) =>
    (await DockhandEnvironmentViewStrategy.generate({ type: 'custom:dockhand-environment', device_id: deviceId }, hass)) as {
      sections: { cards: Record<string, unknown>[] }[];
    };

  it("shows the environment's cards, each list solo'd to it", async () => {
    const hass = mockHass();
    const { sections } = await view(hass, 'env_1');
    const cards = sections.flatMap((s) => s.cards);
    expect(cards.map((c) => c.type)).toEqual([
      'custom:dockhand-environment-card',
      'custom:dockhand-vulnerability-card',
      'custom:dockhand-updates-card',
      'custom:dockhand-schedules-card',
      'custom:dockhand-stacks-card',
      'custom:dockhand-containers-card'
    ]);
    for (const c of cards.filter((c) => 'exclude_device_ids' in c)) expect(c.exclude_device_ids).toEqual(['env_2', 'env_3', 'env_4']);
  });

  it('leaves out vulnerabilities where scanning is not set up', async () => {
    const hass = mockHass();
    for (const [id, entry] of Object.entries(hass.entities)) if (entry.translation_key === 'vulnerabilities') delete hass.entities[id];
    const { sections } = await view(hass, 'env_1');
    expect(sections.flatMap((s) => s.cards).map((c) => c.type)).not.toContain('custom:dockhand-vulnerability-card');
  });

  it('generates configs every card accepts', async () => {
    const hass = mockHass();
    const { sections } = await view(hass, 'env_1');
    for (const config of sections.flatMap((s) => s.cards)) {
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

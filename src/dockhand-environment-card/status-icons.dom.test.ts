// @vitest-environment jsdom
/** The Environment card's header icons for the environment's settings. */
import { describe, it, expect, afterEach } from 'vitest';
import { buildMockHass } from '../../scripts/screenshot-harness/mock-data.mjs';
import '../render.dom.test-elements';
import type { HomeAssistant } from '../common/ha-types';

type Lit = HTMLElement & { hass: HomeAssistant; setConfig(config: Record<string, unknown>): void; updateComplete: Promise<boolean> };

const mounted: HTMLElement[] = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
});

function mockHass(): HomeAssistant {
  const { devices, entities, states } = buildMockHass();
  return { devices, entities, states, language: 'en', locale: { language: 'en' }, themes: { darkMode: false } } as unknown as HomeAssistant;
}

async function mount(hass: HomeAssistant): Promise<Lit> {
  const el = document.createElement('dockhand-environment-card') as Lit;
  el.setConfig({ type: 'custom:dockhand-environment-card', device_id: 'env_1' });
  el.hass = hass;
  document.body.appendChild(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
}

const icons = (el: Lit): HTMLElement[] => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.header-right .header-icon')].filter((i) => i.querySelector('ha-state-icon'));
const entityOf = (hass: HomeAssistant, key: string): string => Object.values(hass.entities).find((e) => e.device_id === 'env_1' && e.translation_key === key)!.entity_id;

describe('Environment card status icons', () => {
  it('shows a feature that is off in the off color, and opens its control', async () => {
    const hass = mockHass();
    const metrics = entityOf(hass, 'metrics_collection');
    hass.states[metrics] = { ...hass.states[metrics], state: 'off' };
    const el = await mount(hass);
    const all = icons(el);
    expect(all).toHaveLength(4);
    const off = all.find((i) => i.getAttribute('title')!.includes('metrics'))!;
    expect(off.getAttribute('style')).toContain('--dockhand-status-off-color');
    expect(off.getAttribute('title')).toMatch(/: off$/);
    const opened: string[] = [];
    el.addEventListener('hass-more-info', (ev) => opened.push((ev as CustomEvent).detail.entityId));
    off.click();
    expect(opened).toEqual([metrics]);
  });

  it('opens the scanner select from the scanning icon', async () => {
    const hass = mockHass();
    const el = await mount(hass);
    const opened: string[] = [];
    el.addEventListener('hass-more-info', (ev) => opened.push((ev as CustomEvent).detail.entityId));
    icons(el).find((i) => i.getAttribute('title')!.includes('scanning'))!.click();
    expect(opened).toEqual([entityOf(hass, 'vulnerability_scanner')]);
  });

  it('shows auto-update when it is on, update checks otherwise, and nothing for a missing entity', async () => {
    const hass = mockHass();
    const auto = entityOf(hass, 'auto_update');
    const titles = async (): Promise<string[]> => icons(await mount(hass)).map((i) => i.getAttribute('title')!);
    hass.states[auto] = { ...hass.states[auto], state: 'on' };
    expect((await titles()).some((t) => t.includes('auto update'))).toBe(true);
    hass.states[auto] = { ...hass.states[auto], state: 'off' };
    expect((await titles()).some((t) => t.includes('update checks'))).toBe(true);
    delete hass.entities[entityOf(hass, 'activity_logging')];
    expect(await titles()).toHaveLength(3);
  });
});

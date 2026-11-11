// @vitest-environment jsdom
/** The Environment card reads its counts and sizes from ha-dockhand 2.0's
 * own sensors, not attributes. */
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

async function mount(tag: string, config: Record<string, unknown>, hass: HomeAssistant): Promise<Lit> {
  const el = document.createElement(tag) as Lit;
  el.setConfig({ type: `custom:${tag}`, device_id: 'env_1', ...config });
  el.hass = hass;
  document.body.appendChild(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
}

const entityOf = (hass: HomeAssistant, key: string): string => Object.values(hass.entities).find((e) => e.device_id === 'env_1' && e.translation_key === key)!.entity_id;
const set = (hass: HomeAssistant, key: string, state: string) => {
  const id = entityOf(hass, key);
  hass.states[id] = { ...hass.states[id], state };
};
const texts = (el: Lit, selector: string): string[] => [...el.shadowRoot!.querySelectorAll(selector)].map((n) => n.textContent!.replace(/\s+/g, ' ').trim());

describe('Environment card counts', () => {
  it('shows each state’s and kind’s count from its sensor', async () => {
    const hass = mockHass();
    set(hass, 'containers_running', '9');
    set(hass, 'containers_stopped', '4');
    set(hass, 'containers_paused', '2');
    set(hass, 'containers_restarting', '1');
    set(hass, 'containers_unhealthy', '0');
    set(hass, 'pending_updates', '6');
    set(hass, 'installable_updates', '3');
    set(hass, 'system_updates', '1');
    set(hass, 'version_tag_updates', '2');
    set(hass, 'stacks_running', '5');
    set(hass, 'stacks_partial', '2');
    set(hass, 'stacks_stopped', '1');
    const el = await mount('dockhand-environment-card', { mode: 'standard' }, hass);
    expect(texts(el, '.stats-row .stat').slice(0, 6)).toEqual(['9', '4', '2', '1', '0', '6']);
    const updates = el.shadowRoot!.querySelectorAll<HTMLElement>('.stats-row .stat')[5];
    expect(updates.getAttribute('title')).toBe('Pending updates — Installable: 3, System: 1, New version tags: 2');
    expect(texts(el, '.breakdown').find((t) => t.includes('/'))).toMatch(/5\/2\/1$/);
  });

  it('counts a sensor that is unavailable as 0', async () => {
    const hass = mockHass();
    set(hass, 'containers_running', 'unavailable');
    const el = await mount('dockhand-environment-card', { mode: 'compact' }, hass);
    expect(texts(el, '.stats-row .stat')[0]).toBe('0');
  });

  it('names the sensors a mode needs that are turned off, in the editor', async () => {
    const hass = mockHass();
    for (const key of ['disk_usage_images', 'activity_events_today']) {
      const id = entityOf(hass, key);
      hass.entities[id] = { ...hass.entities[id], disabled_by: 'integration' } as (typeof hass.entities)[string];
    }
    const el = await mount('dockhand-environment-card-editor', { mode: 'full' }, hass);
    const forms = [...el.shadowRoot!.querySelectorAll('ha-form')] as (HTMLElement & { warning?: Record<string, string> })[];
    const warning = forms.map((f) => f.warning?.mode).find(Boolean)!;
    expect(warning).toContain('Activity events today');
    expect(warning).toContain('Images disk usage');
  });
});

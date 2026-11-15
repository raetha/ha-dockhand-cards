// @vitest-environment jsdom
/** The Environment card's header icons for the environment's settings. */
import { describe, it, expect } from 'vitest';
import '../render.dom.test-elements';
import type { HomeAssistant } from '../common/ha-types';
import { harnessHass, mount, type Lit } from '../common/mount.test-helpers';

const icons = (el: Lit): HTMLElement[] => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.header-right .header-icon')].filter((i) => i.querySelector('ha-state-icon'));
const entityOf = (hass: HomeAssistant, key: string): string => Object.values(hass.entities).find((e) => e.device_id === 'env_1' && e.translation_key === key)!.entity_id;

describe('Environment card status icons', () => {
  it('shows a feature that is off in the off color, and opens its control', async () => {
    const hass = harnessHass();
    const metrics = entityOf(hass, 'metrics_collection');
    hass.states[metrics] = { ...hass.states[metrics], state: 'off' };
    const el = await mount('dockhand-environment-card', { device_id: 'env_1' }, hass);
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
    const hass = harnessHass();
    const el = await mount('dockhand-environment-card', { device_id: 'env_1' }, hass);
    const opened: string[] = [];
    el.addEventListener('hass-more-info', (ev) => opened.push((ev as CustomEvent).detail.entityId));
    icons(el).find((i) => i.getAttribute('title')!.includes('scanning'))!.click();
    expect(opened).toEqual([entityOf(hass, 'vulnerability_scanner')]);
  });

  it('shows auto-update when it is on, update checks otherwise, and nothing for a missing entity', async () => {
    const hass = harnessHass();
    const auto = entityOf(hass, 'auto_update');
    const titles = async (): Promise<string[]> => icons(await mount('dockhand-environment-card', { device_id: 'env_1' }, hass)).map((i) => i.getAttribute('title')!);
    hass.states[auto] = { ...hass.states[auto], state: 'on' };
    expect((await titles()).some((t) => t.includes('auto update'))).toBe(true);
    hass.states[auto] = { ...hass.states[auto], state: 'off' };
    expect((await titles()).some((t) => t.includes('update checks'))).toBe(true);
    delete hass.entities[entityOf(hass, 'activity_logging')];
    expect(await titles()).toHaveLength(3);
  });
});

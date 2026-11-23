// @vitest-environment jsdom
/** Environments whose names repeat across Dockhands: every card names
 * each one's Dockhand, and only those. */
import { describe, it, expect } from 'vitest';
import './render.dom.test-elements';
import { DockhandDashboardStrategy } from './dockhand-strategy/strategy';
import type { HomeAssistant } from './common/ha-types';
import { harnessHass, mount, type Lit } from './common/mount.test-helpers';

/** The harness's one Dockhand, plus a second whose environment is also
 * called Aurora (case aside): env_1 (Nebula) moves to it, renamed. */
function twoDockhands(): HomeAssistant {
  const hass = harnessHass();
  hass.devices.env_1 = { ...hass.devices.env_1, name: 'aurora', name_by_user: null, configuration_url: 'http://dockhand2.local:3000/settings' };
  return hass;
}

const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
const pills = (el: Lit, selector: string): string[] => [...el.shadowRoot!.querySelectorAll(selector)].map((n) => clean(n.textContent));
/** Each match's own text, then its host pill's, if any: "name | host". */
const named = (el: Lit, selector: string): string[] =>
  [...el.shadowRoot!.querySelectorAll(selector)].map((n) => {
    const pill = n.querySelector('.instance-label');
    const own = n.cloneNode(true) as Element;
    own.querySelector('.instance-label')?.remove();
    return pill ? `${clean(own.textContent)} | ${clean(pill.textContent)}` : clean(own.textContent);
  });

describe('Repeated environment names', () => {
  it('pill the host in group headings and rows, only for the repeated name', async () => {
    const hass = twoDockhands();
    for (const tag of ['dockhand-containers-card', 'dockhand-stacks-card']) {
      const el = await mount(tag, { type: `custom:${tag}`, group_by: 'environment', visible_badges: ['environment'] }, hass);
      expect(named(el, '.group-header')).toEqual(['aurora | dockhand2.local:3000', 'Aurora | dockhand.local:3000', 'Orion', 'Vega']);
      const hosts = new Set(pills(el, '.row .instance-label'));
      expect(hosts).toEqual(new Set(['dockhand2.local:3000', 'dockhand.local:3000']));
    }
    const schedules = await mount('dockhand-schedules-card', { type: 'custom:dockhand-schedules-card', group_by: 'environment' }, hass);
    expect(named(schedules, '.group-header').filter((h) => /aurora/i.test(h))).toEqual(['aurora (3) | dockhand2.local:3000', 'Aurora (3) | dockhand.local:3000']);
  });

  it('pill the host in the Environment card’s title, and say it in pickers and tab titles', async () => {
    const hass = twoDockhands();
    const card = await mount('dockhand-environment-card', { type: 'custom:dockhand-environment-card', device_id: 'env_2' }, hass);
    expect(pills(card, '.env-name')).toEqual(['Aurora']);
    expect(pills(card, '.env-sub-line .instance-label')).toEqual(['dockhand.local:3000']);
    const vega = await mount('dockhand-environment-card', { type: 'custom:dockhand-environment-card', device_id: 'env_4' }, hass);
    expect(vega.shadowRoot!.querySelector('.instance-label')).toBeNull();

    const { views } = (await DockhandDashboardStrategy.generate({ type: 'custom:dockhand' }, hass)) as { views: { title: string }[] };
    expect(views.map((v) => v.title)).toEqual(expect.arrayContaining(['aurora (dockhand2.local:3000)', 'Aurora (dockhand.local:3000)', 'Vega', 'aurora (dockhand2.local:3000) — Stacks']));
  });

  it('show nothing extra with one Dockhand', async () => {
    const el = await mount('dockhand-containers-card', { type: 'custom:dockhand-containers-card', group_by: 'environment', visible_badges: ['environment'] }, harnessHass());
    expect(el.shadowRoot!.querySelector('.instance-label')).toBeNull();
  });
});

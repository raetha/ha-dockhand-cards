// @vitest-environment jsdom
/** The Environment card reads its counts and sizes from ha-dockhand 2.0's
 * own sensors, not attributes. */
import { describe, it, expect } from 'vitest';
import '../render.dom.test-elements';
import type { HomeAssistant } from '../common/ha-types';
import { disableEntities, settle } from '../common/test-fixtures';
import { harnessHass, mount, type Lit } from '../common/mount.test-helpers';

const entityOf = (hass: HomeAssistant, key: string): string => Object.values(hass.entities).find((e) => e.device_id === 'env_1' && e.translation_key === key)!.entity_id;
const set = (hass: HomeAssistant, key: string, state: string) => {
  const id = entityOf(hass, key);
  hass.states[id] = { ...hass.states[id], state };
};
const texts = (el: Lit, selector: string): string[] => [...el.shadowRoot!.querySelectorAll(selector)].map((n) => n.textContent!.replace(/\s+/g, ' ').trim());

describe('Environment card counts', () => {
  it('shows each state’s and kind’s count from its sensor', async () => {
    const hass = harnessHass();
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
    const el = await mount('dockhand-environment-card', { device_id: 'env_1',  mode: 'standard' }, hass);
    expect(texts(el, '.stats-row .stat').slice(0, 6)).toEqual(['9', '4', '2', '1', '0', '6']);
    const updates = el.shadowRoot!.querySelectorAll<HTMLElement>('.stats-row .stat')[5];
    expect(updates.getAttribute('title')).toBe('Pending updates — Installable: 3, System: 1, New version tags: 2');
    expect(texts(el, '.breakdown').find((t) => t.includes('/'))).toMatch(/5\/2\/1$/);
  });

  it('counts a sensor that is unavailable as 0', async () => {
    const hass = harnessHass();
    set(hass, 'containers_running', 'unavailable');
    const el = await mount('dockhand-environment-card', { device_id: 'env_1',  mode: 'compact' }, hass);
    expect(texts(el, '.stats-row .stat')[0]).toBe('0');
  });

  it('names the sensors a mode needs that are turned off, in the editor', async () => {
    const hass = harnessHass();
    disableEntities(
      hass,
      ['disk_usage_images', 'activity_events_today'].map((key) => entityOf(hass, key))
    );
    const el = await mount('dockhand-environment-card-editor', { device_id: 'env_1', mode: 'full' }, hass);
    await settle(el);
    const forms = [...el.shadowRoot!.querySelectorAll('ha-form')] as (HTMLElement & { warning?: Record<string, string> })[];
    const warning = forms.map((f) => f.warning?.mode).find(Boolean)!;
    expect(warning).toContain('Activity events today');
    expect(warning).toContain('Images disk usage');
  });
});

describe('Environment card links', () => {
  it('opens each count’s own sensor, and the total the Containers sensor', async () => {
    const hass = harnessHass();
    set(hass, 'containers_unhealthy', '2');
    const el = await mount('dockhand-environment-card', { device_id: 'env_1',  mode: 'compact' }, hass);
    const opened: string[] = [];
    el.addEventListener('hass-more-info', (ev) => opened.push((ev as CustomEvent).detail.entityId));
    const stats = el.shadowRoot!.querySelectorAll<HTMLElement>('.stats-row .stat');
    stats[0].click();
    stats[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    stats[6].click();
    el.shadowRoot!.querySelector<HTMLElement>('.status-banner')!.click();
    expect(opened).toEqual([
      entityOf(hass, 'containers_running'),
      entityOf(hass, 'pending_updates'),
      entityOf(hass, 'containers'),
      entityOf(hass, 'containers_unhealthy')
    ]);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { DockhandUpdatesCard } from './card';
import { makeDevice, makeEntity, makeHass, makeState } from '../common/test-fixtures';
import type { HomeAssistant } from '../common/ha-types';

type UpdatesCardElement = HTMLElement & {
  hass: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
};

/** A hass whose callService stays pending until the test resolves it, so
 * the card can be inspected mid-request. */
type NodeProcess = { on(event: string, listener: (...args: unknown[]) => void): void; off(event: string, listener: (...args: unknown[]) => void): void };
const nodeProcess = (globalThis as unknown as { process: NodeProcess }).process;

/** An environment with one container whose update can be installed
 * (supported_features 1 = Install) and one whose can't. */
function setup() {
  const env = makeDevice({ id: 'env-device', identifiers: [['dockhand', 'entry_env_1']], config_entry_id: 'entry', name: 'Nebula' });
  const container = (name: string) => makeDevice({ id: `dev-${name}`, identifiers: [['dockhand', `entry_container_1_${name}`]], config_entry_id: 'entry', name });
  const hass = makeHass({
    devices: [env, container('web'), container('hawser')],
    entities: [
      makeEntity({ entity_id: 'button.nebula_check_updates', device_id: 'env-device', translation_key: 'check_updates' }),
      makeEntity({ entity_id: 'update.web', device_id: 'dev-web' }),
      makeEntity({ entity_id: 'update.hawser', device_id: 'dev-hawser' })
    ],
    states: [
      makeState({ entity_id: 'button.nebula_check_updates', state: 'unknown' }),
      makeState({ entity_id: 'update.web', state: 'on', attributes: { installed_version: 'a', latest_version: 'b', supported_features: 1 } }),
      makeState({ entity_id: 'update.hawser', state: 'on', attributes: { installed_version: 'a', latest_version: 'b', supported_features: 0 } })
    ]
  });
  const pending: (() => void)[] = [];
  const callService = vi.fn(() => new Promise<void>((resolve) => pending.push(resolve)));
  (hass as unknown as { callService: typeof callService }).callService = callService;
  return { hass, callService, finish: () => pending.splice(0).forEach((resolve) => resolve()) };
}

const TAG = 'dockhand-updates-card-under-test';
if (!customElements.get(TAG)) customElements.define(TAG, DockhandUpdatesCard);

async function mount(hass: HomeAssistant): Promise<UpdatesCardElement> {
  const card = document.createElement(TAG) as UpdatesCardElement;
  card.setConfig({ type: 'custom:dockhand-updates-card' });
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

function headerButton(card: UpdatesCardElement, title: RegExp): HTMLElement {
  const buttons = [...card.shadowRoot!.querySelectorAll<HTMLElement>('.header-right .header-icon')];
  const match = buttons.find((b) => title.test(b.getAttribute('title') ?? ''));
  if (!match) throw new Error(`no header button titled ${title}`);
  return match;
}

describe.each([
  { label: 'Check for updates', idle: /^Check for updates$/, busy: /^Checking…$/, call: ['button', 'press', {}, { entity_id: ['button.nebula_check_updates'] }] },
  // Only what Home Assistant can install: the system container is left out.
  { label: 'Update all', idle: /^Install every update listed \(1\)$/, busy: /^Updating…$/, call: ['update', 'install', {}, { entity_id: ['update.web'] }] }
])('Updates card "$label" button while its request is in flight', ({ idle, busy, call }) => {
  it('shows a spinner and is disabled, then returns to normal once the request settles', async () => {
    const { hass, callService, finish } = setup();
    const card = await mount(hass);

    const button = headerButton(card, idle);
    expect(button.className).toContain('clickable');
    expect(button.getAttribute('tabindex')).toBe('0');
    expect(button.querySelector('.spinner')).toBeNull();

    button.click();
    await card.updateComplete;

    const busyButton = headerButton(card, busy);
    expect(callService).toHaveBeenCalledWith(...call);
    expect(busyButton.className).toContain('link-unavailable');
    expect(busyButton.className).not.toContain('clickable');
    expect(busyButton.getAttribute('tabindex')).toBeNull();
    expect(busyButton.getAttribute('aria-busy')).toBe('true');
    expect(busyButton.querySelector('.spinner')).not.toBeNull();

    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await card.updateComplete;

    const restored = headerButton(card, idle);
    expect(restored.className).toContain('clickable');
    expect(restored.getAttribute('tabindex')).toBe('0');
    expect(restored.querySelector('.spinner')).toBeNull();
    card.remove();
  });

  it('ignores a second click while the first request is still running', async () => {
    const { hass, callService, finish } = setup();
    const card = await mount(hass);

    headerButton(card, idle).click();
    await card.updateComplete;
    headerButton(card, busy).click();
    await card.updateComplete;

    expect(callService).toHaveBeenCalledTimes(1);
    finish();
    card.remove();
  });

  it('returns to normal without an unhandled rejection when the request fails', async () => {
    const { hass } = setup();
    (hass as unknown as { callService: () => Promise<never> }).callService = () => Promise.reject(new Error('action_failed'));
    const card = await mount(hass);
    const unhandled = vi.fn();
    nodeProcess.on('unhandledRejection', unhandled);

    headerButton(card, idle).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await card.updateComplete;

    expect(headerButton(card, idle).getAttribute('tabindex')).toBe('0');
    expect(unhandled).not.toHaveBeenCalled();
    nodeProcess.off('unhandledRejection', unhandled);
    card.remove();
  });
});

describe('Updates card version-tag pill', () => {
  function hassWithUpdates(rows: { name: string; installed: string; latest: string; newer?: string; state?: string; extra?: Record<string, unknown> }[]) {
    const env = makeDevice({ id: 'env-device', identifiers: [['dockhand', 'entry_env_1']], config_entry_id: 'entry', name: 'Nebula' });
    const devices = [env];
    const entities = [];
    const states = [];
    for (const r of rows) {
      devices.push(makeDevice({ id: `dev-${r.name}`, identifiers: [['dockhand', `entry_container_1_${r.name}`]], config_entry_id: 'entry', name: r.name }));
      entities.push(makeEntity({ entity_id: `update.${r.name}`, device_id: `dev-${r.name}` }));
      states.push(
        makeState({
          entity_id: `update.${r.name}`,
          state: r.state ?? 'on',
          attributes: { installed_version: r.installed, latest_version: r.latest, ...(r.newer ? { newer_version: r.newer } : {}), ...r.extra }
        })
      );
    }
    return makeHass({ devices, entities, states });
  }

  function row(card: UpdatesCardElement, name: string): HTMLElement {
    const match = [...card.shadowRoot!.querySelectorAll<HTMLElement>('.update-row')].find((r) => r.querySelector('.item-name')?.textContent === name);
    if (!match) throw new Error(`no row for ${name}`);
    return match;
  }

  it('puts the pill before the version text when an installable update and a newer tag are both pending', async () => {
    const card = await mount(hassWithUpdates([{ name: 'nextcloud', installed: '34.0.2', latest: 'update-pending', newer: '35.0.1' }]));
    const right = row(card, 'nextcloud').querySelector('.row-right')!;
    const pill = right.querySelector('.version-tag-pill')!;
    expect(right.firstElementChild).toBe(pill);
    expect(pill.textContent?.trim()).toBe('35.0.1');
    expect(pill.querySelector('ha-icon')?.getAttribute('icon')).toBe('mdi:tag-outline');
    expect(right.textContent).toContain('Update available');
    const icon = row(card, 'nextcloud').querySelector('.update-icon')!;
    expect(icon.getAttribute('icon')).toBe('mdi:arrow-up-circle');
    expect(icon.classList.contains('tag')).toBe(false);
    card.remove();
  });

  it('shows no pill, just the tag icon and the version text, when the newer tag is the only update', async () => {
    const card = await mount(hassWithUpdates([{ name: 'postgres', installed: '16.3', latest: '17.0', newer: '17.0' }]));
    const r = row(card, 'postgres');
    expect(r.querySelector('.version-tag-pill')).toBeNull();
    expect(r.querySelector('.row-right')!.textContent?.trim()).toBe('16.3 → 17.0');
    const icon = r.querySelector('.update-icon')!;
    expect(icon.getAttribute('icon')).toBe('mdi:tag-arrow-up-outline');
    expect(icon.classList.contains('tag')).toBe(true);
    card.remove();
  });

  it('marks a moved digest on a pinned image with the pin, in the update color, and says why', async () => {
    const card = await mount(hassWithUpdates([{ name: 'db', installed: 'postgres:17@sha256:aaa', latest: 'update-pending', extra: { pinned_digest_moved: true } }]));
    const r = row(card, 'db');
    const icon = r.querySelector('.update-icon')!;
    expect(icon.getAttribute('icon')).toBe('mdi:pin-outline');
    expect(icon.classList.contains('pinned')).toBe(true);
    expect(r.querySelector('.row-right')!.textContent?.trim()).toBe('Pinned to a digest');
    expect(icon.getAttribute('title')).toContain('Update the digest in the compose file');
    card.remove();
  });

  it('lists an update held by the minimum image age with the hours left, in grey', async () => {
    const card = await mount(hassWithUpdates([{ name: 'cache', installed: 'redis:8', latest: 'update-pending', extra: { update_held_hours: 12 } }]));
    const r = row(card, 'cache');
    const icon = r.querySelector('.update-icon')!;
    expect(icon.getAttribute('icon')).toBe('mdi:clock-outline');
    expect(icon.classList.contains('held')).toBe(true);
    expect(r.querySelector('.row-right')!.textContent?.trim()).toBe('12 h left');
    expect(icon.getAttribute('title')).toBe('Update held: 12 h left of the minimum image age');
    expect(card.shadowRoot!.textContent).not.toContain('Everything up to date');
    card.remove();
  });

  it('says when a held update will be offered once the wait is over', async () => {
    const card = await mount(hassWithUpdates([{ name: 'cache', installed: 'redis:8', latest: 'update-pending', extra: { update_held_hours: 0 } }]));
    expect(row(card, 'cache').querySelector('.row-right')!.textContent?.trim()).toBe('At next check');
    card.remove();
  });

  it('leaves out a container whose update entity is off', async () => {
    const card = await mount(hassWithUpdates([{ name: 'idle', installed: 'x', latest: 'x', state: 'off' }]));
    expect(card.shadowRoot!.querySelector('.update-row')).toBeNull();
    card.remove();
  });

  it('renders rows without newer_version exactly as before (older ha-dockhand)', async () => {
    const card = await mount(hassWithUpdates([{ name: 'web', installed: 'a3f29e1', latest: 'b82d4f0' }]));
    const r = row(card, 'web');
    expect(r.querySelector('.version-tag-pill')).toBeNull();
    expect(r.querySelector('.row-right')!.textContent?.trim()).toBe('a3f29e1 → b82d4f0');
    expect(r.querySelector('.update-icon')!.getAttribute('icon')).toBe('mdi:arrow-up-circle');
    card.remove();
  });
});

describe('Updates card Update all', () => {
  it('stays, disabled and saying why, when nothing listed can be installed', async () => {
    const { hass } = setup();
    hass.states['update.web'] = makeState({ entity_id: 'update.web', state: 'on', attributes: { installed_version: 'a', latest_version: 'b', supported_features: 0 } });
    const card = await mount(hass);
    const button = headerButton(card, /^Nothing listed can be installed/);
    expect(button.textContent).toContain('Update all');
    expect(button.getAttribute('tabindex')).toBeNull();
    card.remove();
  });

  it('installs only the listed updates when filters hide some, and says so', async () => {
    const { hass, callService, finish } = setup();
    // hawser can be installed too, but sits in a stack the filter leaves out.
    const stack = makeDevice({ id: 'dev-stack', identifiers: [['dockhand', 'entry_stack_1_core']], config_entry_id: 'entry', name: 'core' });
    hass.devices['dev-stack'] = stack;
    hass.devices['dev-hawser'] = { ...hass.devices['dev-hawser'], via_device_id: 'dev-stack' };
    hass.states['update.hawser'] = makeState({ entity_id: 'update.hawser', state: 'on', attributes: { installed_version: 'a', latest_version: 'b', supported_features: 1 } });
    const card = document.createElement(TAG) as UpdatesCardElement;
    card.setConfig({ type: 'custom:dockhand-updates-card', filters: { stack: ['(none)'] } });
    card.hass = hass;
    document.body.appendChild(card);
    await card.updateComplete;
    const button = headerButton(card, /^Install the listed updates only \(1\)/);
    expect(button.textContent).toContain('Update listed');
    button.click();
    expect(callService).toHaveBeenCalledWith('update', 'install', {}, { entity_id: ['update.web'] });
    finish();
    card.remove();
  });

  it('is absent when nothing is pending', async () => {
    const { hass } = setup();
    for (const id of ['update.web', 'update.hawser']) hass.states[id] = makeState({ entity_id: id, state: 'off', attributes: { installed_version: 'a', latest_version: 'a' } });
    const card = await mount(hass);
    expect(card.shadowRoot!.querySelector('.header-icon.filled')).toBeNull();
    expect(card.shadowRoot!.querySelector('.card-message')?.textContent).toContain('up to date');
    card.remove();
  });
});

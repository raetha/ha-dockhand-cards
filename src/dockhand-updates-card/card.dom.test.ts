// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { DockhandUpdatesCard } from './card';
import { makeDevice, makeEntity, makeHass, makeState } from '../common/test-fixtures';
import type { HomeAssistant } from '../common/ha-types';
import { mount as mountTag, type Lit } from '../common/mount.test-helpers';

type UpdatesCardElement = Lit;

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

const mount = (hass: HomeAssistant) => mountTag<UpdatesCardElement>(TAG, { type: 'custom:dockhand-updates-card' }, hass);

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
  });
});

describe('Updates card newer version tag', () => {
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

  function cells(r: HTMLElement): HTMLElement[] {
    return [...r.querySelectorAll<HTMLElement>(':scope > .cell')];
  }

  /** The version text, the row's last column. */
  function versionText(r: HTMLElement): string | undefined {
    const all = cells(r);
    return all[all.length - 1]?.textContent?.trim();
  }

  it('puts a tag pill ahead of the version text, in its column, when an installable update and a newer tag are both pending', async () => {
    const card = await mount(hassWithUpdates([{ name: 'nextcloud', installed: '34.0.2', latest: 'update-pending', newer: '35.0.1' }]));
    const all = cells(row(card, 'nextcloud'));
    expect(all).toHaveLength(1);
    const pill = all[0].firstElementChild!;
    expect(pill.classList.contains('version-tag-pill')).toBe(true);
    expect(pill.textContent?.trim()).toBe('35.0.1');
    expect(pill.getAttribute('title')).toContain('35.0.1');
    expect(all[0].querySelector('.version-text')!.textContent?.trim()).toBe('Update available');
    const icon = row(card, 'nextcloud').querySelector('.update-icon')!;
    expect(icon.getAttribute('icon')).toBe('mdi:arrow-up-circle');
    expect(icon.classList.contains('tag')).toBe(false);
  });

  it('shows the tag as the row icon when the newer tag is the only update', async () => {
    const card = await mount(
      hassWithUpdates([
        { name: 'postgres', installed: '16.3', latest: '17.0', newer: '17.0' },
        { name: 'nextcloud', installed: '34.0.2', latest: 'update-pending', newer: '35.0.1' }
      ])
    );
    const r = row(card, 'postgres');
    expect(cells(r).map((c) => c.textContent?.trim())).toEqual(['16.3 → 17.0']);
    expect(r.querySelector('.version-tag-pill')).toBeNull();
    expect(r.querySelector('.version-text')!.getAttribute('title')).toBe('16.3 → 17.0');
    const icon = r.querySelector('.update-icon')!;
    expect(icon.getAttribute('icon')).toBe('mdi:tag-arrow-up-outline');
    expect(icon.classList.contains('tag')).toBe(true);
  });

  it('marks a moved digest on a pinned image with the pin, in the update color, and says why', async () => {
    const card = await mount(hassWithUpdates([{ name: 'db', installed: 'postgres:17@sha256:aaa', latest: 'update-pending', extra: { pinned_digest_moved: true } }]));
    const r = row(card, 'db');
    const icon = r.querySelector('.update-icon')!;
    expect(icon.getAttribute('icon')).toBe('mdi:pin-outline');
    expect(icon.classList.contains('pinned')).toBe(true);
    expect(versionText(r)).toBe('Pinned to a digest');
    expect(icon.getAttribute('title')).toContain('Update the digest in the compose file');
  });

  it('lists an update held by the minimum image age with the hours left, in grey', async () => {
    const card = await mount(hassWithUpdates([{ name: 'cache', installed: 'redis:8', latest: 'update-pending', extra: { update_held_hours: 12 } }]));
    const r = row(card, 'cache');
    const icon = r.querySelector('.update-icon')!;
    expect(icon.getAttribute('icon')).toBe('mdi:clock-outline');
    expect(icon.classList.contains('held')).toBe(true);
    expect(versionText(r)).toBe('12 h left');
    expect(icon.getAttribute('title')).toBe('Update held: 12 h left of the minimum image age');
    expect(card.shadowRoot!.textContent).not.toContain('Everything up to date');
  });

  it('says when a held update will be offered once the wait is over', async () => {
    const card = await mount(hassWithUpdates([{ name: 'cache', installed: 'redis:8', latest: 'update-pending', extra: { update_held_hours: 0 } }]));
    expect(versionText(row(card, 'cache'))).toBe('At next check');
  });

  it('leaves out a container whose update entity is off', async () => {
    const card = await mount(hassWithUpdates([{ name: 'idle', installed: 'x', latest: 'x', state: 'off' }]));
    expect(card.shadowRoot!.querySelector('.update-row')).toBeNull();
  });

  it('renders rows without newer_version exactly as before (older ha-dockhand)', async () => {
    const card = await mount(hassWithUpdates([{ name: 'web', installed: 'a3f29e1', latest: 'b82d4f0' }]));
    const r = row(card, 'web');
    expect(cells(r).map((c) => c.textContent?.trim())).toEqual(['a3f29e1 → b82d4f0']);
    expect(r.querySelector('.update-icon')!.getAttribute('icon')).toBe('mdi:arrow-up-circle');
  });

  it('cuts the old version, then the new, rather than the name, with both whole in the tooltip', async () => {
    const card = await mount(hassWithUpdates([{ name: 'web', installed: '16.4-bookworm-20260101', latest: '17.6-bookworm-20261101' }]));
    const version = row(card, 'web').querySelector<HTMLElement>('.cell.version')!;
    expect(version.querySelector('.version-old')!.textContent).toBe('16.4-bookworm-20260101');
    expect(version.querySelector('.version-new')!.textContent).toBe('17.6-bookworm-20261101');
    expect(version.querySelector('.version-text')!.getAttribute('title')).toBe('16.4-bookworm-20260101 → 17.6-bookworm-20261101');
    expect(version.classList.contains('end')).toBe(true);
    // Never more than most of the row.
    expect(card.shadowRoot!.querySelector<HTMLElement>('.list.aligned')!.style.gridTemplateColumns).toContain('fit-content(60%)');
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
  });

  it('is absent when nothing is pending', async () => {
    const { hass } = setup();
    for (const id of ['update.web', 'update.hawser']) hass.states[id] = makeState({ entity_id: id, state: 'off', attributes: { installed_version: 'a', latest_version: 'a' } });
    const card = await mount(hass);
    expect(card.shadowRoot!.querySelector('.header-icon.filled')).toBeNull();
    expect(card.shadowRoot!.querySelector('.card-message')?.textContent).toContain('up to date');
  });
});

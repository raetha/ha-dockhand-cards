// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { DockhandContainersCard } from '../dockhand-containers-card/card';
import { DockhandStacksCard } from '../dockhand-stacks-card/card';
import { DockhandSchedulesCard } from '../dockhand-schedules-card/card';
import { makeDevice, makeEntity, makeHass, makeState } from './test-fixtures';
import type { HomeAssistant } from './ha-types';

type CardElement = HTMLElement & {
  hass: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
};

const TAGS = {
  containers: 'row-controls-containers-card',
  stacks: 'row-controls-stacks-card',
  schedules: 'row-controls-schedules-card'
} as const;
if (!customElements.get(TAGS.containers)) customElements.define(TAGS.containers, DockhandContainersCard);
if (!customElements.get(TAGS.stacks)) customElements.define(TAGS.stacks, DockhandStacksCard);
if (!customElements.get(TAGS.schedules)) customElements.define(TAGS.schedules, DockhandSchedulesCard);

const env = makeDevice({ id: 'env-device', identifiers: [['dockhand', 'entry_env_1']], config_entry_id: 'entry', name: 'Nebula' });

/** A container or stack device with its status sensor and, unless it's a
 * system one, its running switch and restart button. */
function hassWithDevice(kind: 'container' | 'stack', running: boolean, opts: { system?: boolean } = {}): HomeAssistant {
  const device = makeDevice({ id: 'dev-web', identifiers: [['dockhand', `entry_${kind}_1_web`]], config_entry_id: 'entry', name: 'web' });
  const statusKey = kind === 'container' ? 'state' : 'status';
  const entities = [makeEntity({ entity_id: `sensor.web_${statusKey}`, device_id: 'dev-web', translation_key: statusKey })];
  const states = [makeState({ entity_id: `sensor.web_${statusKey}`, state: running ? 'running' : 'exited', attributes: {} })];
  if (!opts.system) {
    entities.push(makeEntity({ entity_id: 'switch.web', device_id: 'dev-web' }), makeEntity({ entity_id: 'button.web_restart', device_id: 'dev-web', translation_key: 'restart' }));
    states.push(makeState({ entity_id: 'switch.web', state: running ? 'on' : 'off' }), makeState({ entity_id: 'button.web_restart', state: 'unknown' }));
  }
  return makeHass({ devices: [env, device], entities, states });
}

async function mount(tag: string, type: string, hass: HomeAssistant, config: Record<string, unknown> = {}): Promise<CardElement> {
  const card = document.createElement(tag) as CardElement;
  card.setConfig({ type: `custom:${type}`, ...config });
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

function controlTitles(card: CardElement): string[] {
  return [...card.shadowRoot!.querySelectorAll('.row-control')].map((e) => e.getAttribute('title') ?? '');
}

function actions(card: CardElement): ReturnType<typeof vi.fn> {
  const listener = vi.fn();
  card.addEventListener('hass-action', (e) => listener((e as CustomEvent).detail.config.tap_action));
  return listener;
}

describe.each([
  { kind: 'container' as const, tag: TAGS.containers, type: 'dockhand-containers-card' },
  { kind: 'stack' as const, tag: TAGS.stacks, type: 'dockhand-stacks-card' }
])('$type row controls', ({ kind, tag, type }) => {
  it('are hidden unless show_controls is set, with no actions column', async () => {
    const card = await mount(tag, type, hassWithDevice(kind, true));
    expect(controlTitles(card)).toEqual([]);
    expect(card.shadowRoot!.querySelector('.row-actions')).toBeNull();
    card.remove();
  });

  it('sit in their own column with a fixed slot each, so they line up', async () => {
    for (const running of [true, false]) {
      const card = await mount(tag, type, hassWithDevice(kind, running), { show_controls: true });
      const column = card.shadowRoot!.querySelector('.row .row-actions')!;
      expect(column.previousElementSibling?.classList.contains('row-right')).toBe(true);
      expect(column.children.length).toBe(2);
      card.remove();
    }
  });

  it('offer restart and stop while running, in Dockhand’s order, each asking first, without opening more-info', async () => {
    const card = await mount(tag, type, hassWithDevice(kind, true), { show_controls: true });
    expect(controlTitles(card)).toEqual(['Restart', 'Stop']);
    const fired = actions(card);
    const moreInfo = vi.fn();
    card.addEventListener('hass-more-info', moreInfo);
    for (const control of card.shadowRoot!.querySelectorAll<HTMLElement>('.row-control')) control.click();
    expect(fired.mock.calls.map(([a]) => [a.perform_action, a.target.entity_id, a.confirmation?.text])).toEqual([
      ['button.press', 'button.web_restart', 'Restart web?'],
      ['switch.turn_off', 'switch.web', 'Stop web?']
    ]);
    expect(moreInfo).not.toHaveBeenCalled();
    card.remove();
  });

  it('offer start while stopped, without asking, and restart too for a container, as Dockhand does', async () => {
    const card = await mount(tag, type, hassWithDevice(kind, false), { show_controls: true });
    expect(controlTitles(card)).toEqual(kind === 'container' ? ['Start', 'Restart'] : ['Start']);
    const fired = actions(card);
    card.shadowRoot!.querySelector<HTMLElement>('.row-control')!.click();
    expect(fired.mock.calls[0][0]).toMatchObject({ perform_action: 'switch.turn_on', target: { entity_id: 'switch.web' } });
    expect(fired.mock.calls[0][0].confirmation).toBeUndefined();
    card.remove();
  });

  it('are absent for a system one, which has no running switch', async () => {
    const card = await mount(tag, type, hassWithDevice(kind, true, { system: true }), { show_controls: true });
    expect(controlTitles(card)).toEqual([]);
    // The column is still there, empty, so the row's values stay aligned.
    expect(card.shadowRoot!.querySelector('.row-actions')!.children.length).toBe(0);
    card.remove();
  });
});

describe('row controls beyond start, restart and stop', () => {
  function hassWith(kind: 'container' | 'stack', state: 'running' | 'paused', extra: 'pause' | 'deploy'): HomeAssistant {
    const hass = hassWithDevice(kind, state === 'running');
    const statusKey = kind === 'container' ? 'state' : 'status';
    hass.states[`sensor.web_${statusKey}`] = makeState({ entity_id: `sensor.web_${statusKey}`, state, attributes: {} });
    const id = extra === 'pause' ? 'button.web_pause' : 'button.web_redeploy';
    hass.entities[id] = makeEntity({ entity_id: id, device_id: 'dev-web', translation_key: extra === 'pause' ? 'pause' : 'stack_deploy' });
    hass.states[id] = makeState({ entity_id: id, state: state === 'running' || extra === 'deploy' ? 'unknown' : 'unavailable' });
    return hass;
  }

  it('puts a stack’s deploy first, in a third slot every row gets', async () => {
    const card = await mount(TAGS.stacks, 'dockhand-stacks-card', hassWith('stack', 'running', 'deploy'), { show_controls: true });
    expect(controlTitles(card)).toEqual(['Redeploy', 'Restart', 'Stop']);
    expect(card.shadowRoot!.querySelector('.row-actions')!.children.length).toBe(3);
    expect(card.shadowRoot!.querySelector<HTMLElement>('ha-card')!.style.getPropertyValue('--row-control-slots')).toBe('3');
    card.remove();
  });

  it('offers Pause between Restart and Stop while a container runs, without asking', async () => {
    const card = await mount(TAGS.containers, 'dockhand-containers-card', hassWith('container', 'running', 'pause'), { show_controls: true });
    expect(controlTitles(card)).toEqual(['Restart', 'Pause', 'Stop']);
    const fired = actions(card);
    card.shadowRoot!.querySelectorAll<HTMLElement>('.row-control')[1].click();
    expect(fired.mock.calls[0][0]).toMatchObject({ perform_action: 'button.press', target: { entity_id: 'button.web_pause' } });
    expect(fired.mock.calls[0][0].confirmation).toBeUndefined();
    card.remove();
  });

  it('offers Resume for a paused container, as Dockhand does', async () => {
    const card = await mount(TAGS.containers, 'dockhand-containers-card', hassWith('container', 'paused', 'pause'), { show_controls: true });
    expect(controlTitles(card)).toEqual(['Resume', 'Restart']);
    card.remove();
  });
});

function hassWithSchedule(opts: { run?: string; enabled?: string }): HomeAssistant {
  const group = makeDevice({ id: 'sched-group', identifiers: [['dockhand', 'entry_env_1_Schedules']], config_entry_id: 'entry', name: 'Nebula – Schedules' });
  const schedule = makeDevice({ id: 'sched', identifiers: [['dockhand', 'entry_schedule_7_image_prune']], config_entry_id: 'entry', name: 'Prune', via_device_id: 'sched-group' });
  const entities = [makeEntity({ entity_id: 'sensor.prune_last_status', device_id: 'sched', translation_key: 'last_status' })];
  const states = [makeState({ entity_id: 'sensor.prune_last_status', state: 'success', attributes: { enabled: opts.enabled !== 'off' } })];
  if (opts.run) {
    entities.push(makeEntity({ entity_id: 'button.prune_run', device_id: 'sched', translation_key: 'schedule_run' }));
    states.push(makeState({ entity_id: 'button.prune_run', state: opts.run }));
  }
  if (opts.enabled) {
    entities.push(makeEntity({ entity_id: 'switch.prune_enabled', device_id: 'sched', translation_key: 'schedule_enabled' }));
    states.push(makeState({ entity_id: 'switch.prune_enabled', state: opts.enabled }));
  }
  return makeHass({ devices: [env, group, schedule], entities, states });
}

describe('Schedules card row controls', () => {
  const mountSchedules = (hass: HomeAssistant, config: Record<string, unknown> = {}) => mount(TAGS.schedules, 'dockhand-schedules-card', hass, config);

  it('are hidden unless show_controls is set', async () => {
    const card = await mountSchedules(hassWithSchedule({ run: 'unknown', enabled: 'on' }));
    expect(controlTitles(card)).toEqual([]);
    card.remove();
  });

  it('offer Run now (asking first) and disable for an enabled schedule', async () => {
    const card = await mountSchedules(hassWithSchedule({ run: 'unknown', enabled: 'on' }), { show_controls: true });
    expect(controlTitles(card)).toEqual(['Disable schedule', 'Run now']);
    const fired = actions(card);
    for (const control of card.shadowRoot!.querySelectorAll<HTMLElement>('.row-control')) control.click();
    expect(fired.mock.calls.map(([a]) => [a.perform_action, a.target.entity_id, a.confirmation?.text])).toEqual([
      ['switch.turn_off', 'switch.prune_enabled', undefined],
      ['button.press', 'button.prune_run', 'Run Prune now?']
    ]);
    card.remove();
  });

  it('offer enable for a disabled schedule', async () => {
    const card = await mountSchedules(hassWithSchedule({ enabled: 'off' }), { show_controls: true });
    expect(controlTitles(card)).toEqual(['Enable schedule']);
    card.remove();
  });

  it('leave out unavailable or missing entities, and the row stays a single keyboard target', async () => {
    const card = await mountSchedules(hassWithSchedule({ run: 'unavailable' }), { show_controls: true });
    expect(controlTitles(card)).toEqual([]);
    const row = card.shadowRoot!.querySelector('.row.clickable')!;
    expect(row.getAttribute('role')).toBeNull();
    expect(row.querySelector('.row-target')?.getAttribute('role')).toBe('button');
    card.remove();
  });
});

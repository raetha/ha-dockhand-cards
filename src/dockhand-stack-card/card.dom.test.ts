// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { DockhandStackCard } from './card';
import { makeDevice, makeEntity, makeHass, makeState } from '../common/test-fixtures';
import type { HomeAssistant } from '../common/ha-types';

type StackCardElement = HTMLElement & {
  hass: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
};

const TAG = 'dockhand-stack-card-under-test';
if (!customElements.get(TAG)) customElements.define(TAG, DockhandStackCard);

const STATS: [string, string, Record<string, unknown>][] = [
  ['stack_cpu_percent', '3.75', { unit_of_measurement: '%' }],
  ['stack_memory_usage', '400', { unit_of_measurement: 'MiB' }],
  ['stack_memory_limit', '4000', { unit_of_measurement: 'MiB' }],
  ['stack_network_rx', '11', { unit_of_measurement: 'MiB' }],
  ['stack_network_tx', '22', { unit_of_measurement: 'MiB' }],
  ['stack_block_read', '33', { unit_of_measurement: 'MiB' }],
  ['stack_block_write', '44', { unit_of_measurement: 'MiB' }]
];

function hassWithStack(withStats: boolean) {
  const stack = makeDevice({ id: 'stack-dev', identifiers: [['dockhand', 'entry_stack_1_core']], config_entry_id: 'entry', name: 'core', model: 'Internal Stack' });
  const entities = [makeEntity({ entity_id: 'sensor.core_status', device_id: 'stack-dev', translation_key: 'status' })];
  const states = [makeState({ entity_id: 'sensor.core_status', state: 'running', attributes: { type: 'internal' } })];
  if (withStats) {
    for (const [key, value, attributes] of STATS) {
      entities.push(makeEntity({ entity_id: `sensor.core_${key}`, device_id: 'stack-dev', translation_key: key }));
      states.push(makeState({ entity_id: `sensor.core_${key}`, state: value, attributes }));
    }
  }
  return makeHass({ devices: [stack], entities, states });
}

async function mount(hass: HomeAssistant, config: Record<string, unknown> = {}): Promise<StackCardElement> {
  const card = document.createElement(TAG) as StackCardElement;
  card.setConfig({ type: 'custom:dockhand-stack-card', device_id: 'stack-dev', show_controls: false, ...config });
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

describe('Stack card resource stats', () => {
  it('shows the CPU and memory bars and the network/disk grid from the stack totals', async () => {
    const card = await mount(hassWithStack(true));
    const root = card.shadowRoot!;
    expect(root.querySelectorAll('.bar-track')).toHaveLength(2);
    expect(root.querySelectorAll('.grid-2 .row')).toHaveLength(4);
    card.remove();
  });

  it('opens the CPU entity when its row is clicked', async () => {
    const card = await mount(hassWithStack(true));
    const events: string[] = [];
    card.addEventListener('hass-more-info', (e) => events.push((e as CustomEvent<{ entityId: string }>).detail.entityId));
    (card.shadowRoot!.querySelector('.stacked-pair .row') as HTMLElement).click();
    expect(events).toEqual(['sensor.core_stack_cpu_percent']);
    card.remove();
  });

  it('shows memory as usage over limit with no percentage, and opens the usage entity', async () => {
    const card = await mount(hassWithStack(true));
    const memoryRow = card.shadowRoot!.querySelectorAll<HTMLElement>('.stacked-pair .row')[1];
    const text = memoryRow.querySelector('.fit-parts')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(text).not.toContain('%');
    expect(text).toContain('/');
    const fill = card.shadowRoot!.querySelectorAll<HTMLElement>('.bar-fill')[1];
    expect(fill.style.width).toBe('10%');
    const events: string[] = [];
    card.addEventListener('hass-more-info', (e) => events.push((e as CustomEvent<{ entityId: string }>).detail.entityId));
    memoryRow.click();
    expect(events).toEqual(['sensor.core_stack_memory_usage']);
    card.remove();
  });

  it('adds nothing when ha-dockhand has no stack stats (older release, or stats off)', async () => {
    const card = await mount(hassWithStack(false));
    expect(card.shadowRoot!.querySelector('.bar-track')).toBeNull();
    expect(card.shadowRoot!.querySelector('.grid-2')).toBeNull();
    card.remove();
  });

  it('hides the sections that are turned off', async () => {
    const card = await mount(hassWithStack(true), { visible_sections: ['status', 'io'] });
    expect(card.shadowRoot!.querySelector('.bar-track')).toBeNull();
    expect(card.shadowRoot!.querySelectorAll('.grid-2 .row')).toHaveLength(4);
    card.remove();
  });
});

describe('Stack card container pills', () => {
  function hassWithContainers() {
    const env = makeDevice({ id: 'env-dev', identifiers: [['dockhand', 'entry_env_1']], config_entry_id: 'entry', name: 'Nebula' });
    const stack = makeDevice({ id: 'stack-dev', identifiers: [['dockhand', 'entry_stack_1_core']], config_entry_id: 'entry', name: 'core' });
    const devices = [env, stack];
    const entities = [
      makeEntity({ entity_id: 'sensor.core_status', device_id: 'stack-dev', translation_key: 'status' }),
      makeEntity({ entity_id: 'sensor.core_containers', device_id: 'stack-dev', translation_key: 'containers_in_stack' })
    ];
    const states = [
      makeState({ entity_id: 'sensor.core_status', state: 'running', attributes: { type: 'internal' } }),
      makeState({ entity_id: 'sensor.core_containers', state: '5', attributes: { container_names: ['web', 'db', 'proxy', 'cache', 'idle'] } })
    ];
    const updates: Record<string, Record<string, unknown>> = {
      web: { installed_version: 'a', latest_version: 'update-pending' },
      db: { installed_version: '16', latest_version: '17.6', newer_version: '17.6', newer_version_bump: 'major', newer_versions_count: 2 },
      proxy: { installed_version: 'p', latest_version: 'update-pending', pinned_digest_moved: true },
      cache: { installed_version: 'c', latest_version: 'update-pending', update_held_hours: 6 },
      idle: { off: true, installed_version: 'i', latest_version: 'i' }
    };
    for (const [name, attrs] of Object.entries(updates)) {
      devices.push(makeDevice({ id: `dev-${name}`, identifiers: [['dockhand', `entry_container_1_${name}`]], config_entry_id: 'entry', name }));
      entities.push(makeEntity({ entity_id: `sensor.${name}_state`, device_id: `dev-${name}`, translation_key: 'state' }));
      entities.push(makeEntity({ entity_id: `update.${name}`, device_id: `dev-${name}` }));
      states.push(makeState({ entity_id: `sensor.${name}_state`, state: 'running' }));
      const { off, ...rest } = attrs;
      states.push(makeState({ entity_id: `update.${name}`, state: off ? 'off' : 'on', attributes: rest }));
    }
    return makeHass({ devices, entities, states });
  }

  it('marks a container whose only update is a newer version tag with the grey tag, like the Updates card', async () => {
    const card = await mount(hassWithContainers());
    const pills = [...card.shadowRoot!.querySelectorAll<HTMLElement>('.label-row .label-pill')];
    const icon = (name: string) => pills.find((p) => p.textContent?.trim() === name)!.querySelector('ha-icon')!;
    expect(icon('web').getAttribute('icon')).toBe('mdi:arrow-up-circle');
    expect(icon('db').getAttribute('icon')).toBe('mdi:tag-arrow-up-outline');
    expect(icon('db').getAttribute('title')).toContain('Move to 17.6 (major)');
    expect(icon('proxy').getAttribute('icon')).toBe('mdi:pin-outline');
    expect(icon('cache').getAttribute('icon')).toBe('mdi:clock-outline');
    expect(icon('cache').getAttribute('title')).toBe('Update held: 6 h left of the minimum image age');
    expect(pills.find((p) => p.textContent?.trim() === 'idle')!.querySelector('ha-icon')).toBeNull();
    card.remove();
  });
});

import { describe, it, expect } from 'vitest';
import { resolveDeviceControls } from './device-controls';
import { makeDevice, makeEntity, makeHass, makeState } from './test-fixtures';

const DEVICE = 'container_1_web';

function hassWith(opts: { running?: 'on' | 'off' | null; restart?: boolean; autoUpdate?: boolean }) {
  const entities = [];
  const states = [];
  if (opts.autoUpdate) {
    entities.push(makeEntity({ entity_id: 'switch.web_auto_update', device_id: DEVICE, translation_key: 'container_auto_update' }));
    states.push(makeState({ entity_id: 'switch.web_auto_update', state: 'off' }));
  }
  if (opts.running) {
    entities.push(makeEntity({ entity_id: 'switch.web', device_id: DEVICE, translation_key: null }));
    states.push(makeState({ entity_id: 'switch.web', state: opts.running }));
  }
  if (opts.restart) {
    entities.push(makeEntity({ entity_id: 'button.web_restart', device_id: DEVICE, translation_key: 'restart' }));
    states.push(makeState({ entity_id: 'button.web_restart', state: 'unknown' }));
  }
  return makeHass({ entities, states });
}

describe('resolveDeviceControls', () => {
  it('reports a running container with its restart button', () => {
    const controls = resolveDeviceControls(hassWith({ running: 'on', restart: true }), DEVICE, undefined);
    expect(controls).toEqual({ running: { entityId: 'switch.web', isOn: true }, restartEntityId: 'button.web_restart', deploy: null });
  });

  it('offers restart on a stopped container too, as Dockhand’s containers list does', () => {
    const controls = resolveDeviceControls(hassWith({ running: 'off', restart: true }), DEVICE, true);
    expect(controls).toEqual({ running: { entityId: 'switch.web', isOn: false }, restartEntityId: 'button.web_restart', deploy: null });
  });

  it('offers restart on a stack only while it runs, as Dockhand’s stacks list does', () => {
    const hass = makeHass({
      devices: [makeDevice({ id: 'stack_1_core', identifiers: [['dockhand', 'E_stack_1_core']] })],
      entities: [
        makeEntity({ entity_id: 'switch.core', device_id: 'stack_1_core', translation_key: null }),
        makeEntity({ entity_id: 'button.core_restart', device_id: 'stack_1_core', translation_key: 'restart' })
      ],
      states: [makeState({ entity_id: 'switch.core', state: 'off' }), makeState({ entity_id: 'button.core_restart', state: 'unknown' })]
    });
    expect(resolveDeviceControls(hass, 'stack_1_core', undefined)?.restartEntityId).toBeNull();
  });

  it('returns null when show_controls is false', () => {
    expect(resolveDeviceControls(hassWith({ running: 'on', restart: true }), DEVICE, false)).toBeNull();
  });

  it('returns null when the device has no running switch, as for a system container or a stack holding one', () => {
    expect(resolveDeviceControls(hassWith({ running: null }), DEVICE, undefined)).toBeNull();
  });

  it('omits restart when its button entity is absent', () => {
    const controls = resolveDeviceControls(hassWith({ running: 'on', restart: false }), DEVICE, undefined);
    expect(controls?.restartEntityId).toBeNull();
  });

  it('targets the running switch, not an enabled auto-update switch on the same device', () => {
    const controls = resolveDeviceControls(hassWith({ running: 'on', autoUpdate: true }), DEVICE, undefined);
    expect(controls?.running.entityId).toBe('switch.web');
  });

  it('uses the same running switch and restart button shape for a stack device', () => {
    const hass = makeHass({
      entities: [
        makeEntity({ entity_id: 'switch.core', device_id: 'stack_1_core', translation_key: null }),
        makeEntity({ entity_id: 'button.core_restart', device_id: 'stack_1_core', translation_key: 'restart' }),
        makeEntity({ entity_id: 'button.core_deploy', device_id: 'stack_1_core', translation_key: 'git_stack_deploy' })
      ],
      states: [
        makeState({ entity_id: 'switch.core', state: 'on' }),
        makeState({ entity_id: 'button.core_restart', state: 'unknown' }),
        makeState({ entity_id: 'button.core_deploy', state: 'unknown' })
      ]
    });
    expect(resolveDeviceControls(hass, 'stack_1_core', undefined)).toEqual({ running: { entityId: 'switch.core', isOn: true }, restartEntityId: 'button.core_restart', deploy: { entityId: 'button.core_deploy', state: hass.states['button.core_deploy'], label: undefined } });
  });

  it("offers an internal stack's redeploy button, even while stopped", () => {
    const hass = makeHass({
      devices: [makeDevice({ id: 'stack_1_db', identifiers: [['dockhand', 'E_stack_1_db']] })],
      entities: [
        makeEntity({ entity_id: 'switch.db', device_id: 'stack_1_db', translation_key: null }),
        makeEntity({ entity_id: 'button.db_restart', device_id: 'stack_1_db', translation_key: 'restart' }),
        makeEntity({ entity_id: 'button.db_redeploy', device_id: 'stack_1_db', translation_key: 'stack_deploy' })
      ],
      states: [
        makeState({ entity_id: 'switch.db', state: 'off' }),
        makeState({ entity_id: 'button.db_restart', state: 'unknown' }),
        makeState({ entity_id: 'button.db_redeploy', state: 'unknown' })
      ]
    });
    const controls = resolveDeviceControls(hass, 'stack_1_db', undefined);
    expect(controls?.restartEntityId).toBeNull();
    expect(controls?.deploy?.entityId).toBe('button.db_redeploy');
  });

  it("labels the deploy button with the entity's own name, without the device prefix", () => {
    const hass = makeHass({
      devices: [makeDevice({ id: 'stack_1_core', name: 'Forseti – Stacks – core' })],
      entities: [
        makeEntity({ entity_id: 'switch.core', device_id: 'stack_1_core', translation_key: null }),
        makeEntity({ entity_id: 'button.core_git_deploy', device_id: 'stack_1_core', translation_key: 'git_stack_deploy' })
      ],
      states: [
        makeState({ entity_id: 'switch.core', state: 'on' }),
        makeState({ entity_id: 'button.core_git_deploy', state: 'unknown', attributes: { friendly_name: 'Forseti – Stacks – core Sync from Git' } })
      ]
    });
    expect(resolveDeviceControls(hass, 'stack_1_core', undefined)?.deploy?.label).toBe('Sync from Git');
    (hass as unknown as { formatEntityName: () => string }).formatEntityName = () => 'Deploy';
    expect(resolveDeviceControls(hass, 'stack_1_core', undefined)?.deploy?.label).toBe('Deploy');
  });
});

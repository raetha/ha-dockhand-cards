import { describe, it, expect } from 'vitest';
import { entitiesOnDevice } from './registry-index';
import { makeEntity, makeHass } from './test-fixtures';

describe('entitiesOnDevice', () => {
  it('lists a device’s entities, and follows a new registry object', () => {
    const web = makeEntity({ entity_id: 'sensor.web_state', device_id: 'dev-web' });
    const hass = makeHass({ entities: [web, makeEntity({ entity_id: 'sensor.other' })] });
    expect(entitiesOnDevice(hass, 'dev-web')).toEqual([web]);
    expect(entitiesOnDevice(hass, 'dev-db')).toEqual([]);
    // Home Assistant replaces hass.entities when the registry changes.
    const db = makeEntity({ entity_id: 'sensor.db_state', device_id: 'dev-db' });
    hass.entities = { ...hass.entities, [db.entity_id]: db };
    expect(entitiesOnDevice(hass, 'dev-db')).toEqual([db]);
  });

  it('is empty without a registry', () => {
    const hass = makeHass({});
    (hass as { entities?: unknown }).entities = undefined;
    expect(entitiesOnDevice(hass, 'dev-web')).toEqual([]);
  });
});

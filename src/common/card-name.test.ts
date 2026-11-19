import { describe, it, expect, vi } from 'vitest';
import { resolveCardName, multiEnvCardNameFallback } from './card-name';
import { makeHass, makeState } from './test-fixtures';

describe('resolveCardName', () => {
  it('returns fallback directly when name is unset, never touching hass/entityId at all', () => {
    const formatEntityName = vi.fn();
    const hass = makeHass({ states: [makeState({ entity_id: 'sensor.x', state: 'on' })], formatEntityName });
    expect(resolveCardName(hass, 'sensor.x', undefined, 'Fallback Name')).toBe('Fallback Name');
    expect(formatEntityName).not.toHaveBeenCalled();
  });

  it('returns a plain Custom-mode string as-is when there is no entity to resolve against', () => {
    const formatEntityName = vi.fn();
    const hass = makeHass({ formatEntityName });
    expect(resolveCardName(hass, undefined, 'My Custom Name', 'Fallback')).toBe('My Custom Name');
    expect(formatEntityName).not.toHaveBeenCalled();
  });

  it('returns a plain Custom-mode string as-is when the entity id does not resolve to a real state', () => {
    const formatEntityName = vi.fn();
    const hass = makeHass({ formatEntityName });
    expect(resolveCardName(hass, 'sensor.missing', 'My Custom Name', 'Fallback')).toBe('My Custom Name');
    expect(formatEntityName).not.toHaveBeenCalled();
  });

  it('falls back when a Composed value is set but there is no entity to resolve it against', () => {
    const formatEntityName = vi.fn();
    const hass = makeHass({ formatEntityName });
    expect(resolveCardName(hass, undefined, [{ type: 'device' }], 'Fallback')).toBe('Fallback');
    expect(formatEntityName).not.toHaveBeenCalled();
  });

  it('falls back when a Composed value is set but the entity id does not resolve to a real state', () => {
    const formatEntityName = vi.fn();
    const hass = makeHass({ formatEntityName });
    expect(resolveCardName(hass, 'sensor.missing', [{ type: 'device' }], 'Fallback')).toBe('Fallback');
    expect(formatEntityName).not.toHaveBeenCalled();
  });

  it('delegates to hass.formatEntityName when a Composed value and a real entity are both present', () => {
    const stateObj = makeState({ entity_id: 'sensor.x', state: 'on' });
    const formatEntityName = vi.fn().mockReturnValue('Nebula (Area)');
    const hass = makeHass({ states: [stateObj], formatEntityName });
    const name = [{ type: 'area' as const }];

    expect(resolveCardName(hass, 'sensor.x', name, 'Fallback')).toBe('Nebula (Area)');
    expect(formatEntityName).toHaveBeenCalledWith(stateObj, name);
  });

  it('falls back when formatEntityName returns an empty string', () => {
    const stateObj = makeState({ entity_id: 'sensor.x', state: 'on' });
    const formatEntityName = vi.fn().mockReturnValue('');
    const hass = makeHass({ states: [stateObj], formatEntityName });

    expect(resolveCardName(hass, 'sensor.x', [{ type: 'area' }], 'Fallback')).toBe('Fallback');
  });

  it('returns a plain string as written, as HA’s own formatEntityName does (compute_entity_name_display.ts)', () => {
    const stateObj = makeState({ entity_id: 'sensor.x', state: 'on' });
    const formatEntityName = vi.fn().mockReturnValue('Resolved String');
    const hass = makeHass({ states: [stateObj], formatEntityName });

    expect(resolveCardName(hass, 'sensor.x', 'My Custom Name', 'Fallback')).toBe('My Custom Name');
    expect(formatEntityName).not.toHaveBeenCalled();
  });
});

describe('multiEnvCardNameFallback', () => {
  const oneEnv = [{ deviceId: 'a', name: 'Aurora' }];
  const twoEnvs = [
    { deviceId: 'a', name: 'Aurora' },
    { deviceId: 'b', name: 'Bifrost' }
  ];

  it('appends the environment name when exactly one environment is included', () => {
    expect(multiEnvCardNameFallback(oneEnv, 'Stacks')).toBe('Aurora — Stacks');
  });

  it('is just the type name when more than one environment is included, not doubled up', () => {
    expect(multiEnvCardNameFallback(twoEnvs, 'Stacks')).toBe('Stacks');
  });

  it('is just the type name when zero environments are included too', () => {
    expect(multiEnvCardNameFallback([], 'Stacks')).toBe('Stacks');
  });
});

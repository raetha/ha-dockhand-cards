import { describe, it, expect } from 'vitest';
import { getEnvironmentOverrides, getEnvironmentOrder, migrateOverviewConfig, type DockhandOverviewCardConfig } from './types';

const base: DockhandOverviewCardConfig = { type: 'custom:dockhand-overview-card' };

describe('getEnvironmentOverrides', () => {
  it('reads the current key when present', () => {
    const overrides = { env_1: { environment: { title: 'Nebula' } } };
    expect(getEnvironmentOverrides({ ...base, environments_overrides: overrides })).toBe(overrides);
  });

  it('falls back to the deprecated key for an old-style saved config', () => {
    const overrides = { env_1: { environment: { title: 'Nebula' } } };
    expect(getEnvironmentOverrides({ ...base, environment_overrides: overrides })).toBe(overrides);
  });

  it('prefers the current key when both are somehow present', () => {
    const current = { env_1: { environment: { title: 'Current' } } };
    const deprecated = { env_1: { environment: { title: 'Deprecated' } } };
    expect(getEnvironmentOverrides({ ...base, environments_overrides: current, environment_overrides: deprecated })).toBe(current);
  });

  it('returns undefined when neither key is present', () => {
    expect(getEnvironmentOverrides(base)).toBeUndefined();
    expect(getEnvironmentOverrides(undefined)).toBeUndefined();
  });
});

describe('getEnvironmentOrder', () => {
  it('reads the current key when present', () => {
    expect(getEnvironmentOrder({ ...base, environments_order: ['env_2', 'env_1'] })).toEqual(['env_2', 'env_1']);
  });

  it('falls back to the deprecated key for an old-style saved config', () => {
    expect(getEnvironmentOrder({ ...base, environment_order: ['env_2', 'env_1'] })).toEqual(['env_2', 'env_1']);
  });

  it('returns undefined when neither key is present', () => {
    expect(getEnvironmentOrder(base)).toBeUndefined();
  });
});

describe('migrateOverviewConfig', () => {
  it('renames both deprecated keys to their current names', () => {
    const overrides = { env_1: { environment: { title: 'Nebula' } } };
    const migrated = migrateOverviewConfig({ ...base, environment_overrides: overrides, environment_order: ['env_2', 'env_1'] });
    expect(migrated.environments_overrides).toBe(overrides);
    expect(migrated.environments_order).toEqual(['env_2', 'env_1']);
    expect(migrated.environment_overrides).toBeUndefined();
    expect(migrated.environment_order).toBeUndefined();
  });

  it('leaves an already-current config untouched (same reference)', () => {
    const config = { ...base, environments_overrides: { env_1: {} }, environments_order: ['env_1'] };
    expect(migrateOverviewConfig(config)).toBe(config);
  });

  it('deletes a deprecated key even if the current one is already set, without overwriting the current value', () => {
    const current = { env_1: { environment: { title: 'Current' } } };
    const deprecated = { env_1: { environment: { title: 'Deprecated' } } };
    const migrated = migrateOverviewConfig({ ...base, environments_overrides: current, environment_overrides: deprecated });
    expect(migrated.environments_overrides).toBe(current);
    expect(migrated.environment_overrides).toBeUndefined();
  });

  it('is a no-op for a config with neither deprecated key', () => {
    const config = { ...base, show_environments: true };
    expect(migrateOverviewConfig(config)).toBe(config);
  });
});

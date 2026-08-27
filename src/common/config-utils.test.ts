import { describe, it, expect } from 'vitest';
import { stripUndefinedKeys } from './config-utils';

describe('stripUndefinedKeys', () => {
  it('removes a key whose value is undefined, not just hides it', () => {
    const result = stripUndefinedKeys({ a: 1, device_id: undefined });
    expect(result).not.toHaveProperty('device_id');
    expect(Object.keys(result)).toEqual(['a']);
  });

  it('leaves every other value untouched, including falsy-but-defined ones', () => {
    const result = stripUndefinedKeys({ a: 0, b: '', c: false, d: null, e: undefined });
    expect(result).toEqual({ a: 0, b: '', c: false, d: null });
  });

  it('mutates and returns the same object rather than a copy', () => {
    const config = { a: 1, b: undefined };
    const result = stripUndefinedKeys(config);
    expect(result).toBe(config);
  });

  it('does nothing when nothing is undefined', () => {
    const config = { a: 1, b: 'x' };
    expect(stripUndefinedKeys({ ...config })).toEqual(config);
  });

  it('handles an object with no undefined-valued keys at all, including empty objects', () => {
    expect(stripUndefinedKeys({})).toEqual({});
  });

  it('reflects the actual editor use case: a patch clearing a legacy field alongside a real update stays merged correctly, with only the cleared field gone', () => {
    const config = { device_id: 'env_1', show_settings_link: true };
    const patch = { environments_order: ['env_1', 'env_2'], device_id: undefined };
    const result = stripUndefinedKeys({ ...config, ...patch });
    expect(result).toEqual({ show_settings_link: true, environments_order: ['env_1', 'env_2'] });
  });
});

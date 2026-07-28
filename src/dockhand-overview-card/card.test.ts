import { describe, it, expect } from 'vitest';
import { mergeOverridableField } from './card';

describe('mergeOverridableField', () => {
  it('prefers the per-environment override when set', () => {
    expect(mergeOverridableField('show_settings_link', false, true)).toEqual({ show_settings_link: false });
  });

  it('falls back to the global default when no override is set', () => {
    expect(mergeOverridableField('show_settings_link', undefined, false)).toEqual({ show_settings_link: false });
  });

  it('omits the key entirely when neither override nor global default is set', () => {
    // Regression test: this is the exact bug found in review — show_settings_link was
    // never merged into stacksCfg/containersCfg at all, and envCfg/vulnCfg only had the
    // override half, missing the global-default fallback, so toggling either the global
    // setting or (for Stacks/Containers) the per-environment override had no effect on
    // any generated card.
    expect(mergeOverridableField('show_settings_link', undefined, undefined)).toEqual({});
  });

  it('treats false as a real, settable value, not as "unset"', () => {
    expect(mergeOverridableField('show_settings_link', false, undefined)).toEqual({ show_settings_link: false });
    expect(mergeOverridableField('show_settings_link', undefined, false)).toEqual({ show_settings_link: false });
  });

  it('works for array-valued fields the same way', () => {
    expect(mergeOverridableField('visible_badges', ['updates'], ['health', 'cpu'])).toEqual({ visible_badges: ['updates'] });
    expect(mergeOverridableField('visible_badges', undefined, ['health', 'cpu'])).toEqual({ visible_badges: ['health', 'cpu'] });
    expect(mergeOverridableField('visible_badges', undefined, undefined)).toEqual({});
  });
});

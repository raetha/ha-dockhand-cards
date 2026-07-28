import { describe, it, expect } from 'vitest';
import { t } from './i18n';

describe('t', () => {
  it('returns the English string when no hass/language is given', () => {
    expect(t(undefined, 'environment')).toBe('Environment');
  });

  it('returns a translated string for a supported language', () => {
    expect(t({ language: 'de' }, 'environment')).toBe('Umgebung');
  });

  it('prefers locale.language over the top-level language field', () => {
    expect(t({ language: 'de', locale: { language: 'fr' } }, 'environment')).toBe('Environnement');
  });

  it('falls back to English for an unsupported language', () => {
    expect(t({ language: 'xx' }, 'environment')).toBe('Environment');
  });

  it('spot-checks a few locales actually differ from the English fallback (not accidentally copy-pasted)', () => {
    expect(t({ language: 'de' }, 'environment')).not.toBe(t(undefined, 'environment'));
    expect(t({ language: 'zh-Hans' }, 'container')).not.toBe(t(undefined, 'container'));
    expect(t({ language: 'pl' }, 'display_mode')).not.toBe(t(undefined, 'display_mode'));
    expect(t({ language: 'fr' }, 'overrides_from_default_badge')).not.toBe(t(undefined, 'overrides_from_default_badge'));
    expect(t({ language: 'sv' }, 'environment_order_hint')).not.toBe(t(undefined, 'environment_order_hint'));
    expect(t({ language: 'it' }, 'updates_scope_label')).not.toBe(t(undefined, 'updates_scope_label'));
    expect(t({ language: 'nl' }, 'hide_when_no_updates_helper')).not.toBe(t(undefined, 'hide_when_no_updates_helper'));
  });
});

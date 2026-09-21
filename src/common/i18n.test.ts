import { describe, it, expect } from 'vitest';
import { t as tCard } from './i18n-card';
import { t as tEditor } from './i18n-editor';

describe('i18n-editor t()', () => {
  it('returns the English string when no hass/language is given', () => {
    expect(tEditor(undefined, 'environment')).toBe('Environment');
  });

  it('returns a translated string for a supported language', () => {
    expect(tEditor({ language: 'de' }, 'environment')).toBe('Umgebung');
  });

  it('prefers locale.language over the top-level language field', () => {
    expect(tEditor({ language: 'de', locale: { language: 'fr' } }, 'environment')).toBe('Environnement');
  });

  it('falls back to English for an unsupported language', () => {
    expect(tEditor({ language: 'xx' }, 'environment')).toBe('Environment');
  });

  it('spot-checks a few locales actually differ from the English fallback (not accidentally copy-pasted)', () => {
    expect(tEditor({ language: 'de' }, 'environment')).not.toBe(tEditor(undefined, 'environment'));
    expect(tEditor({ language: 'zh-Hans' }, 'container')).not.toBe(tEditor(undefined, 'container'));
    expect(tEditor({ language: 'pl' }, 'display_mode')).not.toBe(tEditor(undefined, 'display_mode'));
    expect(tEditor({ language: 'fr' }, 'overrides_from_default_badge')).not.toBe(tEditor(undefined, 'overrides_from_default_badge'));
    expect(tEditor({ language: 'sv' }, 'order_list_hint')).not.toBe(tEditor(undefined, 'order_list_hint'));
    expect(tEditor({ language: 'it' }, 'group_by_label')).not.toBe(tEditor(undefined, 'group_by_label'));
    expect(tEditor({ language: 'nl' }, 'hide_when_no_updates_helper')).not.toBe(tEditor(undefined, 'hide_when_no_updates_helper'));
  });
});

describe('i18n-card t()', () => {
  it('returns the English string when no hass/language is given', () => {
    expect(tCard(undefined, 'settings_link_view_stacks')).toBe('View stacks in Dockhand');
  });

  it('returns a translated string for a supported language', () => {
    expect(tCard({ language: 'de' }, 'no_schedules_found')).toBe('Keine Zeitpläne gefunden.');
  });

  it('prefers locale.language over the top-level language field', () => {
    expect(tCard({ language: 'de', locale: { language: 'fr' } }, 'no_schedules_found')).toBe('Aucun planning trouvé.');
  });

  it('falls back to English for an unsupported language', () => {
    expect(tCard({ language: 'xx' }, 'settings_link_unavailable')).toBe(tCard(undefined, 'settings_link_unavailable'));
  });

  it('spot-checks a few locales actually differ from the English fallback', () => {
    expect(tCard({ language: 'de' }, 'no_schedules_found')).not.toBe(tCard(undefined, 'no_schedules_found'));
    expect(tCard({ language: 'zh-Hans' }, 'settings_link_view_containers')).not.toBe(tCard(undefined, 'settings_link_view_containers'));
    expect(tCard({ language: 'es' }, 'settings_link_edit_environment')).not.toBe(tCard(undefined, 'settings_link_edit_environment'));
  });
});

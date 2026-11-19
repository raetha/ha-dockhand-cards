// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { languagePack, languageUrl, loadLanguage, pageLanguage, pageLanguageReady, type LanguagePack } from './i18n-loader';
import { languageStrings } from './i18n-card';

const PACK = { card: {}, editor: {} } as unknown as LanguagePack;

describe('languageUrl', () => {
  it('sits beside the bundle with its version query', () => {
    expect(languageUrl('de', 'http://ha/local/community/ha-dockhand-cards/ha-dockhand-cards.js?v=abc-2.0.0')).toBe(
      'http://ha/local/community/ha-dockhand-cards/ha-dockhand-cards-i18n-de.js?v=abc-2.0.0'
    );
    expect(languageUrl('zh-Hans', 'http://ha/hacsfiles/x/ha-dockhand-cards-editor.js')).toBe('http://ha/hacsfiles/x/ha-dockhand-cards-i18n-zh-Hans.js');
  });
});

describe('loadLanguage', () => {
  it('loads a language once, and never English or one there are no strings for', async () => {
    // Tests preload every real language (test-setup.ts), so these are fresh.
    const importer = vi.fn().mockResolvedValue({ default: PACK });
    await Promise.all([loadLanguage('en', importer), loadLanguage('xx', importer), loadLanguage('de', importer)]);
    expect(importer).not.toHaveBeenCalled();
  });

  it('keeps a failed language in English and says why', async () => {
    const { packs, loading } = (globalThis as unknown as Record<string, { packs: Map<string, unknown>; loading: Map<string, unknown> }>).__haDockhandCardsLanguages;
    const saved = packs.get('sv');
    packs.delete('sv');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const importer = vi.fn().mockRejectedValue(new Error('404'));
    await Promise.all([loadLanguage('sv', importer), loadLanguage('sv', importer)]);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(languagePack('sv')).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    loading.delete('sv');
    const ok = vi.fn().mockResolvedValue({ default: PACK });
    await loadLanguage('sv', ok);
    expect(languagePack('sv')).toBe(PACK);
    packs.set('sv', saved);
    warn.mockRestore();
  });

  it('starts loading a language the first time a string asks for it', () => {
    const { packs, loading } = (globalThis as unknown as Record<string, { packs: Map<string, unknown>; loading: Map<string, Promise<void>> }>).__haDockhandCardsLanguages;
    const saved = packs.get('nb');
    packs.delete('nb');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(languageStrings('nb')).toBeUndefined();
    expect(loading.has('nb')).toBe(true);
    expect(languageStrings('en')).toBeUndefined();
    loading.delete('nb');
    packs.set('nb', saved);
    warn.mockRestore();
  });
});

describe('pageLanguage', () => {
  const doc = (lang: string) => ({ documentElement: { lang } }) as unknown as Document;

  it('prefers the page, then the language saved for this browser', () => {
    expect(pageLanguage(doc('fr'), { getItem: () => '"de"' })).toBe('fr');
    expect(pageLanguage(doc(''), { getItem: () => '"de"' })).toBe('de');
  });

  it('is English without either, or with something unreadable', () => {
    expect(pageLanguage(doc(''), { getItem: () => null })).toBe('en');
    expect(pageLanguage(doc(''), { getItem: () => '{oops' })).toBe('en');
    expect(pageLanguage(doc(''), { getItem: () => '42' })).toBe('en');
    expect(pageLanguage(doc(''), undefined)).toBe('en');
  });

  it('reads the real page by default', () => {
    expect(typeof pageLanguage()).toBe('string');
  });
});

describe('pageLanguageReady', () => {
  it('resolves for a loaded language, and after the wait for a slow one', async () => {
    await pageLanguageReady('de');
    vi.useFakeTimers();
    const { loading } = (globalThis as unknown as Record<string, { loading: Map<string, Promise<void>> }>).__haDockhandCardsLanguages;
    const { packs } = (globalThis as unknown as Record<string, { packs: Map<string, unknown> }>).__haDockhandCardsLanguages;
    const saved = packs.get('pl');
    packs.delete('pl');
    loading.set('pl', new Promise(() => undefined));
    const ready = vi.fn();
    void pageLanguageReady('pl', 1500).then(ready);
    await vi.advanceTimersByTimeAsync(1499);
    expect(ready).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(ready).toHaveBeenCalled();
    loading.delete('pl');
    packs.set('pl', saved);
    vi.useRealTimers();
  });
});

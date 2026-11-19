/**
 * Non-English strings ship as one small file per language beside the card
 * bundle (`ha-dockhand-cards-i18n-<lang>.js`, attached to each release and
 * downloaded with it), so a dashboard only loads the language it shows.
 * English is built into both bundles, and is what shows until a language
 * has loaded or when one can't be.
 *
 * Both bundles load the same URL (relative to themselves, with their
 * version query carried over), so the browser fetches each language once,
 * and an update never reuses an old language file.
 */
import type { CardTranslationKey } from './i18n-card';
import type { EditorTranslationKey } from './i18n-editor';

export interface LanguagePack {
  card: Record<CardTranslationKey, string>;
  editor: Record<EditorTranslationKey, string>;
}

/** Every language besides English, as Home Assistant names them. */
export const LANGUAGES = ['de', 'es', 'fr', 'it', 'nb', 'nl', 'pl', 'pt', 'sv', 'zh-Hans'] as const;

// How long the bundles hold back defining their elements for the page's
// language, so cards don't draw in English first. A language file is a
// local request; this only bounds a slow or failing one.
const PAGE_LANGUAGE_WAIT_MS = 1500;

// Shared through the page, not per bundle: the editor bundle, loaded later,
// then finds the language the card bundle already loaded.
interface LanguageState {
  packs: Map<string, LanguagePack>;
  loading: Map<string, Promise<void>>;
}
const SHARED = '__haDockhandCardsLanguages';
const shared = ((globalThis as Record<string, unknown>)[SHARED] ??= {
  packs: new Map(),
  loading: new Map()
}) as LanguageState;
const { packs, loading } = shared;

/** The loaded strings for a language, if they've arrived. */
export function languagePack(lang: string): LanguagePack | undefined {
  return packs.get(lang);
}

/** Makes a language's strings available without loading them (tests). */
export function registerLanguagePack(lang: string, pack: LanguagePack): void {
  packs.set(lang, pack);
}

/** A language file's URL beside the bundle at `bundleUrl`, with the bundle's
 * query string (its version cache-buster) carried over. */
export function languageUrl(lang: string, bundleUrl: string): string {
  const url = new URL(`./ha-dockhand-cards-i18n-${lang}.js`, bundleUrl);
  url.search = new URL(bundleUrl).search;
  return url.href;
}

function isLanguage(lang: string): boolean {
  return (LANGUAGES as readonly string[]).includes(lang);
}

/** Loads a language's strings once; English, a language there are no
 * strings for, and one already loaded or loading resolve at once. A file
 * that fails to load leaves the language in English. */
export function loadLanguage(lang: string, importer: (url: string) => Promise<{ default: LanguagePack }> = dynamicImport): Promise<void> {
  if (!isLanguage(lang) || packs.has(lang)) return Promise.resolve();
  let pending = loading.get(lang);
  if (!pending) {
    pending = importer(languageUrl(lang, import.meta.url))
      .then((module) => {
        packs.set(lang, module.default);
      })
      .catch((err: unknown) => {
        console.warn(`ha-dockhand-cards: couldn't load ${lang} strings, showing English`, err);
      });
    loading.set(lang, pending);
  }
  return pending;
}

/** The language Home Assistant shows the page in: the `lang` it sets on the
 * page, else the language saved for this browser. */
export function pageLanguage(doc: Document = document, storage: Pick<Storage, 'getItem'> | undefined = safeLocalStorage()): string {
  const fromPage = doc.documentElement.lang;
  if (fromPage) return fromPage;
  try {
    const saved = storage?.getItem('selectedLanguage');
    const parsed: unknown = saved ? JSON.parse(saved) : undefined;
    if (typeof parsed === 'string' && parsed) return parsed;
  } catch {
    // Unreadable or not JSON: fall through to English.
  }
  return 'en';
}

/** Resolves once the page's language has loaded, or after a short wait. */
export function pageLanguageReady(lang: string = pageLanguage(), waitMs: number = PAGE_LANGUAGE_WAIT_MS): Promise<void> {
  return Promise.race([loadLanguage(lang), new Promise<void>((resolve) => setTimeout(resolve, waitMs))]);
}

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// Function constructor keeps this import() opaque to Rollup, so it stays a
// runtime fetch of the language file rather than being bundled in.
function dynamicImport(url: string): Promise<{ default: LanguagePack }> {
  return Function('u', 'return import(u)')(url) as Promise<{ default: LanguagePack }>;
}

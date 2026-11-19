/**
 * Editor-only translations: every key used only by card editors and the
 * shared environment-scope-editor component. Every language is in
 * src/i18n/<lang>.ts: English (en.ts) built in, the others loaded on demand
 * (i18n-loader.ts).
 *
 * See i18n-card.ts for the card-runtime strings.
 */
import { LANGUAGES } from './i18n-loader';
import { languageStrings } from './i18n-card';
import { editor as en } from '../i18n/en';

export type EditorTranslationKey = keyof typeof en;













/** For tests that check every locale against English. */
export const EDITOR_LOCALE_CODES = ['en', ...LANGUAGES];
export const EDITOR_TRANSLATION_KEYS = Object.keys(en) as EditorTranslationKey[];

/** Looks up an editor translated string for the current HA language,
 * falling back to English for an unsupported language or missing key. */
export function t(
  hass: { language?: string; locale?: { language?: string } } | undefined,
  key: EditorTranslationKey,
  vars?: Record<string, string | number>
): string {
  const lang = hass?.locale?.language ?? hass?.language ?? 'en';
  const text: string = languageStrings(lang)?.editor[key] ?? en[key];
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;
}

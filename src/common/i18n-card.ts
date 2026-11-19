/**
 * Card-runtime translations — every string the cards themselves render
 * (not the editors), so the card bundle doesn't carry the much larger
 * editor translation table. `{name}`-style placeholders are filled by
 * t()'s `vars` argument.
 *
 * Words that name an entity's state (container state, health, stack status,
 * …) are also here, as `<kind>_<raw state>` keys: see stateLabel() in
 * common/state-label.ts, which prefers Home Assistant's own translated state
 * when the integration provides one and falls back to these.
 *
 * Every language is in src/i18n/<lang>.ts: English (en.ts) built in, the
 * others loaded on demand (i18n-loader.ts). See i18n-editor.ts for the editor-only keys.
 */

import { LANGUAGES, languagePack, loadLanguage, type LanguagePack } from './i18n-loader';
import { card as en } from '../i18n/en';

export type CardTranslationKey = keyof typeof en;













/** For tests that check every locale against English. */
export const CARD_LOCALE_CODES = ['en', ...LANGUAGES];
export const CARD_TRANSLATION_KEYS = Object.keys(en) as CardTranslationKey[];

type HassLanguage = { language?: string; locale?: { language?: string } } | undefined;

/** The language Home Assistant is showing its UI in. */
export function cardLanguage(hass: HassLanguage): string {
  return hass?.locale?.language ?? hass?.language ?? 'en';
}

function fill(text: string, vars: Record<string, string | number> | undefined): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Looks up a card-runtime translated string for the current HA language,
 * falling back to English for an unsupported language or missing key. */
export function t(hass: HassLanguage, key: CardTranslationKey, vars?: Record<string, string | number>): string {
  return fill(languageStrings(cardLanguage(hass))?.card[key] ?? en[key], vars);
}

/** A language's strings, starting to load them (English until they're
 * here; the card redraws on its next update) when they haven't yet. */
export function languageStrings(lang: string): LanguagePack | undefined {
  const pack = languagePack(lang);
  if (!pack && lang !== 'en') void loadLanguage(lang);
  return pack;
}

/** Like t() for a key built at runtime (e.g. from an entity's raw state);
 * undefined when no such key exists. */
export function tMaybe(hass: HassLanguage, key: string, vars?: Record<string, string | number>): string | undefined {
  if (!(key in en)) return undefined;
  return t(hass, key as CardTranslationKey, vars);
}

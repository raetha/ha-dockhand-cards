/**
 * Compares text people read (names, labels) as Home Assistant's own lists
 * do (caseInsensitiveStringCompare): in the language the user chose in
 * Home Assistant, ignoring case. Home Assistant puts that language on the
 * page's <html lang>; the browser's own language is only the fallback, so
 * a Swedish dashboard in an English browser still sorts å, ä and ö last.
 */
const collators = new Map<string, Intl.Collator>();

function collator(language: string): Intl.Collator {
  let found = collators.get(language);
  if (!found) {
    try {
      found = new Intl.Collator(language || undefined, { sensitivity: 'accent' });
    } catch {
      // A tag Intl doesn't accept: the browser's own language.
      found = new Intl.Collator(undefined, { sensitivity: 'accent' });
    }
    collators.set(language, found);
  }
  return found;
}

export function compareText(a: string, b: string): number {
  const language = typeof document === 'undefined' ? '' : document.documentElement.lang;
  return collator(language).compare(a, b);
}

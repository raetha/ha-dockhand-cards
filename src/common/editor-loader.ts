/**
 * Loads the editor bundle (ha-dockhand-cards-editor.js) exactly once,
 * using import.meta.url to compute its URL relative to the card bundle's
 * own URL at runtime.
 *
 * Why this exists: HACS registers only one Lovelace resource (the main
 * card bundle, per hacs.json's filename field), but it downloads ALL
 * release assets to www/community/ha-dockhand-cards/. That means
 * ha-dockhand-cards-editor.js lands in the same directory as
 * ha-dockhand-cards.js without needing a separate Lovelace resource
 * registration. import.meta.url gives us the live URL of the card bundle
 * (including any ?hacstag=... cache-buster HA appended), and new URL()
 * resolves the editor filename relative to it — same origin, same folder.
 *
 * The dynamic import is written as a Function constructor to prevent
 * Rollup from trying to statically analyze or inline the URL — we
 * genuinely want a real runtime import() here, not a bundled module
 * reference. Every card's getConfigElement() calls this, but the import
 * only fires once.
 */

// Resolved once from import.meta.url at module evaluation time, before
// any getConfigElement() call — safe because this module is in the card
// bundle, whose own URL is what import.meta.url correctly resolves to.
const EDITOR_URL = new URL('./ha-dockhand-cards-editor.js', import.meta.url).href;

let editorLoadPromise: Promise<void> | null = null;

/** Loads the editor bundle the first time it's called; subsequent calls
 * return the same already-resolved promise. */
export function loadEditor(): Promise<void> {
  if (!editorLoadPromise) {
    // Function constructor keeps this import() opaque to Rollup — it must
    // not be treated as a static module reference or inlined into this bundle.
    editorLoadPromise = (Function('u', 'return import(u)')(EDITOR_URL) as Promise<unknown>).then(() => undefined);
  }
  return editorLoadPromise;
}

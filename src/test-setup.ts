

declare global {
  var litIssuedWarnings: Set<string> | undefined;
}

// Lit prints "Lit is in dev mode..." once per module-graph instance it's
// imported into — and since vitest gives each test *file* its own isolated
// globalThis by default, that's once per file that (transitively) imports
// lit, not once per whole test run. It's not indicating anything wrong;
// it's meant for actual browser development, not test output. Confirmed
// against Lit's own maintainers' documented workaround for this exact
// situation (lit/lit#4877): pre-seed the warning as already-issued before
// any lit import happens, so its own warn-once logic skips it. This has to
// run before lit is ever imported, which is why it's a vitest `setupFiles`
// entry (runs first, per test file) rather than living in a regular test.
globalThis.litIssuedWarnings ??= new Set();
globalThis.litIssuedWarnings.add('Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.');

// Every language's strings, as if already loaded, so tests can render in
// any language without fetching the per-language files.
import { registerLanguagePack } from './common/i18n-loader';
import de from './i18n/de';
import es from './i18n/es';
import fr from './i18n/fr';
import it from './i18n/it';
import nb from './i18n/nb';
import nl from './i18n/nl';
import pl from './i18n/pl';
import pt from './i18n/pt';
import sv from './i18n/sv';
import zhHans from './i18n/zh-Hans';

for (const [lang, pack] of Object.entries({ de, es, fr, it, nb, nl, pl, pt, sv, 'zh-Hans': zhHans })) {
  registerLanguagePack(lang, pack);
}

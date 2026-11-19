import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import minifyHTML from '@lit-labs/rollup-plugin-minify-html-literals';
import { readFileSync, readdirSync } from 'node:fs';

const dev = process.env.ROLLUP_WATCH === 'true';
// CI's test builds pass their own version (e.g. 1.5.1-dev.12) so the console banner shows it.
const version =
  process.env.CARD_VERSION || JSON.parse(readFileSync('./package.json', 'utf-8')).version;

/** Shared plugin stack — identical for both bundles. */
function plugins() {
  return [
    replace({
      preventAssignment: true,
      values: { __CARD_VERSION__: version }
    }),
    // Strips comments/whitespace from the CSS content of every css`` tagged
    // template literal — a genuinely different problem from terser() below.
    // terser only ever sees those template literals as opaque string
    // values (it can't tell a CSS /* comment */ embedded in a JS string
    // apart from meaningful string content, and rightly won't touch it),
    // so without this, every explanatory comment written inside a styles.ts
    // css`` block — and there are a lot of them — ships to every browser
    // as literal bytes. Must run before typescript() below: it needs to
    // see the still-untranspiled css`` tag calls, matching this plugin's
    // own documented ordering (before babel, in its own examples).
    !dev && minifyHTML(),
    resolve(),
    typescript({ tsconfig: './tsconfig.json', sourceMap: dev }),
    !dev && terser()
  ].filter(Boolean);
}

export default [
  // Card bundle — card implementations + card-runtime i18n only.
  // Editors are NOT included here; they live in the editor bundle below.
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/ha-dockhand-cards.js',
      format: 'es',
      sourcemap: dev
    },
    plugins: plugins()
  },
  // Editor bundle — all 9 card editors + editor i18n.
  // Loaded as a second Lovelace resource alongside the card bundle.
  // Shared utility code (Lit, device-utils, etc.) is duplicated into both
  // bundles rather than emitted as a shared chunk — shared chunks break
  // under HACS because HA appends a ?hacstag= cache-buster to registered
  // resource URLs, making the browser see two different module URLs for the
  // same chunk and triggering duplicate customElements.define() errors.
  {
    input: 'src/editors.ts',
    output: {
      file: 'dist/ha-dockhand-cards-editor.js',
      format: 'es',
      sourcemap: dev
    },
    plugins: plugins()
  },
  // One file per non-English language, loaded on demand by both bundles
  // (common/i18n-loader.ts). Only data: nothing shared with the bundles.
  ...readdirSync('src/i18n')
    // English is built into the bundles.
    .filter((file) => file.endsWith('.ts') && file !== 'en.ts')
    .map((file) => ({
      input: `src/i18n/${file}`,
      output: {
        file: `dist/ha-dockhand-cards-i18n-${file.replace(/\.ts$/, '')}.js`,
        format: 'es',
        sourcemap: dev
      },
      plugins: plugins()
    }))
];

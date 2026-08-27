import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import minifyHTML from '@lit-labs/rollup-plugin-minify-html-literals';
import { readFileSync } from 'node:fs';

const dev = process.env.ROLLUP_WATCH === 'true';
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/ha-dockhand-cards.js',
    format: 'es',
    sourcemap: dev,
    inlineDynamicImports: true
  },
  plugins: [
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
  ].filter(Boolean)
};

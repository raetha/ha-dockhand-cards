import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
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
    resolve(),
    typescript({ tsconfig: './tsconfig.json', sourceMap: dev }),
    !dev && terser()
  ].filter(Boolean)
};

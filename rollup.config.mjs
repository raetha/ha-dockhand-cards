import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const dev = process.env.ROLLUP_WATCH === 'true';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/ha-dockhand-cards.js',
    format: 'es',
    sourcemap: dev,
    inlineDynamicImports: true
  },
  plugins: [
    resolve(),
    typescript({ tsconfig: './tsconfig.json', sourceMap: dev }),
    !dev && terser()
  ].filter(Boolean)
};

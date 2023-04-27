import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['src/index.ts'],
  external: ['glob'],
  format: 'esm',
  bundle: true,
  outfile: 'lib/index.js',
  tsconfig: './tsconfig.json',
  packages: 'external',
});

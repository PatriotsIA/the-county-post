import { build } from 'esbuild';
await build({
  entryPoints: ['src/api.ts', 'src/worker.ts', 'src/preview.ts'], outdir: 'dist',
  bundle: true, platform: 'node', target: 'node22', format: 'esm',
  outExtension: { '.js': '.mjs' }, sourcemap: true,
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});

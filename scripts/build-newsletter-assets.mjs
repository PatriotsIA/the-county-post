import { build } from 'vite';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
await build({
  configFile: false, logLevel: 'warn',
  plugins: [{ name: 'newsletter-source-assets', enforce: 'pre', load(id) {
    if (/\.(png|jpe?g|webp)$/i.test(id)) return `export default ${JSON.stringify(id)};`;
  } }],
  build: { ssr: 'scripts/newsletter-assets.ts', outDir: '.newsletter-build', emptyOutDir: true },
});
await import(pathToFileURL(resolve('.newsletter-build/newsletter-assets.js')).href);

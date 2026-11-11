// Publish the reviewed ad catalog and immutable artwork with every news-site build.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve, sep } from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const assetRoot = realpathSync(resolve(root, 'ad-assets'));
const destination = resolve(root, 'dist/shared-ads');
mkdirSync(destination, { recursive: true });
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { ads, feedOnlySponsors } = await server.ssrLoadModule('/src/data/ads.ts');
  const { getPartnerCreatives } = await server.ssrLoadModule('/src/data/partners.ts');
  const primary = [...ads, ...feedOnlySponsors];
  const extras = getPartnerCreatives().filter(ad => !primary.some(item => item.id === ad.id));
  const rows = [...ads.map(ad => ({ ...ad, placement: 'rotation' })), ...feedOnlySponsors.map(ad => ({ ...ad, placement: 'feed' })), ...extras.map(ad => ({ ...ad, placement: 'directory' }))];
  const seen = new Set();
  const creatives = rows.map(row => {
    if (seen.has(row.id)) throw new Error(`Duplicate ad identifier: ${row.id}`);
    seen.add(row.id);
    const source = realpathSync(resolve(root, row.image.replace(/^\//, '').split('?')[0]));
    if (!source.startsWith(assetRoot + sep)) throw new Error('Ad artwork must be in ad-assets');
    const extension = extname(source).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) throw new Error('Unsupported artwork format');
    const bytes = readFileSync(source);
    if (bytes.length > 8 * 1024 * 1024) throw new Error('Ad artwork exceeds the shared catalog limit');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const filename = sha256 + extension;
    copyFileSync(source, resolve(destination, filename));
    return { id: row.id, slot: row.slot, placement: row.placement, name: row.name, alt: row.alt,
      href: row.href, image: `/shared-ads/${filename}`, sha256, sourceName: basename(source),
      stateSlugs: row.stateSlugs || [], countyKeys: row.countyKeys || [], video: row.video || null };
  });
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  writeFileSync(resolve(root, 'dist/classifieds-ads.json'), JSON.stringify({ schema_version: 1, revision, creatives }, null, 2) + '\n');
  console.log(`Published Classifieds ad manifest: ${creatives.length} creatives, ${new Set(creatives.map(ad => ad.sha256)).size} immutable assets.`);
} finally { await server.close(); }

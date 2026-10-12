import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { ads } from '../src/data/ads';

const target = resolve('public/newsletter-assets');
mkdirSync(target, { recursive: true });
function asset(path: string) {
  const bytes = readFileSync(path);
  const name = `${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}${extname(path).toLowerCase()}`;
  copyFileSync(path, resolve(target, name));
  return `https://thecountypost.com/newsletter-assets/${name}`;
}
const included = ads.filter(ad => !ad.video && (ad.id === 'pia-banner' || ad.slot === 'inline'));
writeFileSync('public/newsletter-catalog.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  logo: asset(resolve('county-post-final-logo.png')),
  ads: included.map(({ id, name, image, alt, href, countyKeys, stateSlugs, slot }) => ({ id, name, image: asset(image), alt, href: new URL(href, 'https://thecountypost.com').href, countyKeys, stateSlugs, slot })),
}, null, 2));
console.log(`Newsletter catalog: ${included.length} current sponsors with existing edition restrictions.`);

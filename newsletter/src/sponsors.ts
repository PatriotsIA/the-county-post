import { SITE, hash, type Edition } from './model';
export type Sponsor = { id: string; name: string; image: string; alt: string; href: string; slot: string; countyKeys?: string[]; stateSlugs?: string[] };
export type Catalog = { logo: string; ads: Sponsor[] };
export function selectSponsors(catalog: Catalog, edition: Edition, date: string) {
  const countyKey = edition.level === 'county' ? `${edition.state}/${edition.county}` : undefined;
  const eligible = catalog.ads.filter(ad => (!ad.stateSlugs?.length || ad.stateSlugs.includes(edition.state || '')) && (!ad.countyKeys?.length || ad.countyKeys.includes(countyKey || '')));
  const banner = eligible.find(ad => ad.id === 'pia-banner');
  const local = eligible.filter(ad => ad.slot === 'inline' && ad.countyKeys?.includes(countyKey || ''));
  const priority = ['merch-inline', 'become-a-patriot-inline', 'patriot-trailer-inline', 'guerrilla-gear-inline'];
  const general = eligible.filter(ad => priority.includes(ad.id)).sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
  const rotation = local.length ? local : general;
  const start = rotation.length ? parseInt(hash(`${date}|${countyKey || edition.state || 'national'}`).slice(0, 6), 16) % rotation.length : 0;
  const cards = Array.from({ length: Math.min(2, rotation.length) }, (_, i) => rotation[(start + i) % rotation.length]);
  return { logo: catalog.logo, banner, cards };
}
export async function loadCatalog(): Promise<Catalog | undefined> {
  try {
    const response = await fetch(`${SITE}/newsletter-catalog.json`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return undefined;
    const catalog = await response.json() as Catalog;
    if (!Array.isArray(catalog.ads) || !catalog.logo?.startsWith(`${SITE}/newsletter-assets/`)) return undefined;
    catalog.ads = catalog.ads.filter(ad => typeof ad.id === 'string' && typeof ad.name === 'string' && ad.image?.startsWith(`${SITE}/newsletter-assets/`) && /^https?:\/\//.test(ad.href));
    return catalog;
  } catch { return undefined; }
}

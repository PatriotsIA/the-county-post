/**
 * Build-time sitemap generation.
 *
 * Run through Vite rather than Node directly:
 *
 *   vite build --ssr scripts/seo/generate-sitemaps.ts --outDir .seo-build --emptyOutDir
 *   node .seo-build/generate-sitemaps.js
 *
 * The app's data modules use extensionless imports, which Node's TypeScript
 * stripping refuses to resolve. Bundling through Vite first resolves them
 * exactly as the app does, so the sitemap can never drift from the routes the
 * router actually serves. `npm run seo:sitemap` wraps both steps.
 *
 * Only Tier 1 routes are listed. See `indexPolicy` in src/lib/seo.ts for why the
 * other ~85,000 URLs are deliberately left out.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { counties } from "../../src/data/counties";
import { states } from "../../src/data/states";
import { site } from "../../src/data/site";
import { subjectGroups, subjectPages } from "../../src/data/subjects";
import { dataCentersOpEd } from "../../src/data/county-post-op-eds";

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");

/** Well under the 50,000-URL / 50 MB per-file limits, and small enough to diff. */
const MAX_URLS_PER_FILE = 25_000;

/** County sections carrying data unique to that county, not shared feed output. */
const COUNTY_DATA_SECTIONS = ["data", "weather", "economic-data", "local-sources"] as const;

const buildDate = new Date().toISOString().slice(0, 10);

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      default:
        return "&quot;";
    }
  });
}

function loc(path: string) {
  const normalized = path === "/" ? "/" : `/${path.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  return `${site.url}${normalized}`;
}

function urlsetXml(paths: string[]) {
  const entries = paths
    .map((path) => `  <url>\n    <loc>${escapeXml(loc(path))}</loc>\n    <lastmod>${buildDate}</lastmod>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function sitemapIndexXml(filenames: string[]) {
  const entries = filenames
    .map((name) => `  <sitemap>\n    <loc>${escapeXml(`${site.url}/${name}`)}</loc>\n    <lastmod>${buildDate}</lastmod>\n  </sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

/**
 * Writes one urlset, or several numbered ones when the path list is long enough
 * to need splitting. Returns the filenames for the index.
 */
function writeUrlset(baseName: string, paths: string[]) {
  const groups = chunk(paths, MAX_URLS_PER_FILE);
  return groups.map((group, index) => {
    const filename = groups.length === 1 ? `${baseName}.xml` : `${baseName}-${index + 1}.xml`;
    writeFileSync(join(OUT_DIR, filename), urlsetXml(group), "utf8");
    return filename;
  });
}

const corePaths = [
  "/",
  "/states",
  "/about",
  "/partners",
  "/op-eds",
  dataCentersOpEd.path,
  "/privacy",
  "/terms",
  ...subjectGroups.map((group) => `/topics/${group.slug}`),
  ...subjectPages.map((subject) => `/topics/${subject.slug}`),
];

const statePaths = states.map((state) => `/${state.slug}`);

const countyPaths = counties.map((county) => `/${county.state.slug}/${county.slug}`);

const countyDataPaths = counties.flatMap((county) =>
  COUNTY_DATA_SECTIONS.map((section) => `/${county.state.slug}/${county.slug}/${section}`),
);

mkdirSync(OUT_DIR, { recursive: true });

const files = [
  ...writeUrlset("sitemap-core", corePaths),
  ...writeUrlset("sitemap-states", statePaths),
  ...writeUrlset("sitemap-counties", countyPaths),
  ...writeUrlset("sitemap-county-data", countyDataPaths),
];

writeFileSync(join(OUT_DIR, "sitemap.xml"), sitemapIndexXml(files), "utf8");

const total = corePaths.length + statePaths.length + countyPaths.length + countyDataPaths.length;
console.log(
  `sitemap: ${total.toLocaleString()} URLs across ${files.length} file(s) -> ${OUT_DIR}\n` +
    `  core ${corePaths.length}, states ${statePaths.length}, counties ${countyPaths.length}, county data ${countyDataPaths.length}`,
);

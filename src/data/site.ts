export const site = {
  name: "The County Post",
  shortName: "County Post",
  tagline: "Local dispatches with national perspective.",
  // Canonical production origin. Every canonical URL, Open Graph URL, sitemap
  // entry, and JSON-LD `url` is built from this, so it must be the apex host
  // with no trailing slash.
  url: "https://thecountypost.com",
  description:
    "County-level news for all 3,143 U.S. counties. Local headlines, sports, obituaries, public notices, weather, and a sourced data atlas for every county in America.",
  founded: "2026",
  locale: "en_US",
  contact: {
    email: "submissions@thecountypost.com",
  },
  // 1200x630 social card. Regenerate with `npm run seo:images` if the logo changes.
  ogImage: "/social-card.png",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  logo: "/county-post-mark-512.png",
} as const;

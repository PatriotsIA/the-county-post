import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { site } from "../data/site";
import {
  absoluteUrl,
  canonicalUrl,
  clampDescription,
  indexPolicy,
  pageTitle,
  robotsContent,
  type IndexPolicyKey,
  type IndexTier,
} from "../lib/seo";

type SeoProps = {
  /** Page title without the masthead suffix; `pageTitle` appends it. */
  title: string;
  description: string;
  /** Which index tier this route belongs to. See `indexPolicy` in lib/seo.ts. */
  policy: IndexPolicyKey;
  /**
   * Forces `noindex` regardless of tier. Used by pages that only discover at
   * runtime that they have nothing to show — an atlas domain with no coverage
   * for a county is a thin page whatever its tier says.
   */
  noindex?: boolean;
  /** Absolute or root-relative social image. Defaults to the site card. */
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
  /** Serialised JSON-LD from `jsonLdGraph`. */
  jsonLd?: string;
  /** Overrides the canonical path when a route should point at another URL. */
  canonicalPath?: string;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Removes the placeholder metadata baked into index.html.
 *
 * index.html carries a full set of default tags so that crawlers which do not
 * execute JavaScript — every social-card scraper — still get a branded, sensible
 * result for any URL. Once React mounts it renders the real per-route tags, and
 * React 19 hoists them into <head> without deduplicating against the static
 * ones. Left in place they would produce two descriptions and two canonicals per
 * page, so the defaults are stripped on first mount.
 */
function stripStaticDefaults() {
  document.querySelectorAll("[data-seo-default]").forEach((node) => node.remove());
}

export function Seo({
  title,
  description,
  policy,
  noindex,
  image,
  type = "website",
  publishedTime,
  jsonLd,
  canonicalPath,
}: SeoProps) {
  const { pathname } = useLocation();
  const path = canonicalPath ?? pathname;
  const canonical = canonicalUrl(path);

  const tier: IndexTier = noindex ? "noindex" : indexPolicy[policy];
  const fullTitle = pageTitle(title);
  const metaDescription = clampDescription(description);
  const socialImage = absoluteUrl(image ?? site.ogImage);

  useEffect(() => {
    stripStaticDefaults();
  }, []);

  // GA4 receives one page_view per client-side navigation. The gtag config in
  // index.html sets send_page_view:false so this is the only source of
  // pageviews; without it GA4 only ever saw landing pages.
  useEffect(() => {
    window.gtag?.("event", "page_view", {
      page_title: fullTitle,
      page_location: canonical,
      page_path: path,
    });
  }, [canonical, fullTitle, path]);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="robots" content={robotsContent(tier)} />
      <link rel="canonical" href={canonical} />

      <meta property="og:site_name" content={site.name} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content={site.locale} />
      <meta property="og:image" content={socialImage} />
      <meta property="og:image:width" content={String(site.ogImageWidth)} />
      <meta property="og:image:height" content={String(site.ogImageHeight)} />
      <meta property="og:image:alt" content={`${site.name} — ${site.tagline}`} />
      {publishedTime ? <meta property="article:published_time" content={publishedTime} /> : null}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={socialImage} />

      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
    </>
  );
}

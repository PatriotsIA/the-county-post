const supportedOrigins = new Set([
  "https://classifieds.thecountypost.com",
  "https://staging-classifieds.thecountypost.com",
]);

// Unset until the owner authorizes the public handoff. Local preview can target staging.
export function classifiedsOrigin(): string | null {
  const configured = import.meta.env.VITE_CLASSIFIEDS_ORIGIN?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return supportedOrigins.has(url.origin) && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password
      ? url.origin : null;
  } catch {
    return null;
  }
}

export function countyClassifiedsUrl(fips: string, action: "browse" | "post" = "browse"): string | null {
  const origin = classifiedsOrigin();
  if (!origin || !/^\d{5}$/.test(fips)) return null;
  return `${origin}/from-county-post/county/${fips}/${action === "post" ? "?action=post" : ""}`;
}

export function stateClassifiedsUrl(fips: string): string | null {
  const origin = classifiedsOrigin();
  return origin && /^\d{2}$/.test(fips) ? `${origin}/from-county-post/state/${fips}/` : null;
}

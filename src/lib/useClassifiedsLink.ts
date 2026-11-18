import { useLocation } from "react-router-dom";
import type { AdCreative } from "../data/ads";
import { editionClassifiedsUrl, withCountyPostUtm, type ClassifiedsPlacement } from "./classifieds";
import { useAdEditionKey } from "./useAdEditionKey";

/** A link into the marketplace at this page's level, tagged with this page. Null when the marketplace is off. */
export function useClassifiedsLink(placement: ClassifiedsPlacement, { action = "browse", editionKey }: { action?: "browse" | "post"; editionKey?: string } = {}) {
  const { pathname } = useLocation();
  const edition = useAdEditionKey(editionKey);
  const url = editionClassifiedsUrl(edition, action);
  return url ? withCountyPostUtm(url, placement, pathname) : null;
}

/** An ad's destination: the advertiser's own link, or for the County Post's own Classifieds ads, this page's. */
export function useAdHref(placement: ClassifiedsPlacement, editionKey?: string) {
  const classifieds = useClassifiedsLink(placement, { editionKey });
  return (ad: AdCreative) => (ad.house === "classifieds" ? classifieds ?? ad.href : ad.href);
}

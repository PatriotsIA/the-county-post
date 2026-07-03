import { AdPreviewPlaceholder } from "./AdPreviewPlaceholder";
import type { AdPricingKey } from "../data/ad-pricing";

type AdSlotProps = {
  pricingKey: AdPricingKey;
  label?: string;
  count?: number;
  banner?: boolean;
  carousel?: boolean;
};

export function AdSlot({ pricingKey, label, count = 1, banner = false, carousel = false }: AdSlotProps) {
  const items = Array.from({ length: Math.max(1, count) }, (_, index) => index);

  return (
    <aside className={`ad-slot${banner ? " ad-slot-banner" : ""}${carousel ? " ad-slot-carousel" : ""}`} aria-label="Advertiser preview placement">
      {carousel ? <p className="ad-slot-heading">{label || "Available advertiser placements"}</p> : null}
      <div className="ad-slot-track">
        {items.map((item) => (
          <AdPreviewPlaceholder key={item} pricingKey={pricingKey} label={label} banner={banner} />
        ))}
      </div>
    </aside>
  );
}

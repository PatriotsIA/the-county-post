import { formatAdPrice, formatPlacementPricing, getAdPricing, type AdPricingKey } from "../data/ad-pricing";

type AdPreviewPlaceholderProps = {
  pricingKey: AdPricingKey;
  compact?: boolean;
  banner?: boolean;
  label?: string;
};

export function AdPreviewPlaceholder({ pricingKey, compact = false, banner = false, label }: AdPreviewPlaceholderProps) {
  const pricing = getAdPricing(pricingKey);

  return (
    <div className={`ad-preview-placeholder${compact ? " ad-preview-placeholder-compact" : ""}${banner ? " ad-preview-placeholder-banner" : ""}`}>
      <span className="ad-preview-spot">{label || pricing.label}</span>
      <span className="ad-preview-tier">{pricing.tier}</span>
      {pricing.quoteOnly ? (
        <span className="ad-preview-quote">{pricing.quoteLabel}</span>
      ) : (
        <>
          <span className="ad-preview-monthly">{formatAdPrice(pricing.monthly)}/mo</span>
          <span className="ad-preview-yearly">{formatAdPrice(pricing.yearly)}/yr</span>
        </>
      )}
    </div>
  );
}

export function PresentedByPreview({ pricingKey, label = "Presented by" }: { pricingKey: AdPricingKey; label?: string }) {
  return (
    <div className="presented-by-preview">
      <span className="presented-by-preview-label">{label}</span>
      <AdPreviewPlaceholder pricingKey={pricingKey} compact />
      <span className="presented-by-preview-price">{formatPlacementPricing(getAdPricing(pricingKey))}</span>
    </div>
  );
}

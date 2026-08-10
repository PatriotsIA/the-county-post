type AdPreviewPlaceholderProps = {
  pricingKey: string;
  compact?: boolean;
  banner?: boolean;
  label?: string;
};

export function AdPreviewPlaceholder({ pricingKey, compact = false, banner = false, label }: AdPreviewPlaceholderProps) {
  const pricing = previewPricing(pricingKey);

  return (
    <div className={`ad-preview-placeholder${compact ? " ad-preview-placeholder-compact" : ""}${banner ? " ad-preview-placeholder-banner" : ""}`}>
      <span className="ad-preview-spot">{label || pricing.label}</span>
      <span className="ad-preview-tier">{pricing.tier}</span>
      <span className="ad-preview-monthly">{pricing.price}</span>
    </div>
  );
}

export function PresentedByPreview({ pricingKey, label = "Presented by" }: { pricingKey: string; label?: string }) {
  return (
    <div className="presented-by-preview">
      <span className="presented-by-preview-label">{label}</span>
      <AdPreviewPlaceholder pricingKey={pricingKey} compact />
      <span className="presented-by-preview-price">{previewPricing(pricingKey).price}</span>
    </div>
  );
}

function previewPricing(key: string) {
  if (key.includes("national")) return { label: "National lane", tier: "National advertiser", price: "$30,000/mo" };
  if (key.includes("section") || key.includes("feed")) return { label: "Section sponsorship", tier: "Exclusive county sponsor", price: "2× county card rate" };
  if (key.includes("banner")) return { label: "Network section break", tier: "State or national sponsor", price: "$10/county/mo" };
  return { label: "Local color card", tier: "County advertiser", price: "From $25/mo" };
}

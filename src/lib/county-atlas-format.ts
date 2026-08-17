import type { CountyAtlasMetric, CountyAtlasValueKind } from "./county-atlas-api";

export function formatAtlasMetricValue(metric: CountyAtlasMetric) {
  if (metric.suppressed) return "Suppressed";
  if (metric.displayValue) return metric.displayValue;
  if (metric.value === undefined) return "Not available";
  return formatAtlasValue(metric.value, metric.valueKind, metric.unit);
}

export function formatAtlasValue(value: number, valueKind: CountyAtlasValueKind, unit = "") {
  if (valueKind === "percent") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
  }
  if (valueKind === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: Math.abs(value) >= 1_000_000 ? 1 : 0,
    }).format(value);
  }
  const formatted = new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: valueKind === "index" ? 1 : 2,
  }).format(value);
  return unit && !["count", "number", "index"].includes(unit.toLowerCase())
    ? `${formatted} ${unit}`
    : formatted;
}

export function atlasMetricVintage(metric: CountyAtlasMetric) {
  return metric.vintage || metric.date || "Vintage unavailable";
}

export function atlasMetricYear(metric: CountyAtlasMetric) {
  const value = metric.date || metric.vintage;
  const year = value?.match(/\b(?:19|20)\d{2}\b/)?.[0];
  return year || value || "Year unavailable";
}

export function formatAtlasTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function atlasMetricSummary(metric: CountyAtlasMetric) {
  const parts = [
    `${metric.label}: ${formatAtlasMetricValue(metric)}`,
    `latest available ${atlasMetricYear(metric)}`,
  ];
  if (metric.modeledEstimate) parts.push("modeled estimate");
  if (metric.preliminary) parts.push("preliminary");
  if (metric.coveragePercent !== undefined) parts.push(`${metric.coveragePercent}% coverage`);
  if (metric.marginOfError !== undefined) {
    parts.push(`margin of error ${formatAtlasValue(metric.marginOfError, metric.valueKind, metric.unit)}`);
  }
  return parts.join("; ");
}

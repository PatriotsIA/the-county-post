export type MetalsTickerResponse = {
  currency: string;
  unit: string;
  updatedAt?: string;
  provider: {
    name: string;
    url: string;
  };
  stale?: boolean;
  items: Array<{
    key: "gold" | "silver" | "platinum" | "palladium";
    label: string;
    price: number;
    previousPrice?: number;
    fixedAt?: string;
    sourceLabel?: string;
  }>;
};

type CattleTickerResponse = {
  updatedAt?: string;
  items: Array<{
    key: "feeder-cattle" | "slaughter-cattle";
    label: string;
    price: number;
    unit: string;
    market?: string;
    reportDate?: string;
    sampleSize: number;
    breakdown?: Array<{
      label: string;
      price: number;
      unit: string;
    }>;
  }>;
};

export async function fetchMetalsTicker(signal?: AbortSignal) {
  const response = await fetch(marketApiUrl("metals"), { signal });
  if (!response.ok) throw new Error("Metals prices are unavailable.");
  const data = await response.json() as MetalsTickerResponse;
  const keys = ["gold", "silver", "platinum", "palladium"];
  if (!data || data.currency !== "USD" || !["troy oz", "troy ounce"].includes(data.unit) || !Array.isArray(data.items) ||
      data.items.length !== keys.length || keys.some(key => data.items.filter(item => item?.key === key).length !== 1) ||
      data.items.some(item => !Number.isFinite(item.price) || item.price <= 0)) {
    throw new Error("Metals prices could not be verified.");
  }
  return {
    ...data,
    updatedAt: validMarketDate(data.updatedAt),
    items: data.items.map(item => ({
      ...item,
      previousPrice: typeof item.previousPrice === "number" && Number.isFinite(item.previousPrice) && item.previousPrice > 0 ? item.previousPrice : undefined,
      fixedAt: validMarketDate(item.fixedAt),
      sourceLabel: typeof item.sourceLabel === "string" ? item.sourceLabel : undefined,
    })),
  };
}

function validMarketDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : undefined;
}

export async function fetchCattleTicker(signal?: AbortSignal) {
  const response = await fetch(marketApiUrl("cattle"), { signal });
  if (!response.ok) throw new Error("Cattle prices are unavailable.");
  return (await response.json()) as CattleTickerResponse;
}

function marketApiUrl(market: "metals" | "cattle") {
  const baseUrl = import.meta.env.VITE_NEWS_API_URL;
  if (!baseUrl) throw new Error("Market API is not configured.");
  return new URL(`v1/markets/${market}`, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

export type MetalsTickerResponse = {
  currency: string;
  unit: string;
  priceType: "spot";
  fetchedAt: string;
  nextRefreshAt: string;
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
    quotedAt: string;
    previousQuotedAt?: string;
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

let metalsRequest: Promise<MetalsTickerResponse> | undefined;
let metalsCached: MetalsTickerResponse | undefined;
let metalsCheckedAt = 0;

export function fetchMetalsTicker() {
  if (metalsRequest) return metalsRequest;
  if (metalsCached && Date.now() - metalsCheckedAt < 15_000) return Promise.resolve(metalsCached);
  metalsRequest = requestMetalsTicker().then(data => {
    metalsCached = data;
    metalsCheckedAt = Date.now();
    return data;
  }).finally(() => { metalsRequest = undefined; });
  return metalsRequest;
}

async function requestMetalsTicker(): Promise<MetalsTickerResponse> {
  const response = await fetch(marketApiUrl("metals"), { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Metals prices are unavailable.");
  const data = await response.json() as MetalsTickerResponse;
  const keys = ["gold", "silver", "platinum", "palladium"];
  if (!data || data.priceType !== "spot" || data.currency !== "USD" || !["troy oz", "troy ounce"].includes(data.unit) || !Array.isArray(data.items) ||
      !validMarketDate(data.fetchedAt) || !validMarketDate(data.nextRefreshAt) ||
      data.items.length !== keys.length || keys.some(key => data.items.filter(item => item?.key === key).length !== 1) ||
      data.items.some(item => !Number.isFinite(item.price) || item.price <= 0 || !validMarketDate(item.quotedAt) ||
        Date.parse(item.quotedAt) > Date.now() + 60_000 || Date.now() - Date.parse(item.quotedAt) > 4 * 86400_000)) {
    throw new Error("Metals prices could not be verified.");
  }
  return {
    ...data,
    updatedAt: validMarketDate(data.updatedAt),
    items: data.items.map(item => ({
      ...item,
      previousPrice: typeof item.previousPrice === "number" && Number.isFinite(item.previousPrice) && item.previousPrice > 0 &&
        validMarketDate(item.previousQuotedAt) && Date.parse(item.previousQuotedAt!) < Date.parse(item.quotedAt) ? item.previousPrice : undefined,
      previousQuotedAt: validMarketDate(item.previousQuotedAt),
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

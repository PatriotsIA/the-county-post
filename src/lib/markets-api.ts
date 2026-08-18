type MetalsTickerResponse = {
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
  return (await response.json()) as MetalsTickerResponse;
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

import { useEffect, useMemo, useRef, useState } from "react";
import { getCountyMarketCity, type CountySite } from "../data/counties";
import { fetchCattleTicker, fetchMetalsTicker } from "../lib/markets-api";
import itmTradingAd from "../../ad-assets/ad-itmtrading.JPG";

type WeatherStatus = {
  label: string;
  temperature?: number;
  condition?: string;
  windSpeed?: number;
  updatedAt?: string;
  loading: boolean;
};

type WeatherResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
};

const itmTradingUrl = "https://www.itmtrading.com/";
const mintedMetalUrl = "https://mintedmetal.com";
const stockTickerSymbols = [
  "FOREXCOM:SPXUSD",
  "FOREXCOM:NSXUSD",
  "NASDAQ:AAPL",
  "NASDAQ:MSFT",
  "NASDAQ:NVDA",
  "NASDAQ:AMZN",
  "NASDAQ:GOOGL",
  "NASDAQ:META",
  "NASDAQ:TSLA",
  "NYSE:JNJ",
].join(",");
const metalSymbols = {
  gold: "Au",
  silver: "Ag",
  platinum: "Pt",
  palladium: "Pd",
} as const;

export function TopTicker({ county }: { county?: CountySite }) {
  return (
    <section className="market-weather-stack" aria-label="Market ticker and local weather">
      <div className="market-weather-bar">
        <TradingViewTicker />
      </div>
      <PreciousMetalsTicker />
      <CattleTicker />
      {county ? (
        <div className="market-weather-weather-bar">
          <CountyWeather county={county} />
        </div>
      ) : null}
    </section>
  );
}

function TradingViewTicker() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    container.textContent = "";

    void loadTickerTape().then(() => {
      if (!active) return;
      const ticker = document.createElement("tv-ticker-tape");
      ticker.setAttribute("symbols", stockTickerSymbols);
      ticker.setAttribute("direction", "horizontal");
      ticker.setAttribute("item-size", "compact");
      ticker.setAttribute("show-hover", "");
      container.append(ticker);
    }).catch(() => undefined);

    return () => {
      active = false;
      container.textContent = "";
    };
  }, []);

  return <div className="tradingview-widget-container market-ticker-widget" ref={containerRef} />;
}

function loadTickerTape() {
  if (customElements.get("tv-ticker-tape")) return Promise.resolve();

  const existing = document.getElementById("tradingview-ticker-tape-script") as HTMLScriptElement | null;
  if (existing) return customElements.whenDefined("tv-ticker-tape").then(() => undefined);

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "tradingview-ticker-tape-script";
    script.type = "module";
    script.src = "https://www.tradingview-widget.com/w/en/tv-ticker-tape.js";
    script.addEventListener("load", () => {
      customElements.whenDefined("tv-ticker-tape").then(() => resolve());
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("TradingView ticker tape failed to load.")), { once: true });
    document.head.append(script);
  });
}

function PreciousMetalsTicker() {
  const [ticker, setTicker] = useState<Awaited<ReturnType<typeof fetchMetalsTicker>>>();
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const loadQuotes = () => {
      fetchMetalsTicker(controller.signal)
        .then((data) => {
          setTicker(data);
          setStatus("loaded");
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus("error");
        });
    };

    loadQuotes();
    const refresh = window.setInterval(loadQuotes, 15 * 60 * 1000);

    return () => {
      controller.abort();
      window.clearInterval(refresh);
    };
  }, []);

  const metals = ticker?.items || [
    { key: "gold", label: "Gold" },
    { key: "silver", label: "Silver" },
    { key: "platinum", label: "Platinum" },
    { key: "palladium", label: "Palladium" },
  ];

  return (
    <aside className="precious-metals-ticker" aria-label="Precious metals prices">
      <div className="precious-metals-quotes">
        {metals.map((quote) => {
          return (
            <a
              key={quote.key}
              className="precious-metal-quote"
              href={itmTradingUrl}
              target="_blank"
              rel="noreferrer sponsored"
              aria-label={`${quote.label} price, presented by ITM Trading`}
            >
              <span className={`metal-symbol metal-symbol-${quote.key}`}>{metalSymbols[quote.key]}</span>
              <span className="precious-metal-label">{quote.label}</span>
              <strong>{"price" in quote ? formatMetalPrice(quote.price) : status === "error" ? "Unavailable" : "Loading…"}</strong>
            </a>
          );
        })}
      </div>
      <div className="precious-metals-attribution">
        <a href={ticker?.provider.url || mintedMetalUrl} target="_blank" rel="noreferrer">
          {ticker?.stale ? "Last verified LBMA benchmark" : `LBMA benchmark via ${ticker?.provider.name || "Minted Metal"}`}
        </a>
        <a className="precious-metals-sponsor" href={itmTradingUrl} target="_blank" rel="noreferrer sponsored">
          <span>Presented by ITM Trading</span>
          <img src={itmTradingAd} alt="ITM Trading" />
        </a>
      </div>
    </aside>
  );
}

function formatMetalPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function CattleTicker() {
  const [ticker, setTicker] = useState<Awaited<ReturnType<typeof fetchCattleTicker>>>();
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetchCattleTicker(controller.signal)
      .then((data) => {
        setTicker(data);
        setStatus("loaded");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, []);

  const cattle = ticker?.items || [
    { key: "feeder-cattle", label: "Feeder cattle" },
    { key: "slaughter-cattle", label: "Slaughter cattle" },
  ];
  const feederBreakdown = ticker?.items.find((item) => item.key === "feeder-cattle")?.breakdown;

  return (
    <aside className="cattle-ticker" aria-label="Cattle and agriculture prices">
      <div className="cattle-ticker-summary">
        <span className="cattle-ticker-label">Cattle &amp; agriculture</span>
        <div className="cattle-ticker-items">
          {cattle.map((quote) => (
            <span key={quote.key}>
              {quote.label}: {"price" in quote ? formatCattlePrice(quote.price, quote.unit) : status === "error" ? "Unavailable" : "Loading..."}
            </span>
          ))}
        </div>
        <span className="cattle-ticker-status">{ticker?.updatedAt ? `USDA MARS ${ticker.updatedAt}` : status === "error" ? "USDA prices unavailable" : "USDA prices loading"}</span>
      </div>
      {feederBreakdown?.length ? (
        <div className="cattle-ticker-breakdown">
          <span className="cattle-ticker-breakdown-title">Feeder cattle</span>
          {feederBreakdown.map((quote) => (
              <span key={quote.label}>
                {quote.label} <strong>{formatCattlePrice(quote.price, quote.unit)}</strong>
              </span>
            ))}
          <span className="cattle-ticker-breakdown-source">USDA Market News</span>
        </div>
      ) : null}
    </aside>
  );
}

function formatCattlePrice(value: number, unit: string) {
  return `${formatMetalPrice(value)} ${unit}`;
}

function CountyWeather({ county }: { county: CountySite }) {
  const locationName = useMemo(() => weatherLocationName(county), [county]);
  const [weather, setWeather] = useState<WeatherStatus>(() => ({
    label: locationName,
    loading: true,
  }));

  useEffect(() => {
    let active = true;

    setWeather({ label: locationName, loading: true });
    fetchCountyWeather(county, locationName)
      .then((nextWeather) => {
        if (active) setWeather(nextWeather);
      })
      .catch(() => {
        if (active) setWeather({ label: locationName, condition: "Weather unavailable", loading: false });
      });

    return () => {
      active = false;
    };
  }, [county, locationName]);

  if (weather.loading) {
    return (
      <span className="weather-pill">
        <span aria-hidden="true">WX</span>
        <span>{weather.label} weather loading</span>
      </span>
    );
  }

  if (typeof weather.temperature !== "number") {
    return (
      <span className="weather-pill">
        <span aria-hidden="true">--</span>
        <span>{weather.condition || weather.label}</span>
      </span>
    );
  }

  return (
    <span className="weather-pill" title={weather.updatedAt ? `Updated ${weather.updatedAt}` : undefined}>
      <span aria-hidden="true">{weatherIcon(weather.condition)}</span>
      <strong>{weather.label}</strong>
      <span>{Math.round(weather.temperature)}{"\u00b0F"}</span>
      {weather.condition ? <span>{weather.condition}</span> : null}
      {typeof weather.windSpeed === "number" ? <span>Wind {Math.round(weather.windSpeed)} mph</span> : null}
    </span>
  );
}

async function fetchCountyWeather(county: CountySite, label: string): Promise<WeatherStatus> {
  const latitude = county.latitude;
  const longitude = county.longitude;
  if (latitude === undefined || longitude === undefined) throw new Error("County coordinates unavailable");

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code,wind_speed_10m",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto",
    forecast_days: "1",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) throw new Error("Weather request failed");
  const data = (await response.json()) as WeatherResponse;
  const current = data.current;

  return {
    label,
    temperature: current?.temperature_2m,
    condition: weatherDescription(current?.weather_code),
    windSpeed: current?.wind_speed_10m,
    updatedAt: current?.time,
    loading: false,
  };
}

function weatherLocationName(county: CountySite) {
  return county.primaryCity || getCountyMarketCity(county) || county.displayName;
}

function weatherDescription(code?: number) {
  if (code === undefined) return undefined;
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Weather";
}

function weatherIcon(condition?: string) {
  if (!condition) return "WX";
  if (condition.includes("Clear")) return "Sun";
  if (condition.includes("cloud") || condition.includes("Overcast")) return "Cloud";
  if (condition.includes("Rain") || condition.includes("Drizzle")) return "Rain";
  if (condition.includes("Snow")) return "Snow";
  if (condition.includes("Thunderstorm")) return "Storm";
  return "WX";
}

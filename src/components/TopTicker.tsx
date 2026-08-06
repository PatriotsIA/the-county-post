import { useEffect, useMemo, useRef, useState } from "react";
import { getCountyMarketCity, type CountySite } from "../data/counties";
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

type MetalQuote = {
  price: number;
  currency: string;
  change_abs: number;
};

type PreciousMetalsResponse = {
  data: Record<"gold" | "silver" | "platinum" | "palladium", MetalQuote>;
};

const itmTradingUrl = "https://www.itmtrading.com/";

export function TopTicker({ county }: { county?: CountySite }) {
  return (
    <section className="market-weather-stack" aria-label="Market ticker and local weather">
      <div className="market-weather-bar">
        <TradingViewTicker />
      </div>
      <PreciousMetalsTicker />
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

    container.textContent = "";
    if (!document.getElementById("tradingview-tickers-script")) {
      const script = document.createElement("script");
      script.id = "tradingview-tickers-script";
      script.type = "module";
      script.src = "https://widgets.tradingview-widget.com/w/en/tv-tickers.js";
      document.head.append(script);
    }

    const ticker = document.createElement("tv-tickers");
    ticker.setAttribute(
      "symbols",
      "FOREXCOM:SPXUSD,FOREXCOM:NSXUSD,FX:EURUSD,BITSTAMP:BTCUSD,BITSTAMP:ETHUSD,TVC:GOLD,CMCMARKETS:SILVERU2026,SPARKS:BEEF,COINBASE:ETHUSD,FOREXCOM:WHEAT,CAPITALCOM:COTTON,NASDAQ:TSLA,NASDAQ:AAPL",
    );
    ticker.setAttribute("hide-chart", "");
    ticker.setAttribute("item-size", "compact");
    ticker.setAttribute("show-hover", "");
    container.append(ticker);

    return () => {
      container.textContent = "";
    };
  }, []);

  return <div className="tradingview-widget-container market-ticker-widget" ref={containerRef} />;
}

function PreciousMetalsTicker() {
  const [quotes, setQuotes] = useState<PreciousMetalsResponse["data"]>();

  useEffect(() => {
    const controller = new AbortController();
    const loadQuotes = () => {
      fetch("https://aurumrates.com/api/v1/spot", { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("Metal prices unavailable");
          return response.json() as Promise<PreciousMetalsResponse>;
        })
        .then((data) => setQuotes(data.data))
        .catch(() => {
          if (!controller.signal.aborted) setQuotes(undefined);
        });
    };

    loadQuotes();
    const refresh = window.setInterval(loadQuotes, 30 * 60 * 1000);

    return () => {
      controller.abort();
      window.clearInterval(refresh);
    };
  }, []);

  const metals = [
    ["gold", "Gold"],
    ["silver", "Silver"],
    ["platinum", "Platinum"],
    ["palladium", "Palladium"],
  ] as const;

  return (
    <aside className="precious-metals-ticker" aria-label="Precious metals prices">
      <div className="precious-metals-quotes">
        {metals.map(([key, label]) => {
          const quote = quotes?.[key];
          const change = quote?.change_abs;

          return (
            <a
              key={key}
              className="precious-metal-quote"
              href={itmTradingUrl}
              target="_blank"
              rel="noreferrer sponsored"
              aria-label={`${label} price, presented by ITM Trading`}
            >
              <span>{label}</span>
              <strong>{quote ? formatMetalPrice(quote.price) : "Loading…"}</strong>
              {change !== undefined ? (
                <small className={change >= 0 ? "positive" : "negative"}>
                  {change >= 0 ? "+" : "−"}{formatMetalPrice(Math.abs(change))}
                </small>
              ) : null}
            </a>
          );
        })}
      </div>
      <a className="precious-metals-sponsor" href={itmTradingUrl} target="_blank" rel="noreferrer sponsored">
        <span>Presented by ITM Trading</span>
        <img src={itmTradingAd} alt="ITM Trading" />
      </a>
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

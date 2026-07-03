import { useEffect, useMemo, useRef, useState } from "react";
import { getCountyMarketCity, type CountySite } from "../data/counties";
import { PresentedByPreview } from "./AdPreviewPlaceholder";

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

const marketSymbols = [
  { proName: "AMEX:SPY", title: "S&P 500" },
  { proName: "NASDAQ:QQQ", title: "Nasdaq 100" },
  { proName: "AMEX:GLD", title: "Gold" },
  { proName: "AMEX:SLV", title: "Silver" },
  { proName: "AMEX:DBA", title: "Agriculture" },
  { proName: "AMEX:CORN", title: "Corn" },
  { proName: "AMEX:WEAT", title: "Wheat" },
  { proName: "AMEX:USO", title: "Crude Oil" },
  { proName: "NYSE:CVX", title: "Chevron" },
  { proName: "NASDAQ:TSLA", title: "Tesla" },
];

export function TopTicker({ county }: { county?: CountySite }) {
  return (
    <section className="market-weather-stack" aria-label="Market ticker and local weather">
      <div className="market-weather-bar">
        <TradingViewTicker />
      </div>
      <div className="market-weather-bar crypto-weather-bar">
        <CryptoTicker />
      </div>
      {county ? (
        <div className="market-weather-weather-bar">
          <CountyWeather county={county} />
          <PresentedByPreview pricingKey="weather-sponsor" label="Weather sponsor" />
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
    const widgetRoot = document.createElement("div");
    widgetRoot.className = "tradingview-widget-container__widget";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      symbols: marketSymbols,
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "light",
      locale: "en",
    });

    container.append(widgetRoot, script);

    return () => {
      container.textContent = "";
    };
  }, []);

  return <div className="tradingview-widget-container market-ticker-widget" ref={containerRef} />;
}

function CryptoTicker() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.textContent = "";
    const widgetRoot = document.createElement("div");
    widgetRoot.className = "livecoinwatch-widget-5";
    widgetRoot.setAttribute("lcw-base", "USD");
    widgetRoot.setAttribute("lcw-color-tx", "#555555");
    widgetRoot.setAttribute("lcw-marquee-1", "coins");
    widgetRoot.setAttribute("lcw-marquee-2", "movers");
    widgetRoot.setAttribute("lcw-marquee-items", "10");

    const script = document.createElement("script");
    script.src = "https://www.livecoinwatch.com/static/lcw-widget.js";
    script.defer = true;

    container.append(widgetRoot, script);

    return () => {
      container.textContent = "";
    };
  }, []);

  return <div className="crypto-ticker-widget" ref={containerRef} />;
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

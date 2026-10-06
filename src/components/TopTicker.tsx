import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { type CountySite } from "../data/counties";
import {
  weatherSeverityClass,
} from "../lib/county-weather-api";
import { fetchCattleTicker } from "../lib/markets-api";
import { useCountyWeather } from "../lib/useCountyWeather";
import itmTradingAd from "../../ad-assets/itm-trading-logo.jpg";
import { LoadingIndicator } from "./LoadingIndicator";
import { CountyNoticeTicker } from "./CountyNoticeTicker";

const stockTickerSymbols =
  "FOREXCOM:SPXUSD,FOREXCOM:NSXUSD,FOREXCOM:DJI,FX:EURUSD,BITSTAMP:BTCUSD,BITSTAMP:ETHUSD,CMCMARKETS:GOLD,NASDAQ:NVDA,EASYMARKETS:OILUSD,NASDAQ:AAPL,NASDAQ:AMZN,NASDAQ:MSFT,NASDAQ:META,NASDAQ:AMD,NASDAQ:PLTR,NASDAQ:GOOGL,NASDAQ:NFLX,NYSE:DELL,NYSE:XOM,NYSE:JPM,NYSE:BAC";
const metalTickerSymbols = "OANDA:XAUUSD,OANDA:XAGUSD,OANDA:XPTUSD,OANDA:XPDUSD";
export function TopTicker({
  county,
  defaultOpen = false,
}: {
  county?: CountySite;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(() => defaultOpen && (typeof window === "undefined" || window.innerWidth > 720));
  const panelId = "market-data-panel";

  useEffect(() => {
    setIsOpen(defaultOpen && window.innerWidth > 720);
  }, [defaultOpen]);

  return (
    <section className="market-panel" aria-label="Market data and local weather">
      <button
        type="button"
        className="market-panel-toggle"
        aria-controls={panelId}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>
          <strong>Market desk</strong>
          <span>Stocks, metals, cattle &amp; local weather</span>
        </span>
        <span className="market-panel-toggle-state">{isOpen ? "Hide" : "Show"} <span aria-hidden="true">{isOpen ? "−" : "+"}</span></span>
      </button>
      <div id={panelId} className="market-panel-content" hidden={!isOpen}>
        <div className="market-weather-stack">
          <div className="market-weather-bar">
            <TradingViewTicker active={isOpen} />
          </div>
          <aside className="precious-metals-ticker" aria-label="Metal spot prices">
            <div className="metals-ticker-heading">
              <div><strong>Metals spot prices</strong><small>Gold, silver, platinum &amp; palladium · USD / troy oz</small></div>
              <Link className="metals-desk-link" to="/itm-trading">
                <img src={itmTradingAd} alt="ITM Trading" width="40" height="25" />
                <span>Meet our sponsor <span aria-hidden="true">→</span></span>
              </Link>
            </div>
            <TradingViewTicker active={isOpen} symbols={metalTickerSymbols} label="Metal spot prices" />
          </aside>
          <CattleTicker />
          {county ? <CountyWeather county={county} /> : null}
          {county ? <CountyNoticeTicker key={county.fips} county={county} active={isOpen} /> : null}
        </div>
      </div>
    </section>
  );
}

function TradingViewTicker({ active, symbols = stockTickerSymbols, label = "Market prices" }: { active: boolean; symbols?: string; label?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !active) return;
    let mounted = true;
    container.textContent = "";
    setStatus("loading");

    void loadTickerTape().then(() => {
      if (!mounted) return;
      const ticker = document.createElement("tv-ticker-tape");
      ticker.setAttribute("symbols", symbols);
      container.append(ticker);
      setStatus("loaded");
    }).catch(() => {
      if (mounted) setStatus("error");
    });

    return () => {
      mounted = false;
      container.textContent = "";
    };
  }, [active, symbols]);

  return (
    <div className="tradingview-widget-container market-ticker-widget">
      {status === "loading" ? <LoadingIndicator label={`Loading ${label.toLowerCase()}…`} size="inline" /> : null}
      {status === "error" ? <span className="muted" role="status">{label} unavailable.</span> : null}
      <div className="market-ticker-widget-content" ref={containerRef} />
    </div>
  );
}

let tickerTapePromise: Promise<void> | undefined;
let tickerTapeAttempt = 0;

function loadTickerTape() {
  if (customElements.get("tv-ticker-tape")) return Promise.resolve();
  if (tickerTapePromise) return tickerTapePromise;

  tickerTapePromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "tradingview-ticker-tape-script";
    script.type = "module";
    const url = "https://widgets.tradingview-widget.com/w/en/tv-ticker-tape.js";
    const attempt = tickerTapeAttempt++;
    // Browsers remember failed module loads. A fresh entry URL permits a retry.
    script.src = attempt ? `${url}?retry=${attempt}` : url;
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("TradingView ticker tape failed to load."));
    };
    const timeout = window.setTimeout(fail, 15_000);
    script.addEventListener("load", () => {
      customElements.whenDefined("tv-ticker-tape").then(() => {
        window.clearTimeout(timeout);
        resolve();
      });
    }, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.append(script);
  }).catch((error) => {
    tickerTapePromise = undefined;
    throw error;
  });
  return tickerTapePromise;
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
      {status === "loading" ? (
        <LoadingIndicator label="Loading cattle and agriculture prices…" size="inline" />
      ) : (
        <div className="cattle-ticker-summary">
          <span className="cattle-ticker-label">Cattle &amp; agriculture</span>
          <div className="cattle-ticker-items">
            {cattle.map((quote) => (
              <span key={quote.key}>
                {quote.label}: {"price" in quote ? formatCattlePrice(quote.price, quote.unit) : "Unavailable"}
              </span>
            ))}
          </div>
          <span className="cattle-ticker-status">{ticker?.updatedAt ? `USDA MARS ${ticker.updatedAt}` : "USDA prices unavailable"}</span>
        </div>
      )}
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
  const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  return `${price} ${unit}`;
}

function CountyWeather({ county }: { county: CountySite }) {
  const weatherPath = `/${county.state.slug}/${county.slug}/weather`;
  const weather = useCountyWeather(county.state.slug, county.slug);
  const observation = weather.data?.currentObservation;
  const locationName = weather.data?.location.city || county.primaryCity || county.displayName;
  const alerts = weather.data?.alerts || [];
  const drought = weather.data?.droughtCondition;
  const temperature = observation?.temperature?.value;
  const condition = observation?.textDescription;

  return (
    <>
      <div className="market-weather-weather-bar">
        <Link
          className="weather-pill"
          to={weatherPath}
          title={observation?.observedAt ? `Observed ${formatTickerTime(observation.observedAt)}` : undefined}
        >
          <span aria-hidden="true">{weatherIcon(condition)}</span>
          {weather.status === "loading" && !weather.data ? (
            <LoadingIndicator label={`Loading ${locationName} weather…`} size="inline" />
          ) : weather.status === "error" ? (
            <span>{locationName} weather unavailable</span>
          ) : (
            <>
              <strong>{locationName}</strong>
              {typeof temperature === "number" ? <span>{Math.round(temperature)}{"\u00b0F"}</span> : null}
              {condition ? <span>{condition}</span> : <span>Current observation unavailable</span>}
              {typeof observation?.windSpeed?.value === "number" ? (
                <span>Wind {Math.round(observation.windSpeed.value)} mph</span>
              ) : null}
            </>
          )}
        </Link>
      </div>
      {alerts.map((alert) => (
        <aside
          key={alert.id}
          className={`county-weather-alert weather-severity-${weatherSeverityClass(alert.severity)}`}
          role="alert"
          aria-live="polite"
        >
          <span className="county-weather-alert-label">{alert.severity || "Unknown"} weather alert</span>
          <Link to={weatherPath}>
            <strong>{alert.headline || alert.event}</strong>
            {alert.expires ? <span>Expires {formatTickerTime(alert.expires)}</span> : null}
          </Link>
        </aside>
      ))}
      {drought ? (
        <aside
          className={`county-weather-alert county-drought-condition drought-category-${drought.category.toLowerCase()}`}
          role="status"
          aria-live="polite"
        >
          <span className="county-weather-alert-label">USDM {drought.category}</span>
          <Link to={weatherPath}>
            <strong>
              {drought.label} affects {formatDroughtPercent(drought.areaPercent)} of {county.displayName}
            </strong>
            <span>Map updated {formatTickerDate(drought.mapDate)}</span>
          </Link>
        </aside>
      ) : null}
    </>
  );
}

function weatherIcon(condition?: string) {
  if (!condition) return "WX";
  const normalized = condition.toLowerCase();
  if (normalized.includes("clear") || normalized.includes("sunny")) return "Sun";
  if (normalized.includes("cloud") || normalized.includes("overcast")) return "Cloud";
  if (normalized.includes("rain") || normalized.includes("drizzle")) return "Rain";
  if (normalized.includes("snow")) return "Snow";
  if (normalized.includes("thunder")) return "Storm";
  return "WX";
}

function formatTickerTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTickerDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDroughtPercent(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

import { useEffect, useRef, useState } from "react";
import { LoadingIndicator } from "./LoadingIndicator";

const TICKER_MESSAGE = "county-post-market-ticker";

/**
 * TradingView's ticker runs in its own frame. Inside our page, its twenty mini
 * charts and the observers they put on the body kept resizing each other, which
 * the browser reports as "ResizeObserver loop completed with undelivered
 * notifications" and which forced extra layout passes over the whole page. The
 * frame keeps that work in its own document; each attempt also gets a fresh
 * module map, so a failed load retries. The frame is not sandboxed: an opaque
 * origin makes TradingView refuse its price connection.
 */
function tickerDocument(symbols: string, single: boolean) {
  const tag = single ? "tv-single-ticker" : "tv-ticker-tape";
  const moduleUrl = "https://widgets.tradingview-widget.com/w/en/" + tag + ".js";
  const script = `
const report = (status) => parent.postMessage({ source: ${JSON.stringify(TICKER_MESSAGE)}, status }, "*");
const timeout = setTimeout(() => report("error"), 15000);
import(${JSON.stringify(moduleUrl)})
  .then(() => customElements.whenDefined(${JSON.stringify(tag)}))
  .then(() => {
    clearTimeout(timeout);
    const ticker = document.createElement(${JSON.stringify(tag)});
    ticker.setAttribute(${JSON.stringify(single ? "symbol" : "symbols")}, ${JSON.stringify(symbols)});
    document.body.append(ticker);
    report("loaded");
  }, () => { clearTimeout(timeout); report("error"); });`;
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>html,body{margin:0;overflow:hidden;background:transparent}tv-ticker-tape,tv-single-ticker{display:block}</style></head>
<body><script type="module">${script.replace(/<\//g, "<\\/")}</script></body></html>`;
}

export function TradingViewTicker({
  active,
  symbols,
  single = false,
  label = "Market prices",
}: {
  active: boolean;
  symbols: string;
  single?: boolean;
  label?: string;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    if (!active) return;
    setStatus("loading");
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || event.data?.source !== TICKER_MESSAGE) return;
      setStatus(event.data.status === "loaded" ? "loaded" : "error");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [active, symbols, single]);

  return (
    <div className={single ? "market-single-quote" : "tradingview-widget-container market-ticker-widget"}>
      {status === "loading" ? (
        <LoadingIndicator label={`Loading ${label.toLowerCase()}…`} size="inline" />
      ) : null}
      {status === "error" ? (
        <span className="muted" role="status">
          {label} unavailable.
        </span>
      ) : null}
      <div className="market-ticker-widget-content">
        {active && status !== "error" ? (
          <iframe
            ref={frameRef}
            className={single ? "market-quote-frame" : "market-ticker-frame"}
            title={`${label} ticker by TradingView`}
            srcDoc={tickerDocument(symbols, single)}
          />
        ) : null}
      </div>
      {single && (
        <a
          href={"https://www.tradingview.com/symbols/" + symbols.replace(":", "-") + "/"}
          target="_blank"
          rel="noreferrer"
        >
          {label} on TradingView
        </a>
      )}
    </div>
  );
}

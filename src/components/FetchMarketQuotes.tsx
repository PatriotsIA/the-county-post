import { useState } from "react";
import { Link } from "react-router-dom";
import { marketInstruments, marketQuoteId } from "../data/market-instruments";
import { TradingViewTicker } from "./TradingViewTicker";

export function FetchMarketQuotes({
  symbols,
  base,
  onNavigate,
}: {
  symbols: string[];
  base: string;
  onNavigate: () => void;
}) {
  const [selected, setSelected] = useState("");
  const shown = marketInstruments.filter((m) =>
    symbols.length ? symbols.includes(m.symbol) : m.symbol === selected,
  );
  return (
    <div>
      {!symbols.length && (
        <label>
          Market symbol
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Choose a quote</option>
            {marketInstruments.map((m) => (
              <option key={m.symbol} value={m.symbol}>
                {m.name} · {m.ticker}
              </option>
            ))}
          </select>
        </label>
      )}
      {shown.length > 0 && <small>Exchange quotes may be delayed.</small>}
      {shown.map((m) => (
        <section key={m.symbol}>
          <h4>
            {m.name} · {m.ticker}
          </h4>
          <TradingViewTicker active single symbols={m.symbol} label={m.name} />
          <Link to={base + "#" + marketQuoteId(m.ticker)} onClick={onNavigate}>
            Show {m.name} on the Market desk
          </Link>
        </section>
      ))}
    </div>
  );
}

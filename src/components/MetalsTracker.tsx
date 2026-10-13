import { useState } from "react";
import { useMetalsPrices } from "../lib/useMetalsPrices";
import { LoadingIndicator } from "./LoadingIndicator";
import { itmTrading } from "../data/itm-trading";

const metals = [
  { key: "gold", symbol: "Au", name: "Gold" },
  { key: "silver", symbol: "Ag", name: "Silver" },
  { key: "platinum", symbol: "Pt", name: "Platinum" },
  { key: "palladium", symbol: "Pd", name: "Palladium" },
] as const;
type Metal = typeof metals[number]["key"];
const units = {
  oz: { label: "Troy ounce", short: "troy oz", factor: 1 },
  g: { label: "Gram", short: "g", factor: 1 / 31.1034768 },
  kg: { label: "Kilogram", short: "kg", factor: 1000 / 31.1034768 },
};
type Unit = keyof typeof units;
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const date = (value?: string) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC" : "Date not supplied";

export function MetalsTracker() {
  const { ticker, status, stale: cached, now, refresh } = useMetalsPrices();
  const [unit, setUnit] = useState<Unit>("oz");
  const [selected, setSelected] = useState<Metal>("gold");
  const [quantity, setQuantity] = useState("1");

  const factor = units[unit].factor;
  const gold = ticker?.items.find(item => item.key === "gold");
  const silver = ticker?.items.find(item => item.key === "silver");
  const quote = ticker?.items.find(item => item.key === selected);
  const ratio = gold && silver ? gold.price / silver.price : undefined;
  const amount = Number(quantity);
  const validAmount = quantity.trim() !== "" && Number.isFinite(amount) && amount > 0 && amount <= 1_000_000;
  const estimate = quote && validAmount ? quote.price * factor * amount : undefined;

  return (
    <section id="metal-prices" className="itm-tracker" aria-labelledby="metals-title">
      <header className="itm-section-heading">
        <div><p className="kicker">The precious metals desk</p><h2 id="metals-title">Follow the metals.</h2><p>Gold, silver, platinum &amp; palladium · USD</p></div>
        <div className="itm-controls">
          <label>Price unit<select value={unit} onChange={event => setUnit(event.target.value as Unit)}>{Object.entries(units).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}</select></label>
          <button className="itm-button itm-button-light" type="button" disabled={status === "loading"} onClick={refresh}>{status === "loading" ? "Checking…" : "Refresh prices"}</button>
        </div>
      </header>
      <p className="itm-price-notice"><strong>Spot reference prices · USD per troy ounce.</strong> Estimates exclude dealer premiums, fees and taxes. For ITM’s retail quotes and product availability, <a href={itmTrading.websiteUrl} target="_blank" rel="noreferrer sponsored">visit ITM Trading</a>.</p>
      {status === "loading" && !ticker ? <LoadingIndicator label="Loading precious metal spot prices…" /> : null}
      {status === "error" && !ticker ? <p role="alert" className="itm-status">Prices are unavailable right now. Try Refresh prices, or contact ITM for a quote.</p> : null}
      {cached ? <p role="status" className="itm-status">Showing the last available spot quotes with their original timestamps. Prices may be delayed, or the market may be closed.</p> : null}

      <div className="itm-quote-grid">
        {metals.map(metal => {
          const item = ticker?.items.find(value => value.key === metal.key);
          const change = item?.previousPrice ? item.price - item.previousPrice : undefined;
          const percent = change !== undefined && item?.previousPrice ? change / item.previousPrice * 100 : undefined;
          const oldQuote = item?.quotedAt && now - Date.parse(item.quotedAt) > 15 * 60 * 1000;
          return <article className="card itm-quote" key={metal.key} aria-label={`${metal.name} spot price`}>
            <div className="itm-quote-heading"><h3>{metal.name}</h3><span className="itm-element" aria-hidden="true">{metal.symbol}</span></div>
            <p className="itm-price">{item ? money(item.price * factor) : "Unavailable"}</p><p className="itm-unit">USD / {units[unit].short}</p>
            <p className={`itm-change ${change === undefined || change === 0 ? "" : change < 0 ? "itm-down" : "itm-up"}`}>
              {change !== undefined && percent !== undefined ? `${change > 0 ? "+" : change < 0 ? "−" : ""}${money(Math.abs(change) * factor)} (${percent > 0 ? "+" : ""}${percent.toFixed(2)}%)` : "Change unavailable"}
            </p>
            <p className="itm-small">Since the previous saved quote</p>
            <div className="itm-fixing"><span>Spot reference quote</span><time dateTime={item?.quotedAt}>{item?.quotedAt ? date(item.quotedAt) : "Quote time unavailable"}</time>{oldQuote ? <strong>Older quote — market may be closed.</strong> : null}</div>
          </article>;
        })}
      </div>
      <p className="itm-provenance">Prices by <a href="https://gold-api.com" target="_blank" rel="noreferrer">Gold-API.com</a> · USD / troy oz<br />Last checked: <time dateTime={ticker?.fetchedAt}>{date(ticker?.fetchedAt)}</time>. Each metal carries its own quote time. Checks every minute while this page is visible.</p>

      <div className="itm-analysis-grid">
        <section className="card itm-analysis" aria-labelledby="metals-compare-title">
          <p className="kicker">Price comparison</p><h3 id="metals-compare-title">Previous &amp; latest</h3>
          <label>Metal<select value={selected} onChange={event => setSelected(event.target.value as Metal)}>{metals.map(metal => <option key={metal.key} value={metal.key}>{metal.name}</option>)}</select></label>
          {quote?.previousPrice ? <figure className="itm-comparison">
            <figcaption>{metals.find(metal => metal.key === selected)?.name} · USD / {units[unit].short}</figcaption>
            {[{ label: "Previous", value: quote.previousPrice }, { label: "Latest", value: quote.price }].map(point => <div className="itm-bar-row" key={point.label}><span>{point.label}</span><div className="itm-bar-track"><span style={{ width: `${point.value / Math.max(quote.price, quote.previousPrice!) * 100}%` }} /></div><strong>{money(point.value * factor)}</strong></div>)}
            <p className="itm-small">Previous saved quote: {date(quote.previousQuotedAt)}. This comparison is not a daily or 24-hour change.</p>
          </figure> : <p className="itm-small">A comparison will appear when both quotes are available.</p>}
          <div className="itm-ratio"><span>Gold / silver ratio</span><strong>{ratio ? `${ratio.toFixed(2)} : 1` : "Unavailable"}</strong><p className="itm-small">Troy ounces of silver equal in spot reference value to one troy ounce of gold. Calculated from the prices above; quote timestamps may differ.</p></div>
        </section>
        <section className="card itm-analysis" aria-labelledby="metals-calc-title">
          <p className="kicker">Explore a quantity</p><h3 id="metals-calc-title">Metal value calculator</h3>
          <p className="itm-small">Uses the selected metal and price unit. Enter the fine metal weight, not the total weight of a coin or bar.</p>
          <div className="itm-calculator-inputs"><label>Quantity ({units[unit].short})<input type="number" min="0.000001" max="1000000" step="any" value={quantity} onChange={event => setQuantity(event.target.value)} /></label></div>
          {!validAmount ? <p className="itm-small" role="status">Enter a quantity above zero and at most 1,000,000.</p> : null}
          <output className="itm-estimate" aria-live="polite"><span>{metals.find(metal => metal.key === selected)?.name} spot reference value</span><strong>{estimate !== undefined ? money(estimate) : "Unavailable"}</strong></output>
          <p className="itm-small">Excludes dealer premiums, collectible value, fees and taxes. This is a reference calculation, not a purchase or buyback quote. {cached ? "Uses the last available spot quotes." : ""}</p>
          <a className="itm-text-link" href="#stan-roberts">Ask Stan about a product quote <span aria-hidden="true">→</span></a>
        </section>
      </div>
      <details className="itm-methodology"><summary>How to read these prices</summary><p>Gold, silver, platinum and palladium are quoted in U.S. dollars per troy ounce. One troy ounce is 31.1034768 grams; gram and kilogram prices are calculated from that unit. Changes compare the latest quote with our previous saved quote, not a daily close or rolling 24-hour period.</p><p>Quote times are supplied by the provider and may pause over weekends and holidays. Last checked records when we fetched the prices; it does not make an older quote current. Retail coins and bars may trade above their metal value; collectible coins can also carry a numismatic premium.</p></details>
    </section>
  );
}

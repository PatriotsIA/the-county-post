import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { type CountySite, searchCounties } from "../data/counties";
import { adAssetSpecs, countyRateTiers, formatAdPrice, monthlyCountyPlacementPrice } from "../data/ad-pricing";
import { fetchCountyPopulation, startAdvertiserCheckout, uploadAdCreative } from "../lib/checkout-api";

type Placement = "color-card" | "section-sponsorship";
type Billing = "monthly" | "annual";
type SelectedCounty = {
  county: CountySite;
  population: number;
  estimateVintage: number;
};

export function PaymentsPage() {
  const [placement, setPlacement] = useState<Placement>("color-card");
  const [billing, setBilling] = useState<Billing>("monthly");
  const [businessName, setBusinessName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [countyQuery, setCountyQuery] = useState("");
  const [counties, setCounties] = useState<SelectedCounty[]>([]);
  const [creative, setCreative] = useState<File>();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const matches = useMemo(() => (countyQuery.trim().length > 1 ? searchCounties(countyQuery, 8) : []), [countyQuery]);
  const monthlyTotal = useMemo(
    () =>
      counties
        .map(({ population }) => monthlyCountyPlacementPrice(population, placement))
        .sort((left, right) => right - left)
        .reduce((total, rate, index) => total + (index === 0 ? rate : rate / 2), 0),
    [counties, placement],
  );
  const checkoutTotal = billing === "annual" ? monthlyTotal * 10 : monthlyTotal;

  const addCounty = async (county: CountySite) => {
    if (counties.some(({ county: selected }) => selected.fips === county.fips)) return;
    setStatus("loading");
    setMessage("");
    try {
      const population = await fetchCountyPopulation(county.state.slug, county.slug);
      setCounties((current) => [...current, { county, population: population.population, estimateVintage: population.estimateVintage }]);
      setCountyQuery("");
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to look up this county.");
    }
  };

  const checkout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!counties.length) {
      setStatus("error");
      setMessage("Choose at least one county for your advertisement.");
      return;
    }

    setStatus("loading");
    setMessage(creative ? "Uploading your creative, then opening secure checkout…" : "Opening secure checkout…");
    try {
      const creativeAssetKey = creative ? await uploadAdCreative(creative) : undefined;
      const checkoutSession = await startAdvertiserCheckout({
        placement,
        billing,
        counties: counties.map(({ county }) => ({ stateSlug: county.state.slug, countySlug: county.slug })),
        customerEmail,
        businessName,
        creativeAssetKey,
      });
      window.location.assign(checkoutSession.url);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to start secure checkout.");
    }
  };

  return (
    <div className="layout-grid payments-page">
      <section className="hero-card payments-hero">
        <p className="kicker">Advertiser rates</p>
        <h1>Put your business on the Post</h1>
        <p className="lead">
          Build your county campaign, upload creative, and continue to Stripe’s secure checkout. Rates use the latest Census county population estimate.
        </p>
      </section>

      <section id="checkout" className="card payments-block">
        <p className="kicker">Secure checkout</p>
        <h2>Build your advertising order</h2>
        <form className="checkout-form" onSubmit={checkout}>
          <div className="checkout-options">
            <label>
              Placement
              <select value={placement} onChange={(event) => setPlacement(event.target.value as Placement)}>
                <option value="color-card">Local color card</option>
                <option value="section-sponsorship">Exclusive section sponsorship (includes a card)</option>
              </select>
            </label>
            <label>
              Billing
              <select value={billing} onChange={(event) => setBilling(event.target.value as Billing)}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual — 12 months for the price of 10</option>
              </select>
            </label>
          </div>

          <label>
            Business name
            <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={120} required />
          </label>
          <label>
            Contact email
            <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} required />
          </label>
          <label>
            Upload ad creative (JPG or PNG, up to 10 MB)
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={(event) => setCreative(event.target.files?.[0])}
            />
            <span className="checkout-input-help">Creative is uploaded privately before you are redirected to Stripe. You may also provide it after checkout.</span>
          </label>

          <div className="county-picker">
            <label>
              Add a county
              <input value={countyQuery} onChange={(event) => setCountyQuery(event.target.value)} placeholder="Search county or state" />
            </label>
            {matches.length ? (
              <div className="county-search-results">
                {matches.map((county) => (
                  <button key={county.fips} type="button" onClick={() => void addCounty(county)} disabled={status === "loading"}>
                    {county.displayName}, {county.state.abbr}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="checkout-counties" aria-live="polite">
            <h3>Selected counties</h3>
            {counties.length ? (
              <ul>
                {counties.map(({ county, population, estimateVintage }) => (
                  <li key={county.fips}>
                    <span>
                      <strong>{county.displayName}, {county.state.abbr}</strong>
                      <small>Population {population.toLocaleString("en-US")} (Census {estimateVintage})</small>
                    </span>
                    <button type="button" onClick={() => setCounties((current) => current.filter(({ county: selected }) => selected.fips !== county.fips))}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Search and add the counties where you want your advertisement displayed.</p>
            )}
          </div>

          <div className="checkout-summary">
            <span>{placement === "color-card" ? "Color card" : "Section sponsorship"} · {billing === "annual" ? "Annual plan" : "Monthly plan"}</span>
            <strong>{formatAdPrice(checkoutTotal)}{billing === "annual" ? "/year" : "/month"}</strong>
            {counties.length > 1 ? <small>Highest-priced county is full rate; additional counties are 50% of their tier rate.</small> : null}
          </div>
          {message ? <p className={status === "error" ? "error" : "muted"}>{message}</p> : null}
          <button className="button primary checkout-button" type="submit" disabled={status === "loading" || !counties.length}>
            {status === "loading" ? "Preparing checkout…" : "Continue to secure Stripe checkout"}
          </button>
        </form>
      </section>

      <section className="card payments-block">
        <p className="kicker">County inventory</p>
        <h2>Monthly rates by county size</h2>
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr>
                <th scope="col">County population</th>
                <th scope="col">Color card / month</th>
                <th scope="col">Section sponsorship / month</th>
              </tr>
            </thead>
            <tbody>
              {countyRateTiers.map((tier) => (
                <tr key={tier.population}>
                  <td data-label="County population">{tier.population}</td>
                  <td data-label="Color card / month">{formatAdPrice(tier.colorCardMonthly)}</td>
                  <td data-label="Section sponsorship / month">{formatAdPrice(tier.sectionSponsorMonthly)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card payments-block">
        <p className="kicker">Creative &amp; launch</p>
        <h2>Getting started</h2>
        <ul className="payments-list">
          <li><strong>Color card:</strong> {adAssetSpecs.square}.</li>
          <li><strong>Network band:</strong> {adAssetSpecs.banner}.</li>
          <li><strong>Review:</strong> payment reserves your request; creative and exclusive placement availability are confirmed by the ad team.</li>
        </ul>
        <Link className="button-link" to="/advertise">View advertiser placement previews</Link>
      </section>
    </div>
  );
}

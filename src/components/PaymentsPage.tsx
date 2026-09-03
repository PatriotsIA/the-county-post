import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ANNUAL_BILLED_MONTHS,
  STATE_AD_RATE_PER_COUNTY,
  STATE_FEED_SPONSOR_RATE_PER_COUNTY,
  adAssetSpecs,
  checkoutPrice,
  countyRateTiers,
  formatAdPrice,
  monthlyCountyPlacementPrice,
  monthlyStatePlacementPrice,
  sponsorableFeeds,
  type BillingCadence,
  type CampaignScope,
  type CountyPlacement,
  type SponsorableFeed,
  type StatePlacement,
} from "../data/ad-pricing";
import { advertiserContact } from "../data/advertiser-contact";
import { getCountiesForState, searchCounties, type CountySite } from "../data/counties";
import { searchStates, type StateSite } from "../data/states";
import { fetchCountyPopulation, startAdvertiserCheckout, uploadAdCreative } from "../lib/checkout-api";
import { AdvertiserPlacementShowcase } from "./AdvertiserPlacementShowcase";

type SelectedCounty = {
  county: CountySite;
  population: number;
  estimateVintage: number;
};

type SelectedState = {
  state: StateSite;
  countyCount: number;
};

export function PaymentsPage() {
  const [searchParams] = useSearchParams();
  const [scope, setScope] = useState<CampaignScope>("county");
  const [countyPlacement, setCountyPlacement] = useState<CountyPlacement>("color-card");
  const [statePlacement, setStatePlacement] = useState<StatePlacement>("state-ad");
  const [billing, setBilling] = useState<BillingCadence>("monthly");
  const [businessName, setBusinessName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [countyQuery, setCountyQuery] = useState("");
  const [stateQuery, setStateQuery] = useState("");
  const [counties, setCounties] = useState<SelectedCounty[]>([]);
  const [selectedStates, setSelectedStates] = useState<SelectedState[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<SponsorableFeed[]>(["general"]);
  const [creative, setCreative] = useState<File>();
  const [creativeUrl, setCreativeUrl] = useState<string>();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const countyMatches = useMemo(
    () => (countyQuery.trim().length > 1 ? searchCounties(countyQuery, 8) : []),
    [countyQuery],
  );
  const stateMatches = useMemo(
    () => (stateQuery.trim().length ? searchStates(stateQuery, 8) : []),
    [stateQuery],
  );
  const stateCountyCount = selectedStates.reduce((total, selection) => total + selection.countyCount, 0);
  const monthlyTotal = useMemo(() => {
    if (scope === "state") {
      return monthlyStatePlacementPrice(stateCountyCount, statePlacement, selectedFeeds.length);
    }

    return counties
      .map(({ population }) => monthlyCountyPlacementPrice(population, countyPlacement))
      .sort((left, right) => right - left)
      .reduce((total, rate, index) => total + (index === 0 ? rate : rate / 2), 0);
  }, [counties, countyPlacement, scope, selectedFeeds.length, stateCountyCount, statePlacement]);
  const total = checkoutPrice(monthlyTotal, billing);
  const needsFeeds = scope === "state" && statePlacement === "state-feed-sponsorship";
  const hasSelection = scope === "county" ? counties.length > 0 : selectedStates.length > 0 && (!needsFeeds || selectedFeeds.length > 0);
  const checkoutResult = searchParams.get("checkout");

  useEffect(() => {
    if (!creative) {
      setCreativeUrl(undefined);
      return;
    }

    const url = URL.createObjectURL(creative);
    setCreativeUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [creative]);

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

  const addState = (state: StateSite) => {
    if (selectedStates.some(({ state: selected }) => selected.slug === state.slug)) return;
    setSelectedStates((current) => [...current, { state, countyCount: getCountiesForState(state.slug).length }]);
    setStateQuery("");
  };

  const toggleFeed = (feed: SponsorableFeed) => {
    setSelectedFeeds((current) => current.includes(feed) ? current.filter((key) => key !== feed) : [...current, feed]);
  };

  const checkout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasSelection) {
      setStatus("error");
      setMessage(scope === "county" ? "Choose at least one county." : needsFeeds ? "Choose at least one state and feed." : "Choose at least one state.");
      return;
    }

    setStatus("loading");
    setMessage(creative ? "Uploading your creative, then opening secure checkout…" : "Opening secure checkout…");
    try {
      const creativeAssetKey = creative ? await uploadAdCreative(creative) : undefined;
      const contact = {
        billing,
        customerEmail,
        businessName,
        ...(referredBy.trim() ? { referredBy: referredBy.trim() } : {}),
        creativeAssetKey,
      };
      const checkoutSession =
        scope === "county"
          ? await startAdvertiserCheckout({
              ...contact,
              scope,
              placement: countyPlacement,
              counties: counties.map(({ county }) => ({ stateSlug: county.state.slug, countySlug: county.slug })),
            })
          : await startAdvertiserCheckout({
              ...contact,
              scope,
              placement: statePlacement,
              states: selectedStates.map(({ state }) => state.slug),
              ...(statePlacement === "state-feed-sponsorship" ? { feeds: selectedFeeds } : {}),
            });
      window.location.assign(checkoutSession.url);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to start secure checkout.");
    }
  };

  return (
    <div className="layout-grid payments-page advertiser-landing">
      <section id="checkout" className="card payments-block checkout-lead">
        <div className="checkout-lead-copy">
          <p className="kicker">Secure advertiser checkout</p>
          <h1>Put your business on the Post</h1>
          <p className="lead">
            Choose county or state coverage, see the exact rate, upload your creative, and continue to Stripe’s secure checkout.
          </p>
        </div>

        {checkoutResult === "success" ? (
          <p className="checkout-result success" role="status">
            Payment received. Our advertising team will confirm inventory and creative before launch.
          </p>
        ) : checkoutResult === "cancelled" ? (
          <p className="checkout-result" role="status">Checkout was cancelled. Your campaign selections have not been charged.</p>
        ) : null}

        <form className="checkout-form" onSubmit={checkout}>
          <div className="checkout-options checkout-options-three">
            <label>
              Campaign reach
              <select value={scope} onChange={(event) => setScope(event.target.value as CampaignScope)}>
                <option value="county">County campaign</option>
                <option value="state">State campaign</option>
              </select>
            </label>
            <label>
              Placement
              <select
                value={scope === "county" ? countyPlacement : statePlacement}
                onChange={(event) => {
                  if (scope === "county") setCountyPlacement(event.target.value as CountyPlacement);
                  else setStatePlacement(event.target.value as StatePlacement);
                }}
              >
                {scope === "county" ? (
                  <>
                    <option value="color-card">Local color card</option>
                    <option value="section-sponsorship">Exclusive feed sponsorship + card</option>
                  </>
                ) : (
                  <>
                    <option value="state-ad">State ad network</option>
                    <option value="state-feed-sponsorship">State feed sponsorship + ad network</option>
                  </>
                )}
              </select>
            </label>
            <label>
              Billing
              <select value={billing} onChange={(event) => setBilling(event.target.value as BillingCadence)}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual — 12 months for the price of 10</option>
              </select>
            </label>
          </div>

          <PricingExplanation scope={scope} placement={scope === "county" ? countyPlacement : statePlacement} />

          <div className="checkout-options checkout-options-three">
            <label>
              Business name
              <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={120} required />
            </label>
            <label>
              Contact email
              <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} required />
            </label>
            <label>
              Referred to by (optional)
              <input
                value={referredBy}
                onChange={(event) => setReferredBy(event.target.value)}
                maxLength={120}
                placeholder="Salesperson or referrer name"
              />
            </label>
          </div>

          {scope === "county" ? (
            <CountyPicker
              query={countyQuery}
              setQuery={setCountyQuery}
              matches={countyMatches}
              counties={counties}
              addCounty={addCounty}
              removeCounty={(fips) => setCounties((current) => current.filter(({ county }) => county.fips !== fips))}
              disabled={status === "loading"}
            />
          ) : (
            <StatePicker
              query={stateQuery}
              setQuery={setStateQuery}
              matches={stateMatches}
              selectedStates={selectedStates}
              addState={addState}
              removeState={(slug) => setSelectedStates((current) => current.filter(({ state }) => state.slug !== slug))}
            />
          )}

          {needsFeeds ? (
            <fieldset className="feed-picker">
              <legend>Feeds to sponsor</legend>
              <p>Each feed is a separate full-price sponsorship across every selected state and its counties.</p>
              <div>
                {sponsorableFeeds.map((feed) => (
                  <label key={feed.key}>
                    <input type="checkbox" checked={selectedFeeds.includes(feed.key)} onChange={() => toggleFeed(feed.key)} />
                    {feed.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <ul className="payments-list creative-specs">
            <li><strong>Color card:</strong> {adAssetSpecs.square}.</li>
            <li><strong>Network band:</strong> {adAssetSpecs.banner}.</li>
            <li><strong>County expansion:</strong> the highest-priced county is full rate; additional counties are 50% of their tier.</li>
          </ul>

          <label>
            Upload ad creative (JPG or PNG, up to 10 MB)
            <input type="file" accept="image/jpeg,image/png" onChange={(event) => setCreative(event.target.files?.[0])} />
            <span className="checkout-input-help">
              Creative is uploaded privately before Stripe checkout and previewed in the examples below. You may also provide it after payment.
            </span>
          </label>

          <Link className="button pricing-information-button" to="/#pricing">
            Pricing Information
          </Link>

          <div className="checkout-summary" aria-live="polite">
            <span>{summaryLabel(scope, countyPlacement, statePlacement)} · {billing === "annual" ? "Annual plan" : "Monthly plan"}</span>
            <strong>{formatAdPrice(total)}{billing === "annual" ? "/year" : "/month"}</strong>
            {scope === "county" && counties.length > 1 ? (
              <small>Highest-priced county is full rate; every additional county is 50% of its tier rate.</small>
            ) : null}
            {scope === "state" && selectedStates.length ? (
              <small>
                {stateCountyCount.toLocaleString("en-US")} counties across {selectedStates.length} selected {selectedStates.length === 1 ? "state" : "states"}
                {needsFeeds ? ` · ${selectedFeeds.length} sponsored ${selectedFeeds.length === 1 ? "feed" : "feeds"}` : ""}
              </small>
            ) : null}
            {billing === "annual" ? <small>Annual total bills {ANNUAL_BILLED_MONTHS} months and delivers 12.</small> : null}
          </div>

          {message ? <p className={status === "error" ? "error" : "muted"}>{message}</p> : null}
          <button className="button primary checkout-button" type="submit" disabled={status === "loading" || !hasSelection}>
            {status === "loading" ? "Preparing checkout…" : "Continue to secure Stripe checkout"}
          </button>
          <p className="checkout-legal">
            Payment reserves the request; placement availability and creative are confirmed by our advertising team. See our{" "}
            <Link to="/terms">terms</Link> and <Link to="/privacy">privacy statement</Link>.
          </p>
        </form>
      </section>

      <section id="national-advertising" className="card national-advertising">
        <p className="kicker">National advertising</p>
        <h2>Build a national County Post campaign with our sales team</h2>
        <p>
          National lanes and exclusive national placements are planned directly with us. They are not sold through the checkout form.
        </p>
        <address>
          <a href={`mailto:${advertiserContact.email}`}>{advertiserContact.email}</a>
          <a href={advertiserContact.phoneHref}>{advertiserContact.phoneDisplay}</a>
          <span>{advertiserContact.address}</span>
        </address>
      </section>

      <PricingInformation />

      <AdvertiserPlacementShowcase businessName={businessName} creativeUrl={creativeUrl} />
    </div>
  );
}

function PricingInformation() {
  return (
    <section id="pricing" className="card payments-block">
      <p className="kicker">Transparent pricing</p>
      <h2>County and state campaign rates</h2>
      <div className="state-pricing-grid">
        <article>
          <span>State ad network</span>
          <strong>{formatAdPrice(STATE_AD_RATE_PER_COUNTY)} per county / month</strong>
          <p>Texas: 254 counties · {formatAdPrice(254 * STATE_AD_RATE_PER_COUNTY)}/month</p>
        </article>
        <article>
          <span>State feed sponsorship</span>
          <strong>{formatAdPrice(STATE_FEED_SPONSOR_RATE_PER_COUNTY)} per county / feed / month</strong>
          <p>Texas: one feed · {formatAdPrice(254 * STATE_FEED_SPONSOR_RATE_PER_COUNTY)}/month</p>
        </article>
        <article>
          <span>Annual plans</span>
          <strong>12 months for the price of 10</strong>
          <p>Two months are free and the rate is locked for the annual term.</p>
        </article>
      </div>

      <h3 className="county-pricing-heading">Monthly county pricing by population</h3>
      <div className="payments-table-wrap">
        <table className="payments-table">
          <caption>County campaign monthly rates by county population</caption>
          <thead>
            <tr>
              <th scope="col">County population</th>
              <th scope="col">Color card / month</th>
              <th scope="col">Feed sponsorship / month</th>
            </tr>
          </thead>
          <tbody>
            {countyRateTiers.map((tier) => (
              <tr key={tier.population}>
                <td data-label="County population">{tier.population}</td>
                <td data-label="Color card / month">{formatAdPrice(tier.colorCardMonthly)}</td>
                <td data-label="Feed sponsorship / month">{formatAdPrice(tier.sectionSponsorMonthly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PricingExplanation({
  scope,
  placement,
}: {
  scope: CampaignScope;
  placement: CountyPlacement | StatePlacement;
}) {
  if (scope === "county") {
    return (
      <aside className="checkout-pricing-note">
        <strong>{placement === "color-card" ? "County color-card pricing" : "County feed-sponsorship pricing"}</strong>
        <span>
          Rates follow county population. A feed sponsorship costs twice the color-card rate and includes a color card in the sponsored feed.
        </span>
      </aside>
    );
  }

  return (
    <aside className="checkout-pricing-note">
      <strong>{placement === "state-ad" ? "State ad network: $10 per county" : "State feed sponsorship: $20 per county, per feed"}</strong>
      <span>
        State campaigns run on the state page and throughout every county edition in each selected state. Texas is $2,540/month for a
        regular state ad or $5,080/month for one sponsored feed.
      </span>
    </aside>
  );
}

function CountyPicker({
  query,
  setQuery,
  matches,
  counties,
  addCounty,
  removeCounty,
  disabled,
}: {
  query: string;
  setQuery: (value: string) => void;
  matches: CountySite[];
  counties: SelectedCounty[];
  addCounty: (county: CountySite) => Promise<void>;
  removeCounty: (fips: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <div className="county-picker">
        <label>
          Add a county
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search county or state" />
        </label>
        {matches.length ? (
          <div className="county-search-results">
            {matches.map((county) => (
              <button key={county.fips} type="button" onClick={() => void addCounty(county)} disabled={disabled}>
                {county.displayName}, {county.state.abbr}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="checkout-counties">
        <h3>Selected counties</h3>
        {counties.length ? (
          <ul>
            {counties.map(({ county, population, estimateVintage }) => (
              <li key={county.fips}>
                <span>
                  <strong>{county.displayName}, {county.state.abbr}</strong>
                  <small>Population {population.toLocaleString("en-US")} · Census {estimateVintage}</small>
                </span>
                <button type="button" onClick={() => removeCounty(county.fips)}>Remove</button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">Search and add the counties where your advertisement should appear.</p>}
      </div>
    </>
  );
}

function StatePicker({
  query,
  setQuery,
  matches,
  selectedStates,
  addState,
  removeState,
}: {
  query: string;
  setQuery: (value: string) => void;
  matches: StateSite[];
  selectedStates: SelectedState[];
  addState: (state: StateSite) => void;
  removeState: (slug: string) => void;
}) {
  return (
    <>
      <div className="county-picker">
        <label>
          Add a state
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search state name or abbreviation" />
        </label>
        {matches.length ? (
          <div className="county-search-results">
            {matches.map((state) => (
              <button key={state.slug} type="button" onClick={() => addState(state)}>
                {state.name} ({state.abbr})
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="checkout-counties">
        <h3>Selected states</h3>
        {selectedStates.length ? (
          <ul>
            {selectedStates.map(({ state, countyCount }) => (
              <li key={state.slug}>
                <span>
                  <strong>{state.name}</strong>
                  <small>{countyCount.toLocaleString("en-US")} County Post county editions</small>
                </span>
                <button type="button" onClick={() => removeState(state.slug)}>Remove</button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">Choose one or more complete state networks.</p>}
      </div>
    </>
  );
}

function summaryLabel(
  scope: CampaignScope,
  countyPlacement: CountyPlacement,
  statePlacement: StatePlacement,
) {
  if (scope === "county") return countyPlacement === "color-card" ? "County color card" : "County feed sponsorship";
  return statePlacement === "state-ad" ? "State ad network" : "State feed sponsorship";
}

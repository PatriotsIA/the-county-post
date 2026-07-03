import { Link } from "react-router-dom";
import {
  adjacentCountyAddOns,
  adAssetSpecs,
  advertiserTiers,
  formatAdPrice,
  nationwidePricingLabel,
  pricingInventoryPlacements,
} from "../data/ad-pricing";

const placementGuide = [
  { placement: "Advertiser directory listing", tier: "Preferred Advertiser", note: "Included at $95/mo or $950/yr." },
  { placement: "Weather sponsor", tier: "Gold Advertiser", note: "Gold minimum when sold as a standalone county placement." },
  { placement: "Articles feed sponsor", tier: "Gold Advertiser", note: "Sponsor placement attached to local, state, or national article feeds." },
  { placement: "Obituaries feed sponsor", tier: "Gold Advertiser", note: "Good fit for funeral, floral, hospice, legal, and estate services." },
  { placement: "Sports feed sponsor", tier: "Gold Advertiser", note: "Local schools, youth sports, booster clubs, clinics, and restaurants." },
  { placement: "Subject feed sponsor", tier: "Gold Advertiser", note: "Sound Money, Paper Elections, Bond Issues, and Property Taxes pages." },
  { placement: "County sponsor carousel", tier: "Gold or Platinum Advertiser", note: "Priority rotation for Platinum Advertiser." },
  { placement: "Bottom banner", tier: "Platinum Advertiser", note: "980x300 banner placement across page bottoms." },
  { placement: "County hero Presented By", tier: "County Advertiser", note: "$995/mo or $9,950/yr for county-specific hero sponsorship." },
  { placement: "National homepage inventory", tier: "National Advertiser", note: nationwidePricingLabel },
] as const;

const discounts = [
  { label: "Annual prepay", detail: "Annual rates are priced at about two months free compared with monthly billing." },
  { label: "Adjacent counties", detail: "Add contiguous neighboring counties at half the base tier price for each additional county." },
  { label: "Multi-placement county bundle", detail: "10% off when buying 3+ elements in one county." },
  { label: "Category exclusivity", detail: "Add 25%-50% premium when one advertiser owns a business category in a geography." },
  { label: "Founding advertiser scarcity", detail: "Limit to 3-5 founding advertisers per county." },
] as const;

const addOns = [
  { label: "Extra feed sponsorship", detail: "Add $50/mo to Gold or $100/mo to Platinum for another feed beyond the base tier." },
  { label: "Category exclusivity", detail: "25%-50% premium for one advertiser per category in a county." },
  { label: "Reporting add-on", detail: "$25-$100/mo when click/impression reporting is available." },
  { label: "Creative production", detail: "One-time setup fee if The County Post creates ad art." },
] as const;

export function PaymentsPage() {
  const placements = pricingInventoryPlacements();

  return (
    <div className="layout-grid payments-page">
      <section className="hero-card payments-hero">
        <p className="kicker">Advertiser Payments</p>
        <h1>The County Post advertiser payments</h1>
        <p className="lead">
          Pricing and placement preview for County Post advertisers. Checkout buttons are placeholders until Stripe
          payment links are configured.
        </p>
        <div className="payments-notice">
          <strong>Stripe setup pending.</strong>
          <span>Use these placeholder buttons to confirm layout and package structure before live checkout links are added.</span>
        </div>
      </section>

      <section className="card payments-block">
        <p className="kicker">Subscribe</p>
        <h2>Choose your advertiser tier</h2>
        <p>
          Select the tier that matches the visibility you want. Monthly and annual checkout links will be wired to Stripe
          once the products are created.
        </p>
        <div className="payments-table-wrap">
          <table className="payments-table payments-subscription-table">
            <thead>
              <tr>
                <th scope="col">Advertiser tier</th>
                <th scope="col">Pricing</th>
                <th scope="col">Included visibility</th>
                <th scope="col">Checkout</th>
              </tr>
            </thead>
            <tbody>
              {advertiserTiers.map((tier) => (
                <tr key={tier.name}>
                  <td data-label="Advertiser tier">
                    <strong>{tier.name}</strong>
                    <span>{tier.summary}</span>
                  </td>
                  <td data-label="Pricing">
                    <span>
                      <strong>{formatAdPrice(tier.monthly)}</strong>/month
                    </span>
                    <span>
                      <strong>{formatAdPrice(tier.yearly)}</strong>/year
                    </span>
                    <span className="payments-subtle">Annual prepay saves about two months vs monthly.</span>
                  </td>
                  <td data-label="Included visibility">
                    <ul>
                      {tierIncludes(tier.name).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </td>
                  <td data-label="Checkout">
                    <PlaceholderButtons monthly={tier.monthly} yearly={tier.yearly} />
                  </td>
                </tr>
              ))}
              <tr>
                <td data-label="Advertiser tier">
                  <strong>National Advertiser</strong>
                  <span>Nationwide homepage hero, sponsor carousel, and bottom banner inventory.</span>
                </td>
                <td data-label="Pricing">
                  <span className="payments-subscription-quote">{nationwidePricingLabel}</span>
                </td>
                <td data-label="Included visibility">
                  <ul>
                    <li>National hero Presented By</li>
                    <li>Homepage sponsor carousel</li>
                    <li>Homepage bottom banner inventory</li>
                    <li>Custom category exclusivity options</li>
                  </ul>
                </td>
                <td data-label="Checkout">
                  <button className="button placeholder-payment-button" type="button" disabled>
                    Quote link coming soon
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card payments-block">
        <p className="kicker">Multi-County</p>
        <h2>Additional adjacent county add-ons</h2>
        <p>
          Subscribe to your base county at full tier price first, then add contiguous neighboring counties at half price.
          Each add-on should be a separate Stripe product rather than a discount code on the primary checkout.
        </p>
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr>
                <th scope="col">Add-on product</th>
                <th scope="col">Matches base tier</th>
                <th scope="col">Monthly add-on</th>
                <th scope="col">Annual add-on</th>
                <th scope="col">Checkout</th>
              </tr>
            </thead>
            <tbody>
              {adjacentCountyAddOns.map((addOn) => (
                <tr key={addOn.name}>
                  <td data-label="Add-on product">
                    <strong>{addOn.name}</strong>
                  </td>
                  <td data-label="Matches base tier">{addOn.matchesTier}</td>
                  <td data-label="Monthly add-on">{formatAdPrice(addOn.monthly)}/mo</td>
                  <td data-label="Annual add-on">{formatAdPrice(addOn.yearly)}/yr</td>
                  <td data-label="Checkout">
                    <button className="button placeholder-payment-button" type="button" disabled>
                      Add-on link coming soon
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card payments-block">
        <p className="kicker">Ad Assets</p>
        <h2>Sponsor creative specifications</h2>
        <ul className="payments-list">
          <li>
            <strong>Square ads:</strong> {adAssetSpecs.square}.
          </li>
          <li>
            <strong>Bottom banners:</strong> {adAssetSpecs.banner}.
          </li>
          <li>
            <strong>Delivery:</strong> send finished creatives or setup questions to{" "}
            <a href={`mailto:${adAssetSpecs.email}`}>{adAssetSpecs.email}</a>.
          </li>
        </ul>
      </section>

      <section className="card payments-block">
        <p className="kicker">Placement Inventory</p>
        <h2>Website placement pricing</h2>
        <div className="payments-inventory-grid">
          {placements.map((placement) => (
            <article className="payments-placement-card" key={placement.key}>
              <div className={`payments-placement-preview${placement.key === "page-bottom-banner" ? " payments-placement-preview-banner" : ""}`}>
                <span>{placement.key === "page-bottom-banner" ? "980x300" : "250x250"}</span>
                <strong>Advertiser creative</strong>
              </div>
              <div>
                <h3>{placement.label}</h3>
                <p className="payments-placement-tier">{placement.tier}</p>
                <p>
                  {placement.quoteOnly
                    ? placement.quoteLabel
                    : `${formatAdPrice(placement.monthly)}/mo · ${formatAdPrice(placement.yearly)}/yr`}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card payments-block">
        <p className="kicker">Placement Guide</p>
        <h2>How placements map to tiers</h2>
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr>
                <th scope="col">Placement</th>
                <th scope="col">Tier</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {placementGuide.map((row) => (
                <tr key={row.placement}>
                  <td data-label="Placement">{row.placement}</td>
                  <td data-label="Tier">{row.tier}</td>
                  <td data-label="Notes">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card payments-block">
        <p className="kicker">Discounts</p>
        <h2>Discounts and premiums</h2>
        <ul className="payments-list">
          {discounts.map((item) => (
            <li key={item.label}>
              <strong>{item.label}:</strong> {item.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="card payments-block">
        <p className="kicker">Add-Ons</p>
        <h2>Optional add-on pricing</h2>
        <ul className="payments-list">
          {addOns.map((item) => (
            <li key={item.label}>
              <strong>{item.label}:</strong> {item.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="card payments-block">
        <p className="kicker">Next Step</p>
        <h2>Ready for Stripe links</h2>
        <p>
          When the Stripe products are ready, replace the disabled placeholder buttons with monthly and annual payment
          links for each tier and add-on.
        </p>
        <Link className="button-link" to="/advertise">
          Back to advertiser preview
        </Link>
      </section>
    </div>
  );
}

function PlaceholderButtons({ monthly, yearly }: { monthly: number; yearly: number }) {
  return (
    <div className="payments-actions">
      <button className="button primary placeholder-payment-button" type="button" disabled>
        Monthly checkout coming soon — {formatAdPrice(monthly)}
      </button>
      <button className="button placeholder-payment-button" type="button" disabled>
        Annual checkout coming soon — {formatAdPrice(yearly)}
      </button>
    </div>
  );
}

function tierIncludes(tierName: string) {
  if (tierName === "Preferred Advertiser") {
    return ["Clickable advertiser directory listing", "Business logo and short description", "Link to website or social profile"];
  }

  if (tierName === "Gold Advertiser") {
    return ["Everything in Preferred", "One primary Presented By or feed sponsorship", "Rotating county sponsor carousel inclusion"];
  }

  if (tierName === "Platinum Advertiser") {
    return ["Everything in Gold", "Priority county sponsor carousel rotation", "Bottom banner carousel placement", "Feed and weather sponsorship priority"];
  }

  return ["County hero Presented By logo and link", "Premium county-specific visibility", "Ideal for category leaders in one county"];
}

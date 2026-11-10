import type { CountySite } from "../data/counties";
import { countyClassifiedsUrl } from "../lib/classifieds";

export function ClassifiedsEntry({ county }: { county: CountySite }) {
  const browse = countyClassifiedsUrl(county.fips);
  const post = countyClassifiedsUrl(county.fips, "post");
  if (!browse || !post) return null;
  return (
    <section className="section" aria-labelledby="classifieds-market-title">
      <h2 id="classifieds-market-title">Classifieds in {county.displayName}</h2>
      <p>Browse items for sale or create a free personal listing. Your county selection follows you into the marketplace.</p>
      <p>Business accounts and public business pages are free. Business listings cost $10 USD for 30 days in one county, plus $5 per additional county. Pay securely through Stripe after staff approval, with no subscription or automatic renewal.</p>
      <p><a href={browse}>Browse county listings</a></p>
      <p><a href={post}>Post an item for sale</a></p>
      <p className="muted">The marketplace uses a separate account. Previously emailed submissions remain with the county desk; they have not been automatically published or charged.</p>
    </section>
  );
}

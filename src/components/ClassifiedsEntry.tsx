import type { CountySite } from "../data/counties";
import { countyClassifiedsUrl } from "../lib/classifieds";

export function ClassifiedsEntry({ county }: { county: CountySite }) {
  const browse = countyClassifiedsUrl(county.fips);
  const post = countyClassifiedsUrl(county.fips, "post");
  if (!browse || !post) return null;
  return (
    <section className="section" aria-labelledby="classifieds-market-title">
      <h2 id="classifieds-market-title">Classifieds in {county.displayName}</h2>
      <p>Browse items for sale or create a listing. Your county selection follows you into the marketplace.</p>
      <p><a href={browse}>Browse county listings</a></p>
      <p><a href={post}>Post an item for sale</a></p>
      <p className="muted">The marketplace uses a separate account. Previously emailed submissions remain with the county desk; they have not been automatically published or charged.</p>
    </section>
  );
}

import { useState } from "react";
import nationalExample from "../../national-example.png";

type Props = {
  businessName: string;
  creativeUrl?: string;
};

const carouselLabels = ["Your Business", "Community Partner", "Local Sponsor"];

export function AdvertiserPlacementShowcase({ businessName, creativeUrl }: Props) {
  const displayName = businessName.trim() || "Your Business";

  return (
    <section id="placement-examples" className="card ad-showcase">
      <header className="ad-showcase-heading">
        <div>
          <p className="kicker">Placement examples</p>
          <h2>See your County Post Marketing Campaign in the County Post design</h2>
        </div>
        <div className="ad-showcase-heading-action">
          <p>
            Uploaded artwork is previewed below. These examples demonstrate position and scale; final creative is reviewed before launch.
          </p>
          <a className="button primary main-site-button" href="https://thecountypost.com" target="_blank" rel="noreferrer">
            View the live County Post
          </a>
        </div>
      </header>

      <div className="ad-showcase-grid">
        <article className="ad-showcase-card ad-showcase-card-wide">
          <div className="ad-mockup advertiser-feed-demo">
            <header>
              <span>Scores &amp; highlights</span>
              <strong>Local Sports</strong>
              <small>Presented by</small>
              <PreviewCreative businessName={displayName} creativeUrl={creativeUrl} compact />
            </header>
            <div className="advertiser-feed-grid">
              <SampleStory title="County teams prepare for district play" />
              <PreviewCreative businessName={displayName} creativeUrl={creativeUrl} />
              <SampleStory title="Friday night schedule and scores" />
            </div>
          </div>
          <div>
            <h3>Feed sponsorship and in-feed ad</h3>
            <p className="ad-showcase-spec">Exclusive feed-top credit + full-color feed card</p>
            <p>
              Feed sponsors appear above the selected news feed and also receive normal color-ad rotation throughout the purchased
              counties or states.
            </p>
          </div>
        </article>

        <article className="ad-showcase-card">
          <PreviewCarousel businessName={displayName} creativeUrl={creativeUrl} variant="square" />
          <div>
            <h3>News-card carousel</h3>
            <p className="ad-showcase-spec">Square creative · within article sections</p>
            <p>Your color ad rotates with other approved advertisers without displacing local reporting.</p>
          </div>
        </article>

        <article className="ad-showcase-card">
          <PreviewCarousel businessName={displayName} creativeUrl={creativeUrl} variant="banner" />
          <div>
            <h3>Section-break carousel</h3>
            <p className="ad-showcase-spec">Wide creative · between news sections</p>
            <p>
              State-level County Post Marketing Campaigns receive network delivery across state pages and every county edition in each
              selected state.
            </p>
          </div>
        </article>

        <article className="ad-showcase-card ad-showcase-card-wide">
          <div className="advertiser-header-examples">
            <HeaderSponsorPreview label="State edition" title="Texas" businessName={displayName} creativeUrl={creativeUrl} />
            <HeaderSponsorPreview label="County edition" title="Potter County" businessName={displayName} creativeUrl={creativeUrl} />
          </div>
          <div>
            <h3>State and county header sponsorship</h3>
            <p className="ad-showcase-spec">High-visibility sponsor position near edition navigation</p>
            <p>Section sponsorships reinforce the advertiser beside the edition identity before readers enter the feed.</p>
          </div>
        </article>
      </div>

      <p className="ad-showcase-delivery">
        State purchases cover the state page and all County Post county editions within that state. Feed sponsorships are priced
        separately for each selected feed.
      </p>

      <figure className="full-page-site-example">
        <figcaption>
          <p className="kicker">Full-page example</p>
          <h3>The County Post national edition</h3>
          <p>See how advertising placements fit throughout the complete national reading experience.</p>
        </figcaption>
        <a href="https://thecountypost.com" target="_blank" rel="noreferrer" aria-label="Open the live County Post website">
          <img
            src={nationalExample}
            alt="Full-page example of The County Post national edition with advertising placements"
            loading="lazy"
            decoding="async"
          />
        </a>
      </figure>
    </section>
  );
}

function SampleStory({ title }: { title: string }) {
  return (
    <article className="advertiser-sample-story">
      <span aria-hidden="true" />
      <strong>{title}</strong>
      <small>County Post News</small>
    </article>
  );
}

function PreviewCarousel({
  businessName,
  creativeUrl,
  variant,
}: {
  businessName: string;
  creativeUrl?: string;
  variant: "square" | "banner";
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const move = (direction: -1 | 1) => {
    setActiveIndex((index) => (index + direction + carouselLabels.length) % carouselLabels.length);
  };
  const isAdvertiser = activeIndex === 0;

  return (
    <div className={`advertiser-preview-carousel advertiser-preview-carousel-${variant}`} aria-label={`${variant} ad carousel example`}>
      <button type="button" onClick={() => move(-1)} aria-label="Previous example advertisement">
        ‹
      </button>
      <div aria-live="polite">
        <PreviewCreative
          businessName={isAdvertiser ? businessName : carouselLabels[activeIndex]}
          creativeUrl={isAdvertiser ? creativeUrl : undefined}
          banner={variant === "banner"}
        />
      </div>
      <button type="button" onClick={() => move(1)} aria-label="Next example advertisement">
        ›
      </button>
      <small>Example {activeIndex + 1} of {carouselLabels.length}</small>
    </div>
  );
}

function HeaderSponsorPreview({
  label,
  title,
  businessName,
  creativeUrl,
}: {
  label: string;
  title: string;
  businessName: string;
  creativeUrl?: string;
}) {
  return (
    <div className="advertiser-header-preview">
      <span>{label}</span>
      <strong>{title}</strong>
      <nav aria-label={`${title} example navigation`}>
        <span>Home</span>
        <span>Weather</span>
        <span>Sports</span>
      </nav>
      <small>Sponsored by</small>
      <PreviewCreative businessName={businessName} creativeUrl={creativeUrl} compact />
    </div>
  );
}

function PreviewCreative({
  businessName,
  creativeUrl,
  compact = false,
  banner = false,
}: {
  businessName: string;
  creativeUrl?: string;
  compact?: boolean;
  banner?: boolean;
}) {
  return (
    <div className={`advertiser-preview-creative${compact ? " compact" : ""}${banner ? " banner" : ""}`}>
      {creativeUrl ? <img src={creativeUrl} alt={`${businessName} advertisement preview`} /> : (
        <>
          <span className="ad-mockup-label">Advertisement</span>
          <strong>{businessName}</strong>
          <small>Full-color creative appears here</small>
          {!compact ? <span className="ad-mockup-cta">Learn more</span> : null}
        </>
      )}
    </div>
  );
}

import itmLogo from "../../ad-assets/itm-trading-logo.jpg";
import wealthShield from "../../ad-assets/itm-wealth-shield.png";
import { itmTrading, itmVideoIds, itmVideoTitles, stanTeam, ITM_TRADING_DESCRIPTION, ITM_TRADING_PATH, ITM_TRADING_TITLE } from "../data/itm-trading";
import { crumbTrail, jsonLdGraph, webPageLd } from "../lib/seo";
import { MetalsTracker } from "./MetalsTracker";
import { Seo } from "./Seo";
import "./ItmTrading.css";

export function ItmTrading() {
  return <div className="itm-page">
    <Seo title={ITM_TRADING_TITLE} description={ITM_TRADING_DESCRIPTION} canonicalPath={ITM_TRADING_PATH} policy="sponsor" jsonLd={jsonLdGraph({
      ...webPageLd({ path: ITM_TRADING_PATH, name: ITM_TRADING_TITLE, description: ITM_TRADING_DESCRIPTION, crumbs: crumbTrail(ITM_TRADING_PATH) }),
      sponsor: { "@type": "Organization", name: "ITM Trading", url: itmTrading.url },
      about: { "@type": "Person", name: "Stan Roberts", jobTitle: itmTrading.title, worksFor: { "@type": "Organization", name: "ITM Trading", url: itmTrading.url } },
    })} />
    <section className="hero-card itm-hero" aria-labelledby="itm-title">
      <div className="itm-hero-copy">
        <p className="kicker">Sponsor spotlight · The County Post</p>
        <h1 id="itm-title">ITM Trading</h1>
        <p>Meet Stan Roberts, a Senior Analyst at ITM Trading, and build a plan to protect your wealth and purchasing power with physical gold and silver.</p>
      </div>
      <div className="itm-hero-brand"><img src={itmLogo} alt="ITM Trading" width="250" height="156" /><a href={itmTrading.websiteUrl} target="_blank" rel="noreferrer sponsored">Visit ITM Trading <span aria-hidden="true">↗</span></a></div>
      <p className="itm-disclosure"><strong>ITM Trading is a sponsor of The County Post.</strong> This page introduces our sponsor and its services. Price data is provided separately by Gold-API.com.</p>
    </section>
    <nav className="itm-page-nav" aria-label="ITM Trading page sections"><a href="#stan-roberts">Meet Stan Roberts</a><a href="#stan-team">Stan’s Team</a><a href="#metal-prices">Metal prices</a><a href="#about-itm">About ITM</a><a href="#itm-videos">Videos &amp; education</a></nav>

    <section id="stan-roberts" className="card itm-contact" aria-labelledby="itm-stan-title">
      <div className="itm-profile"><p className="kicker">Your contact at ITM Trading</p><h2 id="itm-stan-title">Stan Roberts</h2><p className="itm-role">{itmTrading.title} · ITM Trading</p><p>Stan will walk through your savings and retirement picture with you, answer your questions and explain how physical gold and silver fit into a long-term wealth protection plan.</p><p>Call or email Stan directly, or choose a day and time for a 30-minute appointment. <strong>Mention The County Post when you connect.</strong></p></div>
      <div className="itm-contact-details"><p className="kicker">Contact Stan directly</p><a className="itm-phone" href={itmTrading.phoneHref}>{itmTrading.phone}</a><a href={itmTrading.emailHref}>{itmTrading.email}</a><a className="itm-button" href={itmTrading.appointmentUrl} target="_blank" rel="noreferrer sponsored">Book 30 minutes with Stan <span aria-hidden="true">↗</span></a><p className="itm-small">Choose an appointment time online through Calendly.</p><p className="itm-small">ITM office hours: Monday–Friday, 8 a.m.–5 p.m. PST.<br />11201 N Tatum Blvd, Suite 250<br />Phoenix, AZ 85028 · By appointment.</p></div>
    </section>

    <section id="stan-team" className="itm-team" aria-labelledby="itm-team-title">
      <header className="itm-section-heading"><div><p className="kicker">ITM Trading analysts</p><h2 id="itm-team-title">Stan’s Team</h2></div></header>
      <ul className="itm-team-grid">{stanTeam.map(({ name, email }) => <li className="card" key={name}><h3>{name}</h3><p className="itm-small">Senior Analyst · ITM Trading</p><a className="itm-team-email" href={`mailto:${email}?subject=The%20County%20Post%20inquiry`}>{email}</a></li>)}</ul>
    </section>

    <MetalsTracker />

    <section id="about-itm" className="section itm-about" aria-labelledby="itm-about-title">
      <div><p className="kicker">Meet our sponsor</p><h2 id="itm-about-title">An education-first approach to gold &amp; silver.</h2></div>
      <div><p>ITM Trading is a family-owned global precious metals company based in Phoenix. Founded in 1995, it combines physical gold and silver sales with education and individual conversations about clients’ goals.</p><p>ITM Trading includes bullion and collectible coins as strategic options, with a focus on pre-1933 U.S. gold.</p><p>ITM provides an ongoing relationship: discuss your objectives with an analyst, consider products and a strategy, then arrange insured delivery. The ITM Trading team also offers portfolio reviews after a purchase.</p></div>
    </section>

    <div className="itm-resource-grid">
      <a href="#stan-roberts" className="itm-strategy-card"><span className="kicker">Education &amp; planning</span><h3>Learn about ITM’s approach</h3><img className="itm-wealth-shield" src={wealthShield} alt="ITM Trading Wealth Shield: Sustained Living, Wealth Protection, Opportunity Positioning, and Legacy Building" width="719" height="719" loading="lazy" /><p>Talk with Stan about ITM’s Wealth Shield™ approach to precious metals and financial preparedness.</p><span>Contact Stan about the strategy →</span></a>
      <a href="#stan-roberts"><span className="kicker">Retirement accounts</span><h3>Precious-metals IRAs</h3><p>Learn how ITM describes self-directed account setup, funding and the selection of eligible products.</p><span>Ask Stan about IRAs →</span></a>
    </div>

    <section id="itm-videos" className="itm-education" aria-labelledby="itm-videos-title">
      <header className="itm-section-heading"><div><p className="kicker">ITM Trading video desk</p><h2 id="itm-videos-title">Videos &amp; education</h2></div></header>
      <p className="itm-disclosure">Sponsor education · The videos below are published by ITM Trading and reflect its views.</p>
      <div className="itm-videos">{itmVideoIds.map(videoId => <div key={videoId} className="itm-video"><iframe src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={itmVideoTitles[videoId] || "ITM Trading video"} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>)}</div>
      <a className="itm-button" href={itmTrading.blogUrl} target="_blank" rel="noreferrer sponsored">Read the ITM Trading blog <span aria-hidden="true">↗</span></a>
    </section>
    <p className="itm-page-note">Company information supplied by ITM Trading, with office details from its <a href={itmTrading.contactUrl} target="_blank" rel="noreferrer sponsored">Contact page</a>. Stan’s profile updated October 6, 2026; team contacts updated October 12, 2026; page copy updated October 20, 2026. Educational information, prices, and product values are subject to change. Contact Stan at ITM Trading for current terms and quotes.</p>
  </div>;
}

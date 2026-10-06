import itmLogo from "../../ad-assets/itm-trading-logo.jpg";
import { itmTrading, stanTeam, ITM_TRADING_DESCRIPTION, ITM_TRADING_PATH, ITM_TRADING_TITLE } from "../data/itm-trading";
import { crumbTrail, jsonLdGraph, webPageLd } from "../lib/seo";
import { HardAssetsFeed } from "./HardAssetsFeed";
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
        <p>Connect with Stan Roberts at ITM Trading, explore physical gold and silver, and follow precious-metal benchmarks.</p>
      </div>
      <div className="itm-hero-brand"><img src={itmLogo} alt="ITM Trading" width="250" height="156" /><a href={itmTrading.websiteUrl} target="_blank" rel="noreferrer sponsored">Visit ITM Trading <span aria-hidden="true">↗</span></a></div>
      <p className="itm-disclosure"><strong>ITM Trading is a sponsor of The County Post.</strong> This page introduces our sponsor and its services. Price data is provided separately by Minted Metal.</p>
    </section>
    <nav className="itm-page-nav" aria-label="ITM Trading page sections"><a href="#stan-roberts">Meet Stan Roberts</a><a href="#stan-team">Stan’s Team</a><a href="#metal-prices">Metal prices</a><a href="#about-itm">About ITM</a><a href="#itm-videos">Videos &amp; education</a></nav>

    <section id="stan-roberts" className="card itm-contact" aria-labelledby="itm-stan-title">
      <div className="itm-profile"><p className="kicker">Your contact at ITM Trading</p><h2 id="itm-stan-title">Stan Roberts</h2><p className="itm-role">{itmTrading.title} · ITM Trading</p><p>Connect with Stan to discuss physical gold and silver, ask questions about the products, and explore how ITM works with its clients.</p><p>Call or email Stan directly, or choose a time for a 30-minute appointment. <strong>Mention The County Post when you connect.</strong></p><a href={itmTrading.aboutUrl} target="_blank" rel="noreferrer sponsored">Meet the team at ITM Trading ↗</a></div>
      <div className="itm-contact-details"><p className="kicker">Contact Stan directly</p><a className="itm-phone" href={itmTrading.phoneHref}>{itmTrading.phone}</a><a href={itmTrading.emailHref}>{itmTrading.email}</a><a className="itm-button" href={itmTrading.appointmentUrl} target="_blank" rel="noreferrer sponsored">Book 30 minutes with Stan <span aria-hidden="true">↗</span></a><p className="itm-small">Choose an appointment time online through Calendly.</p><p className="itm-small">ITM office hours: Monday–Friday, 8 a.m.–5 p.m. PST.<br />11201 N Tatum Blvd, Suite 250<br />Phoenix, AZ 85028 · By appointment.</p></div>
    </section>

    <section id="stan-team" className="itm-team" aria-labelledby="itm-team-title">
      <header className="itm-section-heading"><div><p className="kicker">ITM Trading analysts</p><h2 id="itm-team-title">Stan’s Team</h2></div><a className="itm-text-link" href={itmTrading.aboutUrl} target="_blank" rel="noreferrer sponsored">View ITM’s analyst directory ↗</a></header>
      <ul className="itm-team-grid">{stanTeam.map(name => <li className="card" key={name}><h3>{name}</h3><p className="itm-small">Analyst · ITM Trading</p></li>)}</ul>
    </section>

    <MetalsTracker />

    <section id="about-itm" className="section itm-about" aria-labelledby="itm-about-title">
      <div><p className="kicker">Meet our sponsor</p><h2 id="itm-about-title">An education-first approach to gold &amp; silver.</h2></div>
      <div><p>ITM Trading is a family-owned precious-metals company based in Phoenix. Founded in 1995, it combines physical gold and silver sales with education and individual conversations about clients’ goals.</p><p>Its range includes bullion and collectible coins, with a particular focus on pre-1933 U.S. gold. ITM says its U.S. rare coins are graded by PCGS or NGC and examined in person before sale.</p><p>ITM describes an ongoing relationship: discuss your objectives with an analyst, consider products and a strategy, then arrange insured delivery. Its team also offers portfolio reviews after a purchase.</p><a href={itmTrading.aboutUrl} className="itm-text-link" target="_blank" rel="noreferrer sponsored">Read ITM’s company profile <span aria-hidden="true">↗</span></a></div>
    </section>

    <div className="itm-resource-grid">
      <a href={itmTrading.productsUrl} target="_blank" rel="noreferrer sponsored"><span className="kicker">Physical metals</span><h3>Explore gold &amp; silver</h3><p>Browse ITM’s bullion and coin selection, including gold, silver and pre-1933 gold.</p><span>Explore products ↗</span></a>
      <a href={itmTrading.strategyUrl} target="_blank" rel="noreferrer sponsored"><span className="kicker">Education &amp; planning</span><h3>Learn about ITM’s approach</h3><p>ITM’s Wealth Shield™ materials explain its approach to precious metals and financial preparedness.</p><span>Read about the strategy ↗</span></a>
      <a href={itmTrading.iraUrl} target="_blank" rel="noreferrer sponsored"><span className="kicker">Retirement accounts</span><h3>Precious-metals IRAs</h3><p>Learn how ITM describes self-directed account setup, funding and the selection of eligible products.</p><span>Explore IRA information ↗</span></a>
    </div>

    <section id="itm-videos" className="itm-education" aria-label="ITM Trading videos and education"><p className="itm-disclosure">Sponsor education · The videos below are published by ITM Trading and reflect its views.</p><HardAssetsFeed featuredVideoIds={[]} /><a className="itm-text-link" href="https://www.youtube.com/@itmtrading/videos" target="_blank" rel="noreferrer sponsored">Visit ITM Trading’s video channel ↗</a></section>
    <p className="itm-page-note">Company information adapted from ITM Trading’s <a href={itmTrading.aboutUrl} target="_blank" rel="noreferrer sponsored">About page</a> and <a href={itmTrading.contactUrl} target="_blank" rel="noreferrer sponsored">Contact page</a>. Stan’s profile and team updated October 6, 2026. Educational information; prices and product values can change. Contact ITM for current terms and quotes.</p>
  </div>;
}

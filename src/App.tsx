import { useEffect } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { PaymentsPage } from "./components/PaymentsPage";
import { advertiserContact } from "./data/advertiser-contact";
import countyPostLogo from "../county-post-final-logo.png";

function App() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    window.requestAnimationFrame(() => {
      document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash, location.pathname]);

  return (
    <div className="page advertiser-app">
      <header className="advertiser-header">
        <Link className="advertiser-brand" to="/" aria-label="The County Post advertiser home">
          <img src={countyPostLogo} alt="The County Post" />
          <span>
            <strong>Advertise on The County Post</strong>
            <small>Be the only color on the page</small>
          </span>
        </Link>
        <nav className="advertiser-nav" aria-label="Advertiser navigation">
          <Link to="/#checkout">Build a campaign</Link>
          <Link to="/#placement-examples">Placement examples</Link>
          <Link to="/#pricing">Pricing</Link>
          <Link to="/#national-advertising">National advertising</Link>
          <NavLink to="/terms">Terms</NavLink>
          <NavLink to="/privacy">Privacy</NavLink>
          <a className="advertiser-main-site-link" href="https://thecountypost.com" target="_blank" rel="noreferrer">
            Visit main site
          </a>
        </nav>
      </header>

      <main className="advertiser-main">
        <Routes>
          <Route path="/" element={<PaymentsPage />} />
          <Route path="/advertise" element={<Navigate to="/#checkout" replace />} />
          <Route path="/payments" element={<Navigate to="/#checkout" replace />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="footer advertiser-footer">
        <img className="footer-logo" src={countyPostLogo} alt="The County Post" />
        <div>
          <strong>Advertising sales</strong>
          <a href={`mailto:${advertiserContact.email}`}>{advertiserContact.email}</a>
          <a href={advertiserContact.phoneHref}>{advertiserContact.phoneDisplay}</a>
          <span>{advertiserContact.address}</span>
        </div>
        <div className="footer-links">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}

function PrivacyPage() {
  return (
    <div className="layout-grid legal-page">
      <section className="hero-card">
        <p className="kicker">Privacy</p>
        <h1>Privacy Policy</h1>
        <p className="lead">We use the County Post News API for news aggregation. No behavioral tracking or ad tech.</p>
      </section>
      <Link className="button-link" to="/">
        Return to advertiser information
      </Link>
    </div>
  );
}

function TermsPage() {
  return (
    <div className="layout-grid legal-page">
      <section className="hero-card">
        <p className="kicker">Terms</p>
        <h1>Terms of Service</h1>
        <p className="lead">
          Content is aggregated through the County Post News API. Links open to original publishers. Submissions are subject to
          editorial review.
        </p>
      </section>
      <Link className="button-link" to="/">
        Return to advertiser information
      </Link>
    </div>
  );
}

export default App;

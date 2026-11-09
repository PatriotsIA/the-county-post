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
          <Link to="/#checkout">Build a County Post Marketing Campaign</Link>
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

      <aside className="release-banner" aria-label="Coming soon">
        Advertising Options on Our Next Release: <strong>The County Post: Classifieds Marketplace</strong> - Coming Soon!
      </aside>

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
        <p className="lead">County Post, LLC uses your information to process and support your advertising campaign.</p>
        <h2>Information we use</h2>
        <p>We collect the business name, contact email, optional referral, selected locations and placements, and artwork you submit. We use these details to prepare your order, review inventory and creative, contact you about your campaign, and resolve billing or support requests.</p>
        <h2>Payments and service providers</h2>
        <p>Stripe hosts payment entry and processes your payments. We keep order references, amounts, billing cadence and payment status; our application does not receive your full card number or security code. Our hosting, email and payment providers process the information needed to deliver these services.</p>
        <h2>Checkout storage</h2>
        <p>Your browser stores a checkout reference for the current session to help you resume an unchanged order. We keep campaign and payment records for fulfillment, support, accounting and dispute handling. Service logs help us investigate failures and prevent abuse.</p>
        <p>For privacy questions, access or deletion requests, contact <a href="mailto:socials@thecountypost.com">socials@thecountypost.com</a>. Some transaction records may need to be retained for accounting or legal obligations.</p>
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
          These terms cover advertising requests and payments to County Post, LLC through this site.
        </p>
        <h2>Your campaign request</h2>
        <p>Provide accurate contact and campaign information and only submit artwork you are authorized to use. Payment submits your request; our advertising team must confirm placement availability and approve creative before an ad goes live.</p>
        <h2>Prices and recurring billing</h2>
        <p>Review the selected placements, amount and billing interval before paying in Stripe. Monthly plans renew each month and annual plans renew each year until cancelled. The annual price is ten times the monthly rate, paid upfront for twelve months of service. The amount and interval shown at checkout apply to your subscription.</p>
        <h2>Changes, cancellations and billing help</h2>
        <p>Contact <a href="mailto:socials@thecountypost.com">socials@thecountypost.com</a> with your business name and order or Stripe receipt reference to request changes, cancel future renewals, or ask about a refund. Do not send card numbers or security codes by email. Our team will review your request and payment records with you.</p>
        <p>A browser return page or campaign-request email alone does not establish payment. Payment confirmation comes from Stripe. These advertising subscriptions are separate from Classifieds listing fees and transactions between buyers and sellers.</p>
      </section>
      <Link className="button-link" to="/">
        Return to advertiser information
      </Link>
    </div>
  );
}

export default App;

import { Link } from "react-router-dom";
import type { CountySite } from "../data/counties";
import type { StateSite } from "../data/states";
import { subjectGroups, topicSections } from "../data/subjects";
import { atlasDomainLinks } from "../lib/atlas-domain-labels";
import { PANHANDLE_LEGENDS_PATH } from "../data/panhandle-legends";
import type { FetchDesk } from "../data/fetch-guide";

export function FetchDirectory({
  county,
  state,
  go,
  askDesk,
  compare,
}: {
  county?: CountySite;
  state?: StateSite;
  go: () => void;
  askDesk: (desk: FetchDesk, question?: string) => void;
  compare: (level: "states" | "counties") => void;
}) {
  const base = county ? `/${county.state.slug}/${county.slug}` : state ? "/" + state.slug : "";
  const link = (title: string, to: string) => (
    <Link key={to} to={to} onClick={go}>
      {title}
    </Link>
  );
  return (
    <section className="fetch-directory">
      <h3>Browse the site</h3>
      <p>Choose a subject, then a page. County desks use the county you’re reading.</p>
      <details open>
        <summary>Local news and weather</summary>
        {link("Find a state or county", "/states")}
        {link("Headlines", (base || "/") + "#desk-general")}
        {topicSections.map((t) => link(t.title, (base || "/") + "#desk-" + t.kind))}
        <button onClick={() => askDesk("weather")}>County forecast and alerts</button>
        <button onClick={() => askDesk("sources")}>Local newspapers and broadcasters</button>
      </details>
      <details>
        <summary>Population, housing and other data</summary>
        <button onClick={() => compare("counties")}>Compare counties</button>
        <button onClick={() => compare("states")}>Compare states</button>
        <button onClick={() => askDesk("data", "Browse county statistics")}>
          Explore county figures in Fetch
        </button>
        {county && atlasDomainLinks(county).map((d) => link(d.label, d.to))}
        {county ? (
          link("Economic data and historical figures", base + "/economic-data")
        ) : (
          <button onClick={() => askDesk("gdp", "What is the county GDP?")}>
            Look up county economic data
          </button>
        )}
        <button onClick={() => askDesk("turnout", "Show voter turnout")}>Look up election turnout</button>
        <button onClick={() => askDesk("quotes", "Show stock prices")}>Stocks and market symbols</button>
        <button onClick={() => askDesk("quotes", "Show metal prices")}>Metal prices</button>
        <button onClick={() => askDesk("quotes", "Show cattle prices")}>Cattle prices</button>
      </details>
      <details>
        <summary>Government, elections and public notices</summary>
        <button onClick={() => askDesk("notices")}>County public notices and meetings</button>
        <a href="https://www.whitehouse.gov/live/" target="_blank" rel="noreferrer">
          White House News
        </a>
        {subjectGroups.map((g) => (
          <div key={g.slug}>
            {link(g.title, (base || "/topics") + "/" + g.slug)}
            {g.subjects.map((s) => link(s.title, (base || "/topics") + "/" + s.slug))}
          </div>
        ))}
      </details>
      <details>
        <summary>Videos, opinion and features</summary>
        <button onClick={() => askDesk("videos", "Show featured videos")}>Watch featured videos</button>
        {link("Opinion columns", base + "/op-eds")}
        {link("Panhandle Legends", PANHANDLE_LEGENDS_PATH)}
        {link("ITM Trading", "/itm-trading")}
      </details>
      <details>
        <summary>Classifieds, email and reader services</summary>
        <button onClick={() => askDesk("classifieds")}>Browse or post a classified</button>
        {link("Get the Morning Post email", "/morning-post")}
        {link("Give a Morning Post subscription", "/morning-post#morning-post-gift")}
        {link("Send a story or news tip", base + "/submit")}
        {link("Partners", county ? base + "/partners" : "/partners")}
        <a href="https://www.advertise.thecountypost.com/" target="_blank" rel="noreferrer">
          Advertise
        </a>
        {link("About the newspaper", "/about")}
        {link("Privacy", "/privacy")}
        {link("Terms of service", "/terms")}
      </details>
    </section>
  );
}

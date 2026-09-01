import type { CountySite } from "../data/counties";
import { AdSlot } from "./AdSlot";
import { useCountyTurnout } from "../lib/useCountyTurnout";

const numberFormatter = new Intl.NumberFormat("en-US");

export function CountyShowUpMeter({ county }: { county: CountySite }) {
  const turnout = useCountyTurnout(county.fips);
  const latest = turnout.data[0];
  const priorElections = turnout.data.slice(1, 4);

  return (
    <section className="county-show-up-section" aria-label={`${county.displayName} show up meter`}>
      <div className="show-up-meter" aria-live="polite">
        <p className="kicker">Operation Show Up</p>
        <h2>{county.displayName} Show Up Meter</h2>
        {turnout.loading ? (
          <p className="muted">Loading latest turnout data…</p>
        ) : latest ? (
          <>
            <p>
              <strong>{numberFormatter.format(latest.ballotsCast)}</strong> out of{" "}
              <strong>{numberFormatter.format(latest.registeredVoters)}</strong> registered voters cast a ballot.
            </p>
            <p className="show-up-meter-attribution">According to The Machines</p>
            <div className="show-up-meter-track" role="img" aria-label={`${latest.turnoutPct.toFixed(1)}% turnout`}>
              <div className="show-up-meter-fill" style={{ width: `${latest.turnoutPct.toFixed(2)}%` }} />
            </div>
            <p className="show-up-meter-meta">{latest.turnoutPct.toFixed(1)}% turnout | {latest.electionLabel}</p>
            {priorElections.length ? (
              <ul className="show-up-meter-history">
                {priorElections.map((entry) => (
                  <li key={entry.electionId}>
                    <strong>{entry.electionLabel}:</strong> {entry.turnoutPct.toFixed(1)}%
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="show-up-meter-note">
              2025–2026 county turnout is published state-by-state, so coverage will expand as official files are added.
            </p>
          </>
        ) : (
          <p className="muted">Turnout data is not available for this county yet.</p>
        )}
        <div className="show-up-meter-cta">
          <p>Want to see higher voter turn out in your county? Click the button below to find out how.</p>
          <a href="https://patriotsinaction.com" target="_blank" rel="noreferrer">Learn More</a>
        </div>
      </div>
      <AdSlot slot="inline" className="ad-slot-meter" />
    </section>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  comparisonSeries,
  placeKey,
  placeLabel,
  type ComparisonPlace,
  type CountyComparison,
  type CountyFigure,
} from "../lib/fetch-county-comparison";
import type { FetchOutcome } from "../lib/fetch-content";

export function FetchCompoundFigures({
  places,
  query,
  onNavigate,
  finish,
}: {
  places: ComparisonPlace[];
  query: CountyComparison;
  onNavigate: () => void;
  finish: (o: FetchOutcome) => void;
}) {
  const criteria = query.criteria!;
  const [result, setResult] = useState<{ query: CountyComparison; rows: CountyFigure[][] }>();
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const rows: CountyFigure[][] = places.map(() => []);
    let next = 0;
    async function load() {
      while (next < places.length && !controller.signal.aborted) {
        const i = next++;
        for (const { measure } of criteria) {
          try {
            const series = await comparisonSeries(places[i], measure, controller.signal);
            rows[i].push(series.figure(query.year));
          } catch {
            rows[i].push({ text: "Temporarily unavailable." });
          }
          if (controller.signal.aborted) return;
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(4, places.length) }, load)).then(() => {
      if (controller.signal.aborted) return;
      setResult({ query, rows });
      finish(rows.some((row) => row.some((cell) => cell.value === undefined)) ? "partial" : "answer");
    });
    return () => controller.abort();
  }, [query, criteria, places, finish, attempt]);
  if (result?.query !== query) return <p role="status">Checking the figures for each place…</p>;
  const conditional = criteria.every((c) => c.direction);
  const comparisons = result.rows.map((cells) =>
    cells.map((cell, index) => {
      const baseline = result.rows[0][index];
      if (
        cell.value === undefined ||
        baseline.value === undefined ||
        !baseline.basis ||
        baseline.basis !== cell.basis ||
        !baseline.kind ||
        baseline.kind !== cell.kind ||
        (baseline.coverage ?? 100) < 100 ||
        (cell.coverage ?? 100) < 100
      )
        return undefined;
      return criteria[index].direction === "lower"
        ? cell.value < baseline.value
        : cell.value > baseline.value;
    }),
  );
  const matches = places.filter((_, i) => i > 0 && comparisons[i].every((match) => match === true));
  const incomplete = comparisons.slice(1).filter((row) => row.includes(undefined)).length;
  return (
    <section aria-label="Comparison results">
      {conditional && (
        <div>
          <p>Comparing each place with {placeLabel(places[0])}, using the published estimates.</p>
          <p>
            {matches.length
              ? "Meets all conditions: " + matches.map(placeLabel).join("; ") + "."
              : "No place with comparable figures meets all conditions."}
          </p>
          {incomplete > 0 && (
            <p>
              {incomplete} {incomplete === 1 ? "place has" : "places have"} missing or incompatible figures.
            </p>
          )}
        </div>
      )}
      {places.map((place, i) => {
        const cells = result.rows[i];
        const decisions = comparisons[i];
        return (
          <section key={placeKey(place)} aria-label={placeLabel(place)}>
            <h4>{placeLabel(place)}</h4>
            {conditional && (
              <p>
                <strong>
                  {i === 0
                    ? "Reference place"
                    : decisions.includes(undefined)
                      ? "Incomplete comparison"
                      : decisions.every(Boolean)
                        ? "Meets all conditions"
                        : "Does not meet all conditions"}
                </strong>
              </p>
            )}
            {cells.map((v, j) => {
              const { measure, direction } = criteria[j];
              const base = "fips" in place ? "/" + place.state.slug + "/" + place.slug : "/" + place.slug;
              const path = !("fips" in place)
                ? base
                : base + ("domain" in measure ? "/data/" + measure.domain : "/economic-data");
              return (
                <p key={measure.key}>
                  <Link
                    to={path}
                    data-fetch-target={
                      "fips" in place
                        ? "domain" in measure
                          ? "atlas-" + measure.key
                          : "econ-" + measure.series
                        : undefined
                    }
                    onClick={onNavigate}
                  >
                    {measure.label}
                  </Link>
                  {" · "}
                  {v.text}
                  {v.period && " · " + v.period}
                  {v.note && " · " + v.note}
                  {v.url && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={v.url} target="_blank" rel="noreferrer">
                        {v.source}
                      </a>
                    </>
                  )}
                  {conditional &&
                    i > 0 &&
                    (decisions[j] === undefined
                      ? " · Missing or incompatible figure"
                      : decisions[j]
                        ? " · " + direction + " than reference"
                        : " · Condition unmet")}
                </p>
              );
            })}
          </section>
        );
      })}
      {result.rows.some((row) => row.some((v) => v.text === "Temporarily unavailable.")) && (
        <button
          onClick={() => {
            setResult(undefined);
            retry((n) => n + 1);
          }}
        >
          Try again
        </button>
      )}
    </section>
  );
}

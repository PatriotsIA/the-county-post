import { useEffect, useMemo, useRef, useState } from "react";
import { FetchCompoundFigures } from "./FetchCompoundFigures";
import { Link } from "react-router-dom";
import { getCountiesForState } from "../data/counties";
import { getStateBySlug, states } from "../data/states";
import { formatAtlasValue } from "../lib/county-atlas-format";
import {
  comparisonSeries,
  placeKey,
  placeLabel as label,
  type ComparisonPlace,
  type CountySeries,
  countyMeasures,
  type CountyComparison,
  type CountyFigure,
  type CountySlot,
} from "../lib/fetch-county-comparison";
import type { FetchOutcome } from "../lib/fetch-content";

type Measure = (typeof countyMeasures)[number];

function difference(
  a: CountyFigure,
  b: CountyFigure,
  left: ComparisonPlace,
  right: ComparisonPlace,
  rank?: CountyComparison["rank"],
) {
  if (a.value === undefined || b.value === undefined) return;
  if (!a.basis || a.basis !== b.basis || !a.kind || a.kind !== b.kind)
    return "The periods, units or sources differ or are incomplete, so a direct difference is unavailable.";
  const selected = (rank === "low" ? a.value < b.value : a.value > b.value) ? left : right;
  const order = rank === "low" ? "lower" : "higher";
  if ([a, b].some((row) => row.coverage !== undefined && row.coverage < 100)) {
    const ordering =
      a.value === b.value
        ? "Participating agencies show the same figure in every selected place."
        : `Participating agencies in ${label(selected)} recorded the ${order} figure.`;
    return ordering + " Reporting coverage is incomplete, so a whole-county ranking is unavailable.";
  }
  const gap = Math.abs(a.value - b.value);
  if (!gap) return "Both places have the same published figure.";
  const amount =
    a.kind === "percent"
      ? `${Number(gap.toFixed(2))} percentage points`
      : formatAtlasValue(gap, a.kind, a.unit);
  const overlap = a.margin !== undefined && b.margin !== undefined && gap <= a.margin + b.margin;
  const summary = `${label(selected)} has the ${order} published figure by ${amount}.`;
  return overlap ? summary + " The published margins of error overlap." : summary;
}

function groupSummary(rows: CountyFigure[], places: ComparisonPlace[], rank?: CountyComparison["rank"]) {
  if (rows.length === 2) return difference(rows[0], rows[1], places[0], places[1], rank);
  if (rows.some((r) => r.value === undefined))
    return "A figure is missing for at least one place. The available figures are listed below.";
  if (
    !rows[0].basis ||
    !rows[0].kind ||
    rows.some((r) => r.basis !== rows[0].basis || r.kind !== rows[0].kind)
  )
    return "The periods, units or sources differ or are incomplete, so a group ranking is unavailable.";
  if (rows.some((r) => r.coverage !== undefined && r.coverage < 100))
    return "Reporting coverage is incomplete, so a whole-county ranking is unavailable.";
  const values = rows.map((r) => r.value!);
  const high = Math.max(...values),
    low = Math.min(...values);
  if (high === low) return "All selected places have the same published figure.";
  const at = (v: number) =>
    places
      .filter((_, i) => values[i] === v)
      .map(label)
      .join("; ");
  if (rank === "low")
    return `Lowest published figure: ${at(low)} (${rows[values.indexOf(low)].text}). Highest: ${at(high)} (${rows[values.indexOf(high)].text}).`;
  return `Highest published figure: ${at(high)} (${rows[values.indexOf(high)].text}). Lowest: ${at(low)} (${rows[values.indexOf(low)].text}).`;
}

function trendSummary(
  places: ComparisonPlace[],
  series: CountySeries[],
  requested: NonNullable<CountyComparison["trend"]>,
) {
  const shared = series[0].years
    .filter((year) => {
      const first = series[0].figure(year);
      return (
        first.basis &&
        first.kind &&
        series.every((s) => {
          if (!s.years.includes(year)) return false;
          const row = s.figure(year);
          return row.value !== undefined && row.kind === first.kind && row.basis === first.basis;
        })
      );
    })
    .sort();
  const from = requested.from || shared[0],
    to = requested.to || shared.at(-1);
  if (!from || !to || from >= to || !shared.includes(from) || !shared.includes(to))
    return (
      <p>
        A change comparison needs two matching published periods for all selected places
        {requested.from
          ? " covering " + [requested.from, requested.to].filter(Boolean).join(" to ")
          : ""}. {shared.length === 1 ? "Their one comparable year is " + shared[0] + "." : ""}
      </p>
    );
  const points = series.map((series) => [series.figure(from), series.figure(to)]);
  const rate = points[0][0].kind === "percent";
  if (!rate && points.some(([start]) => start.value! <= 0))
    return <p>A percentage change needs a positive starting value in every selected place.</p>;
  const changes = points.map(([start, end]) =>
    rate ? end.value! - start.value! : ((end.value! - start.value!) / start.value!) * 100,
  );
  const unit = rate ? " percentage points" : "%";
  const format = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 2, signDisplay: "exceptZero" }) + unit;
  const min = Math.min(...changes),
    max = Math.max(...changes);
  const leaders = places.filter((_, i) => Math.abs(changes[i] - (max > 0 ? max : min)) < 0.000001);
  const names = leaders.map((p) => ("fips" in p ? p.displayName : p.name)).join(", ");
  const incomplete = points.some((pair) => pair.some((r) => r.coverage !== undefined && r.coverage < 100));
  return (
    <div>
      <p>
        {from} to {to} ·{" "}
        {incomplete
          ? "Reporting coverage is incomplete, so a whole-county ranking is unavailable."
          : Math.abs(max - min) < 0.000001
            ? "All changed at the same rate."
            : names +
              " had the " +
              (places.length === 2 ? "larger " : "largest ") +
              (max > 0 ? "increase." : "decline.")}
      </p>
      {points.map(([start, end], i) => (
        <p key={i}>
          {label(places[i])} · {start.text} ({start.period}) to {end.text} ({end.period}) ·{" "}
          {format(changes[i])}
        </p>
      ))}
      {points.some((pair) => pair.some((row) => row.margin !== undefined)) && (
        <p>These changes use survey estimates and carry sampling uncertainty.</p>
      )}
    </div>
  );
}

function CountyFigures({
  places,
  measure,
  query,
  setYear,
  onNavigate,
  finish,
  showLatest,
}: {
  places: ComparisonPlace[];
  measure: Measure;
  query: CountyComparison;
  setYear: (year?: string) => void;
  showLatest: () => void;
  onNavigate: () => void;
  finish: (outcome: FetchOutcome) => void;
}) {
  const { year } = query;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, CountySeries | null>>({});
  const cache = useRef(new Map<string, CountySeries | null>());
  useEffect(() => {
    const abort = new AbortController();
    const pending = places.filter((p) => !cache.current.has(placeKey(p)));
    let next = 0;
    async function load() {
      while (!abort.signal.aborted && next < pending.length) {
        const place = pending[next++];
        const series = await comparisonSeries(place, measure, abort.signal).catch(() => null);
        if (abort.signal.aborted) return;
        const id = placeKey(place);
        cache.current.set(id, series);
        setLoaded((current) => ({ ...current, [id]: series }));
      }
    }
    void Promise.all(Array.from({ length: Math.min(4, pending.length) }, load));
    return () => abort.abort();
  }, [places, measure, attempt]);

  const series = places.map((p) => loaded[placeKey(p)]);
  const rows = series.map((s) =>
    s === null ? { text: "This place’s data is temporarily unavailable." } : s?.figure(year),
  );
  const ready = rows.every((r) => r !== undefined);
  const failed = series.some((s) => s === null);
  const outcome = series.every((s) => s === null)
    ? "unavailable"
    : rows.every((r) => r?.value !== undefined)
      ? "answer"
      : !failed && rows.every((r) => r?.value === undefined)
        ? "empty"
        : "partial";
  const complete = query.slots.every((s) => s.county || s.statewide);
  useEffect(() => {
    if (ready && complete) finish(outcome);
  }, [ready, complete, outcome, finish, query]);
  const years = [...new Set([...(year ? [year] : []), ...series.flatMap((s) => s?.years || [])])]
    .sort()
    .reverse();
  const summary = ready && complete && groupSummary(rows, places, query.rank);
  return (
    <section className="fetch-measure">
      {!query.trend && !!years.length && (
        <label>
          Year
          <select value={year || ""} onChange={(e) => setYear(e.target.value || undefined)}>
            <option value="">Latest available</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      )}
      <h4>
        {measure.label}
        {year && ` · ${year}`}
      </h4>
      {query.trend && ready && (
        <>
          {complete && series.every((s) => s != null) && trendSummary(places, series, query.trend)}
          <button onClick={showLatest}>
            Compare latest {measure.key === "median-gross-rent" ? "rents" : "figures"}
          </button>
        </>
      )}
      {!query.trend && summary && <p>{summary}</p>}
      {failed && (
        <button
          onClick={() => {
            for (const [id, value] of cache.current) if (value === null) cache.current.delete(id);
            setLoaded((current) => Object.fromEntries(Object.entries(current).filter(([, v]) => v !== null)));
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      )}
      {places.map((c, i) => {
        const row = rows[i];
        const path =
          "fips" in c
            ? "/" +
              c.state.slug +
              "/" +
              c.slug +
              ("domain" in measure ? "/data/" + measure.domain : "/economic-data")
            : "/" + c.slug;
        return (
          <section key={placeKey(c)} aria-label={label(c)}>
            <h4>{label(c)}</h4>
            <p>
              {query.trend && row?.value !== undefined && "Latest figure · "}
              {row ? (
                <>
                  <strong>{row.text}</strong>
                  {row.period && " · " + row.period}
                </>
              ) : (
                "Checking the published figures…"
              )}
            </p>
            {row?.note && <p>{row.note}</p>}
            {row?.source && (
              <p>
                {row.url && /^https?:\/\//i.test(row.url) ? (
                  <a href={row.url} target="_blank" rel="noreferrer">
                    {row.source}
                  </a>
                ) : (
                  row.source
                )}
              </p>
            )}
            <Link
              data-fetch-target={
                row?.value !== undefined && "fips" in c
                  ? "domain" in measure
                    ? "atlas-" + measure.key
                    : "econ-" + measure.series
                  : undefined
              }
              to={path}
              onClick={onNavigate}
            >
              Open {"fips" in c ? c.displayName + " data" : "the " + c.name + " edition"}
            </Link>
          </section>
        );
      })}
    </section>
  );
}

export function FetchCountyComparison({
  query,
  update,
  onNavigate,
  finish,
}: {
  query: CountyComparison;
  update: (q: CountyComparison) => void;
  onNavigate: () => void;
  finish: (outcome: FetchOutcome) => void;
}) {
  const places = useMemo(
    () => [
      ...new Set(
        query.slots.flatMap((s) => {
          const place = s.county || s.statewide;
          return place ? [place] : [];
        }),
      ),
    ],
    [query.slots],
  );
  const selected = useMemo(() => new Set(places.map(placeKey)), [places]);
  const unresolved = query.slots.some((s) => !s.county && !s.statewide);
  const [editing, setEditing] = useState<number>();
  const mixed = query.slots.some((s) => s.statewide);
  const referenceState = query.slots[0]?.state;
  function change(i: number, slot: CountySlot) {
    update({ ...query, slots: query.slots.map((s, index) => (i === index ? slot : s)) });
  }
  return (
    <section className="fetch-answer fetch-comparison">
      <h3>{mixed ? "Compare states and counties" : "Compare counties"}</h3>
      {query.guidance && <p>{query.guidance}</p>}
      {unresolved && (
        <p>Choose a state and county for each place, then choose a measure. You can add more places below.</p>
      )}
      {query.criteria && !unresolved && places.length >= 2 && (
        <>
          <label>
            Comparison year{" "}
            <input
              type="number"
              placeholder="Latest"
              min="1900"
              max="2099"
              defaultValue={query.year || ""}
              key={query.year || "latest"}
              onBlur={(e) => {
                const year = e.target.value;
                if ((!year || /^(?:19|20)\d{2}$/.test(year)) && year !== (query.year || ""))
                  update({ ...query, year: year || undefined });
              }}
            />
          </label>
          <FetchCompoundFigures places={places} query={query} onNavigate={onNavigate} finish={finish} />
        </>
      )}
      {query.criteria && places.length === 1 && (
        <div>
          <p>{label(places[0])} is your reference. Choose another place below.</p>
          {referenceState && (
            <button
              onClick={() =>
                update({
                  ...query,
                  slots: [
                    ...query.slots,
                    ...getCountiesForState(referenceState.slug)
                      .filter((county) => !selected.has(county.fips))
                      .map((county) => ({ county, state: referenceState })),
                  ],
                })
              }
            >
              Compare all counties in {referenceState.name}
            </button>
          )}
        </div>
      )}
      {!query.criteria && query.measure && places.length >= 2 && (
        <CountyFigures
          key={query.measure.key}
          places={places}
          measure={query.measure}
          query={query}
          showLatest={() => update({ ...query, year: undefined, trend: undefined })}
          setYear={(year) => update({ ...query, year })}
          onNavigate={onNavigate}
          finish={finish}
        />
      )}
      <div className="fetch-state-pickers" aria-live="off">
        {query.slots.map((s, i) =>
          query.slots.length > 8 && editing !== i && (s.county || s.statewide) ? (
            <button key={i} onClick={() => setEditing(i)}>
              Edit {label((s.county || s.statewide)!)}
            </button>
          ) : (
            <div key={i}>
              {(s.county || s.statewide) && (
                <button
                  aria-label={"Change place " + (i + 1) + " · " + label((s.county || s.statewide)!)}
                  onClick={() => {
                    setEditing(i);
                    document.getElementById("fetch-state-slot-" + i)?.focus();
                  }}
                >
                  Change place
                </button>
              )}
              {s.name && !s.county && !s.statewide && <p>Which place did you mean by “{s.name}”?</p>}
              <label>
                State {i + 1}
                <select
                  id={"fetch-state-slot-" + i}
                  value={s.state?.slug || ""}
                  onChange={(e) => change(i, { state: getStateBySlug(e.target.value) })}
                >
                  <option value="">Choose state</option>
                  {states.map((state) => (
                    <option key={state.slug} value={state.slug}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                County {i + 1}
                <select
                  disabled={!s.state && !s.candidates?.length}
                  value={s.statewide ? "statewide" : s.county?.fips || ""}
                  onChange={(e) => {
                    if (e.target.value === "statewide") {
                      change(i, { state: s.state, statewide: s.state });
                      return;
                    }
                    const options = s.candidates || getCountiesForState(s.state?.slug);
                    const c = options.find((c) => c.fips === e.target.value);
                    change(i, {
                      state: c?.state || s.state,
                      county: c,
                      candidates: s.state ? s.candidates : undefined,
                    });
                  }}
                >
                  <option value="">{s.candidates?.length ? "Which county?" : "Choose county"}</option>
                  {s.state && !s.candidates && (
                    <option value="statewide" disabled={!s.statewide && selected.has(s.state.slug)}>
                      Entire state of {s.state.name}
                    </option>
                  )}
                  {(s.candidates || getCountiesForState(s.state?.slug)).map((c) => (
                    <option key={c.fips} value={c.fips} disabled={s.county !== c && selected.has(c.fips)}>
                      {s.candidates ? label(c) : c.displayName}
                    </option>
                  ))}
                </select>
              </label>
              {query.slots.length > 2 && (
                <button
                  aria-label={"Remove place " + (i + 1)}
                  onClick={() => {
                    setEditing(undefined);
                    update({ ...query, slots: query.slots.filter((_, index) => index !== i) });
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ),
        )}
      </div>
      <button
        onClick={() => update({ ...query, slots: [...query.slots, { state: query.slots.at(-1)?.state }] })}
      >
        Add another place
      </button>
      <label>
        Measure
        <select
          value={query.measure?.key || ""}
          onChange={(e) =>
            update({
              ...query,
              criteria: undefined,
              measure: countyMeasures.find((m) => m.key === e.target.value),
              guidance: undefined,
            })
          }
        >
          <option value="" disabled>
            Choose a measure
          </option>
          {countyMeasures.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {!unresolved && places.length < 2 && <p>Choose two different places.</p>}
    </section>
  );
}

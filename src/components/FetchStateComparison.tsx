import { Link } from "react-router-dom";
import { stateData, populationSource } from "../lib/fetch-state-data";
import { states } from "../data/states";
import { getCountiesForState } from "../data/counties";
import { stateMeasures, type Comparison, type StateMeasure } from "../lib/fetch-state-comparison";

const number = new Intl.NumberFormat("en-US");
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function FetchStateComparison({
  query,
  update,
  onNavigate,
}: {
  query: Comparison;
  update: (next: Comparison) => void;
  onNavigate: () => void;
}) {
  const { places, metrics, years } = query;
  const slots = Math.min(states.length, Math.max(2, places.length + 1));
  return (
    <section className="fetch-answer fetch-comparison">
      <h3>Compare states</h3>
      <p>Choose states and a measure, or ask “Compare rent and income in Texas, Oklahoma and Kansas.”</p>
      {places.length > 0 &&
        stateMeasures
          .filter((m) => metrics.includes(m.key))
          .map((m) => {
            const currency = ["rent", "income", "perCapita", "homeValue"].includes(m.key);
            const format = (v: number) => (currency ? money.format(v) : number.format(v));
            return (m.key === "population" ? (years.length ? years : [2025]) : [0]).map((year) => {
              const values = places.map((state) => {
                const row = stateData[state.name];
                if (m.key === "population") return { value: row?.population[year], margin: undefined };
                if (m.key === "counties")
                  return {
                    value: years.length ? undefined : getCountiesForState(state.slug).length,
                    margin: undefined,
                  };
                const pair =
                  !years.length || years.every((y) => y === 2024) || query.surveyPeriod
                    ? row?.[m.key]
                    : undefined;
                return { value: pair?.[0], margin: pair?.[1] };
              });
              const period =
                m.key === "population"
                  ? `July 1, ${year}`
                  : m.key === "counties"
                    ? "Current site directory"
                    : "2020–2024 survey estimate";
              const [a, b] = values.map((v) => v.value);
              return (
                <section key={m.key + year} className="fetch-measure">
                  <h4>{m.label}</h4>
                  <p>{period}</p>
                  <dl>
                    {places.map((state, i) => (
                      <div key={state.slug}>
                        <dt>{state.name}</dt>
                        <dd>
                          {values[i].value === undefined ? "Unavailable" : format(values[i].value!)}
                          {values[i].margin !== undefined && <small> ±{format(values[i].margin!)}</small>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {values.every((v) => v.value === undefined) ? (
                    <p>
                      No figure for the requested year.{" "}
                      {m.key === "population"
                        ? "Choose a year from 2020 through 2025."
                        : m.key === "counties"
                          ? "Directory counts cover the current edition."
                          : "This survey covers 2020–2024."}
                    </p>
                  ) : (
                    <>
                      {values.length > 2 &&
                        values.every((v) => v.value !== undefined) &&
                        (() => {
                          const figures = values.map((v) => v.value!);
                          const high = Math.max(...figures),
                            low = Math.min(...figures);
                          const at = (value: number) =>
                            places
                              .filter((_, i) => figures[i] === value)
                              .map((s) => s.name)
                              .join(", ");
                          return (
                            <p>
                              {high === low
                                ? "All selected states have the same published figure."
                                : query.rank === "low"
                                  ? `Lowest: ${at(low)} (${format(low)}). Highest: ${at(high)} (${format(high)}).`
                                  : `Highest: ${at(high)} (${format(high)}). Lowest: ${at(low)} (${format(low)}).`}
                            </p>
                          );
                        })()}
                      {values.length === 2 && a !== undefined && b !== undefined && (
                        <p>
                          {a === b
                            ? "The published figures are equal."
                            : `${places[(query.rank === "low" ? a < b : a > b) ? 0 : 1].name} has the ${query.rank === "low" ? "lower" : "higher"} figure. The published ${m.key === "counties" ? "counts" : "estimates"} differ by ${format(Math.abs(a - b))}${m.key === "age" ? " years" : ""}.`}
                        </p>
                      )}
                    </>
                  )}
                  <a
                    href={
                      m.key === "population"
                        ? populationSource
                        : "table" in m
                          ? "https://data.census.gov/table/ACSDT5Y2024." + m.table
                          : "/states"
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {m.key === "counties"
                      ? "County Post directory"
                      : "table" in m
                        ? "Census survey table " + m.table
                        : "Census population estimates · Vintage 2025"}
                  </a>
                  {"table" in m && <small>± shows the survey’s margin of error.</small>}
                </section>
              );
            });
          })}
      {metrics.includes("population") &&
        years.length >= 2 &&
        places.length > 0 &&
        years.every((y) => y >= 2020 && y <= 2025) && (
          <section className="fetch-measure">
            <h4>
              Population change, {Math.min(...years)}–{Math.max(...years)}
            </h4>
            {places.map((s) => {
              const row = stateData[s.name].population;
              const start = row[Math.min(...years)],
                end = row[Math.max(...years)];
              const delta = end - start;
              return (
                <p key={s.slug}>
                  {s.name} · {delta >= 0 ? "+" : "−"}
                  {number.format(Math.abs(delta))} ({((100 * delta) / start).toFixed(1)}%)
                </p>
              );
            })}
          </section>
        )}
      <div className="fetch-state-pickers" aria-live="off">
        {Array.from({ length: slots }, (_, i) => (
          <div key={i}>
            {places[i] && (
              <button
                aria-label={`Change place ${i + 1} · ${places[i].name}`}
                onClick={() => document.getElementById("fetch-comparison-state-" + i)?.focus()}
              >
                Change place
              </button>
            )}
            <label>
              {i >= 2 && i === places.length ? "Add a state" : "State " + (i + 1)}
              <select
                id={"fetch-comparison-state-" + i}
                disabled={i > 0 && !places[i - 1]}
                value={places[i]?.slug || ""}
                onChange={(event) => {
                  const state = states.find((s) => s.slug === event.target.value);
                  if (!state) update({ ...query, places: places.filter((_, index) => index !== i) });
                  else {
                    const next = [...places];
                    next[i] = state;
                    update({ ...query, places: next.filter(Boolean) });
                  }
                }}
              >
                <option value="">{places[i] ? "Remove this state" : "Choose a state"}</option>
                {states.map((s) => (
                  <option
                    key={s.slug}
                    value={s.slug}
                    disabled={places.some((p, j) => j !== i && p.slug === s.slug)}
                  >
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
      {query.guidance && <p>{query.guidance}</p>}
      <label>
        Measure
        <select
          value={metrics.length === 1 ? metrics[0] : ""}
          onChange={(event) =>
            update({
              ...query,
              metrics: [event.target.value as StateMeasure],
              years: [],
              guidance: undefined,
            })
          }
        >
          <option value="" disabled>
            {metrics.length ? "Multiple measures shown" : "Choose a measure"}
          </option>
          {stateMeasures.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {metrics.includes("population") && (
        <label>
          Population year
          <select
            value={years.length === 1 ? years[0] : years.length ? "" : 2025}
            onChange={(event) => update({ ...query, years: [Number(event.target.value)] })}
          >
            {(years.length > 1 || years.some((y) => y < 2020 || y > 2025)) && (
              <option value={years.length === 1 ? years[0] : ""}>{years.join(", ")}</option>
            )}
            {[2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      )}
      {places.map((s) => (
        <Link key={s.slug} to={"/" + s.slug} onClick={onNavigate}>
          Open the {s.name} edition
        </Link>
      ))}
    </section>
  );
}

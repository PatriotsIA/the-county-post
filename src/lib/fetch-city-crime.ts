import cityCrime from "../data/fetch-city-crime.json";
import { asksForLowerFigure } from "./fetch-comparison-followup";
import { cityLabel, type CityArea } from "./fetch-city";
import type { ContentResult } from "./fetch-content";

const categories = [
  "murder",
  "rape",
  "robbery",
  "aggravated assault",
  "burglary",
  "larceny",
  "motor vehicle theft",
  "arson",
  "human trafficking",
];
const violent = [0, 1, 2, 3, 8];
const property = [4, 5, 6, 7];

export function crimeStatistic(text: string) {
  const offense =
    /\b(?:crime|murders?|homicides?|rapes?|robber(?:y|ies)|aggravated assaults?|burglar(?:y|ies)|larceny|(?:auto|car|motor vehicle) theft|arson|human trafficking)\b/i.test(
      text,
    );
  const stats =
    /\b(?:rates?|statistic\w*|stats|per capita|per 100,?000|higher|lower|more|fewer|compar\w*|how many)\b/i.test(
      text,
    );
  return offense && stats && !/\b(?:articles?|stories|news|headlines?|feeds?)\b/i.test(text);
}

function crimeMeasure(text: string) {
  if (
    /\b(?:hate|cyber|financial|drug|gun|organized|white.collar|juvenile|domestic|sexual assault|fraud|shoplifting)\b/i.test(
      text,
    )
  )
    return;
  const category = categories.findIndex((c) => new RegExp("\\b" + c + "s?\\b", "i").test(text));
  const aliases = /homicide/i.test(text)
    ? 0
    : /robberies/i.test(text)
      ? 2
      : /burglaries/i.test(text)
        ? 4
        : /(?:auto|car) theft/i.test(text)
          ? 6
          : -1;
  const idx = category >= 0 ? category : aliases;
  if (idx >= 0) return { label: categories[idx], columns: [idx] };
  if (/\bviolent\b/i.test(text)) return { label: "violent index crime", columns: violent };
  if (/\bproperty\b/i.test(text)) return { label: "property index crime", columns: property };
  return { label: "index crime", columns: categories.map((_, i) => i) };
}

const records: Record<string, { ori: string; population: number; offenses: number[] }> = cityCrime.records;
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export function cityCrimeAnswer(places: CityArea[], question: string): ContentResult {
  const years = question.match(/\b(?:19|20)\d{2}\b/g) || [];
  const yearAvailable =
    years.every((y) => y === String(cityCrime.year)) &&
    !/\b(?:trend|over time|this year|this month|last month|today|this week)\b/i.test(question);
  let subject = question.toLowerCase();
  for (const place of places) subject = subject.replaceAll(place.name.toLowerCase(), " ");
  const measure = crimeMeasure(subject);
  const lower = asksForLowerFigure(subject);
  const volume =
    /\b(?:how many|counts?|number of|volume|more|fewer)\b/i.test(question) &&
    !/\b(?:rates?|per capita|per 100,?000)\b/i.test(question);
  const rows = [...new Set(places)].map((place) => {
    const agencies = place.counties.flatMap((c) => {
      const record = c.state.abbr === "TX" && records[place.name.toUpperCase() + "|" + c.name.toUpperCase()];
      return record ? [record] : [];
    });
    const agency = agencies.length === 1 ? agencies[0] : undefined;
    const count = agency && measure && measure.columns.reduce((n, col) => n + agency.offenses[col], 0);
    return {
      place,
      agency,
      count,
      rate: agency && count !== undefined ? (count * 100000) / agency.population : undefined,
    };
  });
  const lines: string[] = [];
  if (!yearAvailable)
    lines.push(
      `This city dataset covers calendar year ${cityCrime.year}. The requested period is unavailable.`,
    );
  else if (!measure)
    lines.push(
      "The Texas index tables do not identify that measure separately. You can ask about index crime, violent crime or property crime for these cities.",
    );
  else if (rows.length === 2 && rows.every((row) => row.rate !== undefined)) {
    const [a, b] = rows;
    const gap = volume
      ? a.count! - b.count!
      : Math.round(a.rate! * 100) / 100 - Math.round(b.rate! * 100) / 100;
    const high = gap >= 0 ? a : b;
    const low = gap >= 0 ? b : a;
    const statistic = volume ? "offense count" : "rate";
    const figures = volume
      ? `${high.place.name} reported ${high.count!.toLocaleString("en-US")} offenses and ${cityLabel(low.place)} reported ${low.count!.toLocaleString("en-US")}.`
      : `Per 100,000 residents served, ${high.place.name} reported ${number.format(high.rate!)} offenses and ${cityLabel(low.place)} reported ${number.format(low.rate!)}.`;
    lines.push(
      gap === 0
        ? `Both police departments reported the same ${measure.label} ${statistic} in ${cityCrime.year}. ${figures}`
        : `${cityLabel(lower ? low.place : high.place)} had the ${lower ? "lower" : "higher"} reported ${measure.label} ${statistic} in ${cityCrime.year}. ${figures}`,
    );
  } else if (rows.length > 2 && rows.every((row) => row.rate !== undefined)) {
    const figures = rows.map((row) => (volume ? row.count! : Math.round(row.rate! * 100) / 100));
    const high = Math.max(...figures),
      low = Math.min(...figures);
    const names = (value: number) =>
      rows
        .filter((_, i) => figures[i] === value)
        .map((r) => cityLabel(r.place))
        .join(" and ");
    const format = (n: number) =>
      volume ? n.toLocaleString("en-US") + " offenses" : number.format(n) + " per 100,000 residents served";
    lines.push(
      high === low
        ? `All selected police departments reported the same ${measure.label} ${volume ? "count" : "rate"} in ${cityCrime.year} (${format(high)}).`
        : `${lower ? "Lowest" : "Highest"} reported ${measure.label} ${volume ? "count" : "rate"} in ${cityCrime.year}: ${names(lower ? low : high)} (${format(lower ? low : high)}). ${lower ? "Highest" : "Lowest"}: ${names(lower ? high : low)} (${format(lower ? high : low)}).`,
    );
  } else if (rows.length > 1)
    lines.push(
      "A comparison needs a full year of reports and a population served for each selected police department.",
    );
  if (measure?.label === "index crime")
    lines.push("Index crime includes the violent and property offenses tracked in the Texas DPS report.");
  lines.push(
    "Rates use each municipal police department’s reporting jurisdiction. County editions are linked below for geographic context.",
  );
  return {
    heading: "City crime statistics",
    lines,
    outcome:
      !measure || !yearAvailable || rows.every((row) => !row.agency)
        ? "empty"
        : rows.some((row) => !row.agency)
          ? "partial"
          : "answer",
    sections: rows.map(({ place, agency, count, rate }) => ({
      label: cityLabel(place),
      lines: [
        !yearAvailable
          ? "No figure for the requested period."
          : !measure
            ? "No separate figure for that measure."
            : !agency || rate === undefined
              ? "Fetch has no verified full-year city police figure for this place. The current dataset covers participating Texas municipal police departments."
              : `${place.name} Police Department · ${cityCrime.year} · ${number.format(rate)} reported ${measure.label} offenses per 100,000 residents served (${count!.toLocaleString("en-US")} offenses, population ${agency.population.toLocaleString("en-US")}, 12 months reported).`,
      ],
      links: place.counties.map((c) => ({
        title: c.displayName + " public safety",
        url: `/${c.state.slug}/${c.slug}/data/public-safety`,
      })),
    })),
    links: [{ title: "Texas DPS · 2025 Crime by Jurisdiction (spreadsheet)", url: cityCrime.source }],
  };
}

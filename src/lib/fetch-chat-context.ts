// Backups carry stable edition IDs and measure keys. Rehydrate them against the current
// directory so a follow-up uses the same objects and comparison rules as a fresh question.
import type { FetchView } from "../components/FetchGuide";
import { counties } from "../data/counties";
import { states } from "../data/states";
import { fetchDesks } from "../data/fetch-guide";
import { tourLessons } from "../data/fetch-lessons";
import { countyAtlasDomains } from "./county-atlas-api";
import { answerLabels, type ContentLink } from "./fetch-content";
import { countyMeasures } from "./fetch-county-comparison";
import { stateMeasures } from "./fetch-state-comparison";
import type { CityArea } from "./fetch-city";

type Reader<T> = (value: unknown) => T;
export function invalid(): never {
  throw new Error("This file is not a supported Fetch chat backup.");
}
export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid();
}
export const string = (v: unknown) => (typeof v === "string" ? v : invalid());
const bool = (v: unknown) => (typeof v === "boolean" ? v : invalid());
export const integer = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) ? v : invalid());
const optional =
  <T>(read: Reader<T>) =>
  (v: unknown) =>
    v == null ? undefined : read(v);
export const list =
  <T>(read: Reader<T>) =>
  (v: unknown) =>
    Array.isArray(v) ? v.map(read) : invalid();
function nonempty<T>(read: Reader<T>) {
  return (v: unknown) => {
    const items = list(read)(v);
    return items.length ? items : invalid();
  };
}
const oneOf =
  <T extends string>(options: readonly T[]) =>
  (v: unknown) =>
    options.includes(v as T) ? (v as T) : invalid();
function fields<S extends Record<string, Reader<unknown>>>(schema: S) {
  return (value: unknown) => {
    const raw = record(value);
    return Object.fromEntries(Object.entries(schema).map(([key, read]) => [key, read(raw[key])])) as {
      [K in keyof S]: ReturnType<S[K]>;
    };
  };
}
export function safeLink(value: unknown) {
  const url = string(value);
  if (
    !url ||
    (/^\/(?!\/)/.test(url) &&
      !url.includes("\\") &&
      new URL(url, "https://example.org").origin === "https://example.org")
  )
    return url;
  const parsed = new URL(url);
  return ["https:", "http:"].includes(parsed.protocol) ? url : invalid();
}
const byFips = new Map(counties.map((c) => [c.fips, c]));
const byState = new Map(states.map((s) => [s.slug, s]));
const byMeasure = new Map(countyMeasures.map((m) => [m.key, m]));
const ids = new Map<object, string>([
  ...counties.map((c) => [c, c.fips] as const),
  ...states.map((s) => [s, s.slug] as const),
  ...countyMeasures.map((m) => [m, m.key] as const),
]);
const county = (v: unknown) => byFips.get(string(v)) ?? invalid();
const state = (v: unknown) => byState.get(string(v)) ?? invalid();
const measure = (v: unknown) => byMeasure.get(string(v)) ?? invalid();
const desk = oneOf(Object.keys(fetchDesks) as (keyof typeof fetchDesks)[]);
const atlasChoice = optional(
  fields({ label: string, domain: oneOf(countyAtlasDomains), metric: optional(string) }),
);
const task = fields({ desk, teach: bool, question: string, atlasChoice });
const lookup = fields({
  kind: oneOf(Object.keys(answerLabels) as (keyof typeof answerLabels)[]),
  question: string,
  county: optional(county),
  state: optional(state),
  cityName: optional(string),
  relatedUrl: optional(safeLink),
  atlasChoice,
});
const area = fields({
  name: string,
  counties: (v: unknown) => {
    const c = list(county)(v);
    return c.length ? c : invalid();
  },
});
const story = fields({
  title: string,
  url: safeLink,
  credit: optional(string),
  excerpt: optional(string),
  publisher: optional(string),
  publicationDate: optional(string),
  targetId: optional(string),
});
const action = oneOf(["detail", "publisher", "date", "open", "related"] as const);
const rank = optional(oneOf(["low", "high"] as const));
const countyQuery = fields({
  slots: list(
    fields({
      county: optional(county),
      state: optional(state),
      statewide: optional(state),
      candidates: optional(list(county)),
      name: optional(string),
    }),
  ),
  year: optional(string),
  measure: optional(measure),
  criteria: optional(list(fields({ measure, direction: optional(oneOf(["lower", "higher"] as const)) }))),
  trend: optional(fields({ from: optional(string), to: optional(string) })),
  rank,
  guidance: optional(string),
});
const link = fields({ label: string, to: safeLink, targetId: optional(string), external: optional(bool) });
function row(v: unknown) {
  const r = record(v);
  switch (r.mode) {
    case "answer":
      return { mode: r.mode, lookup: lookup(r.lookup) } as const;
    case "message":
      return { mode: r.mode, text: string(r.text) } as const;
    case "desk":
      return {
        mode: r.mode,
        ...fields({ link, desk, edition: optional(string), explanation: optional(string) })(r),
      } as const;
    default:
      return invalid();
  }
}
function viewFrom(v: unknown): FetchView {
  const r = record(v);
  switch (r.mode) {
    case "welcome":
    case "browse":
      return { mode: r.mode };
    case "answer":
    case "desk":
    case "message":
      return row(r);
    case "tour": {
      const step = integer(r.step);
      // Chats saved before the two introductions used the site tour's step numbers.
      const guide = r.guide === undefined ? "site" : oneOf(["site", "fetch"] as const)(r.guide);
      return tourLessons[guide][step] ? { mode: r.mode, guide, step } : invalid();
    }
    case "compare":
      return {
        mode: r.mode,
        query: fields({
          places: list(state),
          metrics: list(oneOf(stateMeasures.map((m) => m.key))),
          years: list(integer),
          guidance: optional(string),
          surveyPeriod: optional(bool),
          rank,
        })(r.query),
      };
    case "compareCounties":
      return { mode: r.mode, query: countyQuery(r.query) };
    case "place":
      return {
        mode: r.mode,
        ...fields({ task, region: optional(state), matches: list(county), text: string })(r),
      };
    case "cities":
      return { mode: r.mode, ...fields({ task, places: list(area), spelling: optional(string) })(r) };
    case "cityCrime":
      return { mode: r.mode, choices: nonempty(nonempty(area))(r.choices), question: string(r.question) };
    case "cityLocations":
      return { mode: r.mode, choices: nonempty(nonempty(area))(r.choices), query: countyQuery(r.query) };
    case "options":
      return {
        mode: r.mode,
        ...fields({
          question: string,
          place: string,
          county: optional(county),
          scope: (v) => (v === null ? null : optional(state)(v)),
          city: optional(fields({ places: list(area), subject: string })),
          options: list(fields({ desk, label: string, query: optional(string) })),
        })(r),
      };
    case "story":
      return {
        mode: r.mode,
        ...fields({
          lookup,
          stories: list(story),
          action,
          story: optional(story),
          choices: optional(list(story)),
        })(r),
      };
    case "area": {
      const a = area(r.area),
        rows = list(row)(r.rows);
      if (rows.length !== a.counties.length) return invalid();
      return {
        mode: r.mode,
        area: a,
        rows,
        task: task(r.task),
        storyChoices: optional(
          fields({ action, entries: list(fields({ lookup, story, siblings: list(story) })) }),
        )(r.storyChoices),
      };
    }
    default:
      return invalid();
  }
}
const filters = fields({
  since: optional(integer),
  earlier: optional(fields({ shownUrls: list(safeLink), before: optional(integer) })),
});
export type HistoryFilters = { since?: number; earlier?: { shownUrls: string[]; before?: number } };
export type ChatContext = {
  view: FetchView;
  stories: ContentLink[];
  areaStories: ContentLink[][];
  narrowedFrom?: CityArea;
  filters?: HistoryFilters;
};
export function packContext(context: ChatContext): string {
  return JSON.stringify(context, (_key, v) => ids.get(v) ?? v);
}
export function unpackContext(raw: string): ChatContext {
  const c = record(JSON.parse(raw));
  return {
    view: viewFrom(c.view),
    stories: list(story)(c.stories),
    areaStories: list(list(story))(c.areaStories),
    narrowedFrom: optional(area)(c.narrowedFrom),
    filters: optional(filters)(c.filters),
  };
}

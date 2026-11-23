import { dateInputValue, changesWindow } from "../lib/fetch-visits";
import { FetchMarketQuotes } from "./FetchMarketQuotes";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { forecastTimeZone, selectForecast } from "../lib/fetch-weather";
import { fetchCountyWeather, weatherPeriodId } from "../lib/county-weather-api";
import { economicObservation, fetchCountyEconomicData, formatMetricValue } from "../lib/county-economy-api";
import type { NewsFeedItem } from "../lib/news-api";
import { articleTimestamp, feedExcerpt, findFeedArticles } from "../lib/fetch-articles";

import {
  answerLabels,
  lookupContent,
  siteCatalog,
  storiesFor,
  findAtlasMeasures,
  nextPublishedMeeting, meetingsPublishedSince,
  type AnswerRequest,
  type AtlasChoice,
  type ContentResult,
  type ContentLink,
  type EarlierCoverage,
} from "../lib/fetch-content";
export type { AnswerRequest } from "../lib/fetch-content";

type LookupOptions = { refresh?: boolean; earlier?: EarlierCoverage; briefingDates?: boolean; since?: number };

async function readArticles(
  { question, county, state, relatedUrl }: AnswerRequest,
  signal: AbortSignal,
  publish: (data: ContentResult) => void,
  options: LookupOptions = {},
): Promise<ContentResult> {
  const articleLinks = (items: NewsFeedItem[], terms?: string[]) =>
    items.map((a) => {
      const publicationDate = articleDate(a.publishedAt);
      return {
        title: a.title,
        url: a.link,
        excerpt: feedExcerpt(a, terms),
        publisher: a.source || undefined,
        publicationDate,
        credit: [
          a.source,
          publicationDate || (options.briefingDates ? "Publication date unavailable" : ""),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    });
  const { articles, partial, stale, lastUpdate, briefing, period, older, terms, earlierCoverage } =
    await findFeedArticles(
      question,
      county,
      state,
      signal,
      (items) =>
        publish({
          lines: ["Checking additional desks…"],
          links: articleLinks(items),
        }),
      relatedUrl,
      options,
    );
  const lines: string[] = [];
  if (period && (articles.length || !partial)) {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (older || !articles.length)
      lines.push(
        `I found no matching report published ${period} in the feeds I could read (${zone}).${older ? " Here’s the latest earlier match." : ""}`,
      );
    else lines.push(`Published ${period} (${zone}).`);
  }
  if (options.since !== undefined && articles.length) lines.push("Up to five newly published headlines from the feeds checked.");
  if (options.earlier)
    lines.push(
      articles.length
        ? "Additional matches from deeper in this edition’s feeds."
        : "No additional matches were found in the feed records I could read.",
    );
  if (!options.earlier && !period && !articles.length && !partial)
    lines.push(
      options.since !== undefined ? "No newly published local headlines found in the feeds checked." : briefing
        ? "There are no stories in this edition’s current feeds."
        : "I couldn’t find a match in the current feeds. Try a name or a more specific subject.",
    );
  if (stale) {
    lines.push(
      "The feed includes cached reports. " +
        (lastUpdate === undefined
          ? "Check the publication dates for freshness."
          : "Oldest cached feed update · " +
            new Date(lastUpdate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) +
            " (your local time)."),
    );
  }
  if (partial)
    lines.push(
      articles.length
        ? "Some news sources were unavailable. These results may be incomplete."
        : "I couldn’t check all the feeds. Try again shortly.",
    );
  return {
    outcome: partial
      ? articles.length
        ? "partial"
        : "unavailable"
      : !articles.length || older
        ? "empty"
        : "answer",
    heading: briefing ? "News briefing" : undefined,
    lines,
    links: articleLinks(articles, terms),
    earlierCoverage,
    cached: stale,
  };
}

async function searchEdition(
  request: AnswerRequest,
  signal: AbortSignal,
  publish: (data: ContentResult) => void,
  options: LookupOptions,
) {
  const { question, county, state } = request;
  const deskSignal =
    typeof AbortSignal.any === "function" ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : signal;
  const pages = siteCatalog(question, county, state);
  const desks = county ? (["notices", "sources", "videos"] as const) : (["videos"] as const);
  const records = new Map<string, ContentResult>();
  let choices: AtlasChoice[] = [];
  let atlasUnavailable = false;
  let news: ContentResult = { lines: [] };
  function snapshot(final: boolean): ContentResult {
    const sections = [{ label: "Site pages and features", links: pages }];
    const missing: string[] = [];
    for (const desk of desks) {
      const result = records.get(desk);
      if (result?.links?.length)
        sections.push({ label: answerLabels[desk], links: result.links.slice(0, 4) });
      if (result?.outcome === "partial" || result?.outcome === "unavailable")
        missing.push(answerLabels[desk].toLowerCase());
    }
    const found = sections.some((s) => s.links.length) || choices.length > 0 || Boolean(news.links?.length);
    const partial =
      atlasUnavailable || missing.length > 0 || news.outcome === "unavailable" || news.outcome === "partial";
    const lines = [...news.lines];
    if (atlasUnavailable) lines.push("Some county data desks could not be checked.");
    if (missing.length) lines.push("Some records could not be checked (" + missing.join(", ") + ").");
    if (!final && !found && !lines.length) lines.push("Searching this edition…");
    if (final && !found) lines.push("Try another name or choose Browse by subject.");
    return {
      sections: sections.filter((s) => s.links.length),
      choices,
      cached: news.cached,
      links: news.links,
      lines,
      outcome: partial ? (found ? "partial" : "unavailable") : found ? "answer" : "empty",
    };
  }
  const update = () => publish(snapshot(false));
  update();
  await Promise.all([
    ...(county
      ? [
          findAtlasMeasures(question, county, deskSignal)
            .then(
              (result) => {
                choices = result.choices;
                atlasUnavailable = result.partial;
              },
              () => {
                signal.throwIfAborted();
                atlasUnavailable = true;
              },
            )
            .then(update),
        ]
      : []),
    ...desks.map(async (desk) => {
      const result = await lookupContent({ ...request, kind: desk }, deskSignal, true).catch(() => {
        signal.throwIfAborted();
        return { lines: [], outcome: "unavailable" as const };
      });
      records.set(desk, result);
      update();
    }),
    readArticles(
      request,
      signal,
      (interim) => {
        news = interim;
        update();
      },
      options,
    )
      .then(
        (result) => {
          news = result;
        },
        () => {
          signal.throwIfAborted();
          news = { lines: ["News feeds are temporarily unavailable."], outcome: "unavailable" };
        },
      )
      .then(update),
  ]);
  signal.throwIfAborted();
  return snapshot(true);
}

async function readAnswer(
  request: AnswerRequest,
  signal: AbortSignal,
  publish: (data: ContentResult) => void,
  options: LookupOptions = {},
): Promise<ContentResult> {
  const { kind, question, county, state, atlasChoice } = request;
  if (kind === "changes" && county) {
    const { since, day, firstVisit } = changesWindow(county.fips, question, options.since);
    if (!day)
      return { lines: ["Choose a valid starting date on or before today."], outcome: "clarification" };
    const results = await Promise.allSettled([
      readArticles({ ...request, kind: "articles", question: "Local headlines" }, signal, () => {}, {
        ...options,
        since,
        briefingDates: true,
      }),
      meetingsPublishedSince(county, since, signal),
    ]);
    signal.throwIfAborted();
    const sections = results.map((r, i) => {
      const value =
        r.status === "fulfilled"
          ? r.value
          : { lines: ["This desk is temporarily unavailable."], outcome: "unavailable", links: [] };
      return {
        label: i === 0 ? "New local headlines" : "New meeting notices",
        ordered: i === 0,
        links: value.links || [],
        lines: value.lines,
        outcome: value.outcome,
      };
    });
    return {
      lines: [
        firstVisit
          ? "This is the first recorded visit on this device. Showing today’s publications."
          : "Published since " + new Date(since).toLocaleString("en-US") + " (your local time).",
        ...(since !== new Date(since).setHours(0, 0, 0, 0)
          ? ["For reports dated only to the day, choose a starting day to include all its publications."]
          : []),
      ],
      sections,
      outcome: sections.some((s) => s.outcome === "partial" || s.outcome === "unavailable")
        ? "partial"
        : "answer",
    };
  }
  if (kind === "briefing" && county) {
    const parts = [
      {
        label: "Local headlines",
        ordered: true,
        read: () =>
          readArticles({ ...request, kind: "articles", question: "Local headlines" }, signal, () => {}, {
            ...options,
            briefingDates: true,
          }),
      },
      {
        label: "County forecast",
        read: () =>
          readAnswer({ ...request, kind: "weather", question: "Forecast" }, signal, () => {}, {
            ...options,
            briefingDates: true,
          }),
      },
      { label: "Next published public meeting", read: () => nextPublishedMeeting(county, signal) },
    ];
    const results = new Map<string, ContentResult>();
    function snapshot(): ContentResult {
      return {
        lines: [],
        outcome: [...results.values()].some((r) => r.outcome === "partial" || r.outcome === "unavailable")
          ? "partial"
          : "answer",
        cached: [...results.values()].some((r) => r.cached),
        sections: parts.map(({ label, ordered }) => {
          const result = results.get(label);
          return {
            label,
            ordered,
            links: (result?.links || []).slice(0, 3),
            lines: result ? result.lines : ["Checking…"],
          };
        }),
      };
    }
    await Promise.all(
      parts.map(async ({ label, read }) => {
        let result: ContentResult;
        try {
          result = await read();
        } catch {
          signal.throwIfAborted();
          result = { lines: ["This desk is temporarily unavailable."], outcome: "unavailable" };
        }
        results.set(label, result);
        publish(snapshot());
      }),
    );
    return snapshot();
  }
  if (kind === "search") return searchEdition(request, signal, publish, options);
  if (kind === "articles") return readArticles(request, signal, publish, options);
  if (kind !== "weather" && kind !== "gdp")
    return lookupContent({ kind, question, county, state, atlasChoice }, signal);
  if (!county) throw new Error("County required");
  if (kind === "gdp") {
    const data = await fetchCountyEconomicData(county.state.slug, county.slug, signal);
    if (data.county?.fips !== county.fips) throw new Error("County mismatch");
    const real = /\breal\b|inflation.adjusted|chained dollars/i.test(question);
    const key = /unemployment/i.test(question)
      ? "unemployment-rate"
      : /per.capita|per person/i.test(question)
        ? "per-capita-personal-income"
        : /household income/i.test(question)
          ? "median-household-income"
          : real
            ? "real-gross-domestic-product"
            : "gross-domestic-product";
    const metric = data.metrics.find((m) => m.key === key);
    if (!metric || !Number.isFinite(metric.latest?.value))
      return {
        outcome: "empty",
        lines: ["The county economic feed has no published figure for this measure."],
      };
    const year = question.match(/\b(?:19|20)\d{2}\b/)?.[0];
    const observation = economicObservation(metric, year);
    if (!observation)
      return {
        outcome: "empty",
        lines: [`This series has no published observation for ${year} in the county feed.`],
        links: [{ title: metric.seriesId, url: metric.seriesUrl }],
      };
    const lines = key.endsWith("domestic-product")
      ? [
          `${county.displayName}’s ${real ? "real GDP" : "GDP"} was ${formatMetricValue({ ...metric, latest: observation })} in ${observation.date.slice(0, 4)} (${real ? "chained 2017 dollars" : "current dollars"}).`,
          "This figure covers the whole county. City and metro-area GDP use different boundaries.",
        ]
      : [
          `${metric.label} · ${formatMetricValue({ ...metric, latest: observation })} · ${observation.date.slice(0, 4)}`,
        ];
    if (!year && /history|historical|over time/i.test(question)) {
      for (const point of (metric.observations || []).filter((o) => o.date !== observation.date).slice(-5))
        lines.push(`${point.date.slice(0, 4)} · ${formatMetricValue({ ...metric, latest: point })}`);
    }
    return {
      lines,
      targetId: "econ-" + key,
      links: [{ title: metric.seriesId, url: metric.seriesUrl, credit: `${metric.source} via FRED` }],
    };
  }
  const weather = await fetchCountyWeather(county.state.slug, county.slug, signal, options.refresh);
  if (weather.county.fips !== county.fips) throw new Error("County mismatch");
  const obs = weather.currentObservation;
  const lines: string[] = [];
  const time = (date: string) =>
    new Date(date).toLocaleString("en-US", {
      timeZone: forecastTimeZone(weather, date),
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  const { requested, hourly, periods: forecast, missing, includeObservation } =
    selectForecast(question, weather, Date.now());
  if (obs && includeObservation) {
    const condition = [
      typeof obs.temperature?.value === "number" ? `${Math.round(obs.temperature.value)}°F` : "",
      obs.textDescription,
      /humid/i.test(question) &&
        typeof obs.relativeHumidity?.value === "number" &&
        `${Math.round(obs.relativeHumidity.value)}% humidity`,
      /wind/i.test(question) &&
        typeof obs.windSpeed?.value === "number" &&
        `wind ${Math.round(obs.windSpeed.value)} mph`,
    ]
      .filter(Boolean)
      .join(" · ");
    if (condition)
      lines.push(
        [condition, obs.stationName || obs.stationId, obs.observedAt && time(obs.observedAt)]
          .filter(Boolean)
          .join(" · "),
      );
  }
  if (/drought/i.test(question)) {
    const condition = weather.droughtCondition;
    lines.push(
      condition
        ? `${condition.label} (${condition.category}) · ${condition.areaPercent}% of the county · U.S. Drought Monitor, ${condition.mapDate}.`
        : "The report contains no D1–D4 drought classification for this county.",
    );
  }
  if (
    /rainfall|how much (?:has it |did it )?rain|precipitation history/i.test(question) &&
    weather.rainfallHistory
  ) {
    const rain = weather.rainfallHistory;
    lines.push(
      `NASA POWER estimates ${rain.totalInches.toFixed(2)} inches at the county center over ${rain.availableDays} available days through ${rain.dataThrough}.`,
    );
  }
  for (const period of forecast) {
    const summary = [
      typeof period.temperature?.value === "number" && `${Math.round(period.temperature.value)}°F`,
      period.shortForecast || period.detailedForecast,
      /rain|snow|umbrella/i.test(question) &&
        typeof period.precipitationProbability?.value === "number" &&
        `${period.precipitationProbability.value}% chance of precipitation`,
    ]
      .filter(Boolean)
      .join(" · ");
    const label = hourly
      ? time(period.startTime)
      : options.briefingDates ? `${period.name} (${time(period.startTime)})` : period.name;
    lines.push(`${label} — ${summary || "Forecast details are unavailable."}`);
  }
  for (const date of missing) lines.push(`The ${hourly ? "hourly " : ""}forecast is unavailable for ${date}.`);
  if (!requested && !forecast.length) lines.push("A current forecast is unavailable.");
  for (const alert of weather.alerts.filter((a) => !a.expires || Date.parse(a.expires) > Date.now()))
    lines.push("Current alert · " + (alert.headline || alert.event));
  if (weather.meta.partial) lines.push("The weather service returned a partial report.");
  const periodTarget = requested && forecast[0] ? weatherPeriodId(forecast[0], hourly) : undefined;
  let targetId = "current-weather-heading";
  if (/drought/i.test(question)) targetId = "drought-conditions-heading";
  else if (/alerts?|warnings?/i.test(question)) targetId = "active-alerts-heading";
  else if (/rainfall|precipitation history/i.test(question)) targetId = "rainfall-history-heading";
  else if (periodTarget) targetId = periodTarget;
  else if (hourly) targetId = "weather-hourly-heading";
  else if (requested || /forecast/i.test(question)) targetId = "weather-forecast-heading";
  const partial = weather.meta.partial || (missing.length > 0 && forecast.length > 0);
  return {
    lines,
    targetId,
    path: periodTarget && !missing.length ? `/${county.state.slug}/${county.slug}/weather` : undefined,
    outcome: partial ? "partial" : missing.length ? "empty" : "answer",
    links: [
      {
        title: "National Weather Service",
        url:
          (hourly && weather.meta.source?.links?.hourly) ||
          weather.meta.source?.links?.forecast ||
          weather.meta.source?.links?.points ||
          "https://www.weather.gov/",
      },
    ],
  };
}
function articleDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Date(articleTimestamp(value)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ResultLinks({
  links,
  ordered,
  onNavigate,
}: {
  links: ContentLink[];
  ordered?: boolean;
  onNavigate: () => void;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <List>
      {links.map((l, i) => (
        <li key={l.title + l.url + i}>
          {l.url.startsWith("/") && !l.url.startsWith("//") ? (
            <Link data-fetch-target={l.targetId} to={l.url} onClick={onNavigate}>
              {l.title}
            </Link>
          ) : /^https?:\/\//i.test(l.url) ? (
            <a href={l.url} target="_blank" rel="noreferrer">
              {l.title}
            </a>
          ) : (
            l.title
          )}
          {l.excerpt && <p>{l.excerpt}</p>}
          {l.credit && <small>{l.credit}</small>}
        </li>
      ))}
    </List>
  );
}

export function FetchAnswer({
  refresh,
  visible,
  lookup,
  onNavigate,
  onChoose,
  onChooseStory,
  onResult,
}: {
  lookup: AnswerRequest;
  refresh?: Pick<LookupOptions,"since"|"earlier">;
  visible: boolean;
  onNavigate: () => void;
  onChoose: (choice: AtlasChoice) => void;
  onChooseStory: (lookup: AnswerRequest, stories: ContentLink[], action: "detail", selected?: ContentLink) => void;
  onResult: (lookup: AnswerRequest, data: ContentResult, final: boolean, filters?: Pick<LookupOptions,"since"|"earlier">) => void;
}) {
  const [action, setAction] = useState<LookupOptions & { lookup: AnswerRequest }>();
  const heading = useRef<HTMLHeadingElement>(null);
  function runAction(options: LookupOptions) {
    heading.current?.focus();
    setAction({ lookup, ...options });
  }
  const options = action?.lookup === lookup ? action : undefined;
  const [loaded, setLoaded] = useState<{
    lookup: AnswerRequest;
    options?: LookupOptions;
    data: ContentResult;
    final: boolean;
  }>();
  const result = loaded?.lookup === lookup && loaded.options === options ? loaded.data : undefined;
  useEffect(() => {
    const controller = new AbortController();
    const publish = (data: ContentResult, final = false) => {
      if (controller.signal.aborted) return;
      setLoaded({ lookup, data, final, options });
      onResult(lookup, data, final, options ?? refresh);
    };
    readAnswer(lookup, controller.signal, publish, refresh ? { ...(options ?? refresh), refresh: true } : options).then(
      (data) => {
        publish(data, true);
      },
      () => {
        publish(
          {
            outcome: "unavailable",
            lines: ["I couldn’t reach this edition’s data. Try again or open the desk below."],
          },
          true,
        );
      },
    );
    return () => controller.abort();
  }, [lookup, onResult, options, refresh]);
  const { kind, county, state } = lookup;
  const stories = storiesFor(lookup, result);
  const edition = kind === "quotes" ? "Market desk · all editions" : county ? `${county.displayName}, ${county.state.abbr}` : state?.name || "National edition";
  const base = county ? `/${county.state.slug}/${county.slug}` : state ? `/${state.slug}` : "";
  const path =
    result?.path ||
    (kind === "weather" ? `${base}/weather` : kind === "gdp" ? `${base}/economic-data` : base || "/");

  return (
    <section className="fetch-answer" aria-label={edition}>
      <small>{edition}</small>
      {lookup.cityName && county && (
        <p>
          Showing the county edition for {lookup.cityName}, {county.state.abbr}.
        </p>
      )}
      <h3 ref={heading} tabIndex={-1}>
        {result?.heading || answerLabels[kind]}
      </h3>
      {result ? (
        <>
          {kind === "changes" && <label>Show changes since <input type="date" aria-label="Show changes since" max={dateInputValue(new Date())}
            value={changesWindow(county!.fips, lookup.question, (options ?? refresh)?.since).day}
            onChange={e => { if (e.target.value && e.target.validity.valid) runAction({...options, since:Date.parse(e.target.value + "T00:00:00")}); }} /></label>}
          {result.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {visible && result.quoteSymbols && <FetchMarketQuotes key={lookup.question} symbols={result.quoteSymbols} base={base || "/"} onNavigate={onNavigate} />}
          {result.sections?.map((section) => (
            <section key={section.label}>
              <h4>{section.label}</h4>
              {section.lines?.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {!!section.links.length && (
                <ResultLinks links={section.links} ordered={section.ordered} onNavigate={onNavigate} />
              )}
            </section>
          ))}
          {!!result.choices?.length && (
            <label aria-live="off">
              {result.choices[0].metric ? "Explore a measure" : "Explore a data desk"}
              <select
                value=""
                onChange={(e) => {
                  const choice = result.choices?.[Number(e.target.value)];
                  if (choice) onChoose(choice);
                }}
              >
                <option value="" disabled>
                  Choose from the list
                </option>
                {result.choices.map((c, i) => (
                  <option value={i} key={c.metric || c.domain}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "search" && !!result.links?.length && <h4>Matching news reports</h4>}
          {!!result.links?.length && (
            <ResultLinks
              links={result.links}
              ordered={kind === "articles" || kind === "search"}
              onNavigate={onNavigate}
            />
          )}
          {loaded?.final && (
            <div className="fetch-actions">
              {stories.length > 0 && (
                <button onClick={() => onChooseStory(lookup, stories, "detail", stories.length === 1 ? stories[0] : undefined)}>
                  {stories.length === 1 ? "Story details" : "Choose a story"}
                </button>
              )}
              {(result.cached || result.outcome === "partial" || result.outcome === "unavailable") && (
                <button onClick={() => runAction({ ...(options ?? refresh), refresh: true })}>
                  Try again
                </button>
              )}
              {options?.earlier && <button onClick={() => runAction({})}>Back to initial matches</button>}
              {kind === "articles" && result.earlierCoverage && (
                <button onClick={() => runAction({ earlier: result.earlierCoverage })}>
                  Search earlier coverage
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <p role="status">Checking {answerLabels[kind].toLowerCase()}…</p>
      )}
      {!result?.quoteSymbols?.length && <Link data-fetch-target={result?.targetId || (kind === "articles" ? "desk-general" : kind === "videos" ? "desk-video" : undefined)} to={path} onClick={onNavigate}>
        {kind === "weather"
          ? "Open full weather report"
          : kind === "gdp"
            ? "Open county economic data"
            : result?.path
              ? "Open full desk"
              : "Open edition"}
      </Link>}
    </section>
  );
}

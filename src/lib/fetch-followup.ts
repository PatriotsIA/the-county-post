import { countyJurisdictionNames } from "../data/county-geography";
import type { AnswerRequest } from "./fetch-content";
import { getExactSearchState } from "../data/place-search";
import { findCityReference, qualifiedLocality } from "./fetch-city";
import { isForecastDateReply, withoutForecastDates } from "./fetch-weather";
import { countyMatches, localIntent, namesCounty } from "./fetch-guide";

const year = /\b(?:19|20)\d{2}\b/g;
const newsPeriod = /\b(?:today|yesterday|this (?:week|morning|afternoon|evening))(?:['’]s)?\b/gi;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Keep the search subject when moving editions, including words such as
// “Texas” in “Texas Rangers news in Potter County, Texas”.
export function withoutLocation(prior: AnswerRequest) {
  const { county, state, question } = prior;
  if (!state) return question;
  const stateName = `(?:${escape(state.name)}|${state.abbr})`;
  if (!county)
    return question.replace(new RegExp(`\\b(?:in|for|from|around|near)\\s+${stateName}\\b`, "i"), " ");
  const countyName = escape(county.name);
  const official = countyJurisdictionNames(county).map(escape).join("|");
  return question.replace(
    new RegExp(
      `\\b(?:${official}|(?:county\\s+)?FIPS(?:\\s+code)?[\\s:#-]*${county.fips})\\b(?:\\s*,?\\s+${stateName}\\b)?|` +
        `\\b${countyName}\\s*,\\s*${stateName}\\b|\\b(?:in|near|for|from)\\s+${countyName}\\b`,
      "i",
    ),
    " ",
  );
}

// Only a complete time expression or place reply can inherit the previous
// task. A question containing a new subject goes through normal routing.
export function lookupFollowup(text: string, prior: AnswerRequest) {
  if (!["gdp", "data", "turnout", "weather", "articles", "notices", "sources", "search"].includes(prior.kind))
    return;
  const reply = text
    .trim()
    .replace(/[?.!]+$/, "")
    .trim();
  const stripped = reply.replace(
    /^(?:(?:and\s+)?(?:what about|how about)|and|same (?:thing|question)(?: but)?)\s+/i,
    "",
  );
  const body = stripped.replace(/^(?:in|for)\s+/i, "");
  if (/^(?:here|(?:my|this|our) (?:county|edition))$/i.test(body))
    return { question: withoutLocation(prior), pageEdition: true };
  const annual = ["gdp", "data", "turnout"].includes(prior.kind);
  if (annual && /^(?:the )?(?:latest|most recent)(?: (?:figure|year|value))?$/i.test(body))
    return { question: prior.question.replace(year, " ").trim() };
  if (prior.kind === "weather" && isForecastDateReply(body))
    return { question: withoutForecastDates(prior.question) + " " + body };
  const date = body.match(
    /^(?:(?:the )?year\s+)?((?:19|20)\d{2}|today|tomorrow|yesterday|this (?:week|morning|afternoon|evening))$/i,
  )?.[1];
  if (date) {
    const period =
      annual && /^\d{4}$/.test(date)
        ? year
        : prior.kind === "articles" && /^(today|yesterday|this )/i.test(date)
          ? newsPeriod
          : undefined;
    if (period) return { question: prior.question.replace(period, " ").trim() + " " + date };
    return;
  }
  const datedPlace = annual ? body.match(/^(.+?)\s+(?:in|for)\s+((?:19|20)\d{2})$/i) : null;
  const subject = datedPlace?.[1] || body;
  const conversational = stripped !== reply || stripped !== body;
  const qualified = /,|\b(?:county|parish|borough|census area|municipality|FIPS)\b/i.test(subject);
  if (!conversational && !qualified) return;
  if (getExactSearchState(subject)) {
    if (!conversational) return;
  } else {
    const city = findCityReference(subject, prior.state);
    const completeCity = city && !city.subject.replace(/[\s,]/g, "");
    const locality = qualifiedLocality(subject);
    const completeLocality =
      locality &&
      !locality.subject &&
      subject.includes(",") &&
      !localIntent(subject) &&
      !/^(?:open|take me|show me|go to|visit|find|search)\b/i.test(subject);
    if (!qualified && localIntent(subject)) return;
    if (!completeCity && !completeLocality && !countyMatches(subject).some((c) => namesCounty(subject, c)))
      return;
  }
  const question = withoutLocation(prior);
  return {
    question: datedPlace ? question.replace(year, " ").trim() + " " + datedPlace[2] : question,
    place: subject,
  };
}

import type { CountyWeatherResponse } from "./county-weather-api";

const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const dayParts = ["morning", "afternoon", "evening", "night"];
const namedDay = `(?:(?:this|next|last) )?(?:${weekdays.join("|")})`;
const part = dayParts.join("|");
const datePattern = `\\b(?:(?:day after tomorrow|tomorrow|today|yesterday|${namedDay})(?: (?:${part}))?|tonight|(?:this|last) (?:${part})|(?:(?:this|next|last|the) )?weekend)\\b`;
const datePhrase = new RegExp(datePattern, "gi");
const dateWithPreposition = new RegExp(`(?:\\b(?:on|for|from|through|to)\\s+)?${datePattern}`, "gi");

export function withoutForecastDates(question: string) {
  return question.replace(dateWithPreposition, " ").trim();
}

export function hasForecastDate(question: string) {
  return question.search(datePhrase) !== -1;
}

export function isForecastDateReply(reply: string) {
  if (!hasForecastDate(reply)) return false;
  return !withoutForecastDates(reply).replace(/\b(?:and|or)\b|[\s,]/gi, "");
}

const dayMs = 86400000;
type ForecastDate = { day: number; part?: string };
const dateLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "short",
  day: "numeric",
});

function requestedDates(question: string, today: number) {
  const weekday = new Date(today).getUTCDay();
  const dates: ForecastDate[] = [];
  let previousEnd = 0;
  for (const match of question.toLowerCase().matchAll(datePhrase)) {
    const words = match[0].split(" ");
    if (words.includes("weekend")) {
      const saturday = weekday === 0 ? -1 : 6 - weekday;
      const shift = words[0] === "next" ? 7 : words[0] === "last" ? -7 : 0;
      for (const delta of [saturday + shift, saturday + shift + 1]) {
        if (delta >= 0 || shift < 0) dates.push({ day: today + delta * dayMs });
      }
    } else {
      const named = weekdays.findIndex((name) => words.includes(name));
      let offset = 0;
      if (named >= 0) {
        offset = (named - weekday + 7) % 7;
        if (words[0] === "last") offset = offset ? offset - 7 : -7;
        if (words[0] === "next" && offset === 0) offset = 7;
      } else if (words.includes("tomorrow")) offset = words.includes("after") ? 2 : 1;
      else if (words.includes("yesterday") || words[0] === "last") offset = -1;
      let day = today + offset * dayMs;
      const previous = dates.at(-1);
      if (previous && /^\s*(?:to|through|-)\s*$/i.test(question.slice(previousEnd, match.index))) {
        if (named >= 0 && day < previous.day) day += 7 * dayMs;
        for (let between = previous.day + dayMs; between < day; between += dayMs)
          dates.push({ day: between });
      }
      dates.push({ day, part: match[0] === "tonight" ? "night" : words.find((w) => dayParts.includes(w)) });
    }
    previousEnd = match.index + match[0].length;
  }
  return dates;
}

// Some NWS responses supply a local timestamp offset without a named zone.
export function forecastTimeZone(weather: CountyWeatherResponse, timestamp?: string) {
  if (weather.location.timeZone) return weather.location.timeZone;
  const reference =
    timestamp ||
    weather.forecast[0]?.startTime ||
    weather.hourly[0]?.startTime ||
    weather.currentObservation?.observedAt;
  return reference?.match(/[+-]\d\d:\d\d$/)?.[0] || "UTC";
}

export function selectForecast(question: string, weather: CountyWeatherResponse, now: number) {
  // UTC midnight keys count local calendar dates across daylight-saving changes.
  const calendars = new Map<string, Intl.DateTimeFormat>();
  function localClock(time: number, timestamp?: string) {
    const zone = forecastTimeZone(weather, timestamp);
    let calendar = calendars.get(zone);
    if (!calendar) {
      calendar = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        hourCycle: "h23",
      });
      calendars.set(zone, calendar);
    }
    const parts = Object.fromEntries(
      calendar.formatToParts(time).map(({ type, value }) => [type, Number(value)]),
    );
    return { day: Date.UTC(parts.year, parts.month - 1, parts.day), hour: parts.hour };
  }

  const today = localClock(now).day;
  const dates = requestedDates(question, today);
  const hourly =
    /\b(?:hourly|each hour|hour by hour|next (?:few )?hours)\b/i.test(question) ||
    dates.some(({ part }) => part && part !== "night");
  const matched = new Set<ForecastDate>();
  const periods = (hourly ? weather.hourly : weather.forecast).filter((period) => {
    const start = Date.parse(period.startTime);
    if (!Number.isFinite(start) || !(Date.parse(period.endTime) > now)) return false;
    if (!dates.length) return true;
    const beginning = localClock(start, period.startTime);
    const clock = start >= now ? beginning : localClock(now);
    const matches = dates.filter(({ day, part }) => {
      if (part === "night") {
        // An overnight period starting after midnight belongs to the preceding night.
        const night = beginning.day - (beginning.hour < 6 ? dayMs : 0);
        return (
          night === day && (hourly ? beginning.hour < 6 || beginning.hour >= 18 : period.isDaytime === false)
        );
      }
      if (clock.day !== day) return false;
      if (part === "morning") return clock.hour >= 6 && clock.hour < 12;
      if (part === "afternoon") return clock.hour >= 12 && clock.hour < 18;
      if (part === "evening") return clock.hour >= 18;
      return true;
    });
    for (const date of matches) matched.add(date);
    return matches.length > 0;
  });

  const missing = dates
    .filter((date) => !matched.has(date))
    .map(({ day, part }) => dateLabel.format(day) + (part ? " " + part : ""));
  return {
    hourly,
    requested: dates.length > 0,
    includeObservation: !dates.length || (dates.length === 1 && dates[0].day === today && !dates[0].part),
    periods: dates.length ? periods : periods.slice(0, hourly ? 6 : 2),
    missing: [...new Set(missing)],
  };
}

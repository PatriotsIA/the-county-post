import { cattleQuoteId, marketQuoteId, marketRequest } from "../data/market-instruments";
import { fetchCattleTicker, fetchMetalsTicker } from "./markets-api";
import type { AnswerRequest, ContentResult } from "./fetch-content";

async function cattlePrices(question: string, base: string, signal: AbortSignal): Promise<ContentResult> {
  const path = base + "#market-cattle";
  if (/\bfutures?\b/i.test(question))
    return {
      path,
      lines: [
        "The cattle desk publishes USDA cash auction prices. A cattle futures quote is unavailable here.",
      ],
      outcome: "empty",
    };
  const data = await fetchCattleTicker(signal);
  const classes = ["steer", "heifer"].filter((c) => new RegExp("\\b" + c + "s?\\b", "i").test(question));
  const weightQuestion = question.replace(/\bper 100\s*(?:lb[s]?|pounds?)\b/gi, "");
  const weights = [
    ...weightQuestion.matchAll(/\b(\d{3,4})(?:\s*[-–—]\s*(\d{3,4}))?\s*(?:lbs?\b|pounds?\b|#)?/gi),
  ]
    .map((m) => ({ low: Number(m[1]), high: Number(m[2] || m[1]) }))
    .filter((range) => range.low < 1900);
  const classRequest = classes.length > 0 || weights.length > 0;
  const lines: string[] = [];
  const targets: string[] = [];
  for (const item of data.items) {
    const feeder = item.key === "feeder-cattle";
    if (
      (classRequest && !feeder) ||
      (/slaughter/i.test(question) && !/feeder/i.test(question) && feeder) ||
      (/feeder/i.test(question) && !/slaughter/i.test(question) && !feeder)
    )
      continue;
    const quotes = classRequest ? item.breakdown || [] : [item, ...(item.breakdown || [])];
    for (const quote of quotes) {
      if (classes.length && !classes.some((c) => quote.label.toLowerCase().startsWith(c))) continue;
      const band = quote.label.match(/(\d+)\s*[-–—]\s*(\d+)/);
      if (
        weights.length &&
        (!band || !weights.some((w) => w.high >= Number(band[1]) && w.low <= Number(band[2])))
      )
        continue;
      if (!Number.isFinite(quote.price) || quote.price <= 0) continue;
      lines.push(
        `${quote.label}${band ? " lb" : ""} · $${quote.price.toFixed(2)} ${/cwt/i.test(quote.unit) ? "per 100 lb (cwt)" : quote.unit} · ${item.market || "USDA Market News"} · ${item.reportDate || data.updatedAt || "Report date unavailable"}`,
      );
      targets.push(cattleQuoteId(band ? quote.label : item.key));
    }
  }
  if (!lines.length)
    lines.push(
      "The USDA report has no price for that class or weight. " +
        (data.items
          .flatMap((i) => i.breakdown || [])
          .map((q) => q.label)
          .join(", ") || "No weight bands are available."),
    );
  if (data.stale) lines.push("Last available USDA report. Prices may have changed since the report date.");
  if (data.partial) lines.push("Some USDA market reports are unavailable.");
  return {
    lines,
    path: targets.length === 1 ? base + "#" + targets[0] : path,
    targetId: targets.length === 1 ? targets[0] : undefined,
    outcome: !targets.length ? "empty" : data.partial ? "partial" : "answer",
  };
}

async function metalPrices(names: string[]): Promise<ContentResult> {
  const data = await fetchMetalsTicker();
  const items = data.items.filter((m) => !names.length || names.includes(m.key));
  const lines = items.map(
    (m) =>
      `${m.label} · $${m.price.toFixed(2)} per ${data.unit} · ${new Date(m.quotedAt).toLocaleString("en-US")}`,
  );
  if (data.stale || items.some((m) => Date.now() - Date.parse(m.quotedAt) > 15 * 60_000))
    lines.push("Last available spot quotes. Prices may be delayed, or the market may be closed.");
  return {
    lines,
    path: "/itm-trading",
    targetId: items.length === 1 ? "itm-price-" + items[0].key : "metal-prices",
    links: [{ title: data.provider.name, url: data.provider.url }],
  };
}

export async function marketAnswer(request: AnswerRequest, signal: AbortSignal): Promise<ContentResult> {
  const { question, county, state } = request;
  const base = county ? `/${county.state.slug}/${county.slug}` : state ? "/" + state.slug : "/";
  const intent = marketRequest(question);
  const pieces: Promise<ContentResult>[] = [];
  if (intent.equities || (!intent.cattle && !intent.includeMetals)) {
    const instruments = intent.instruments;
    pieces.push(
      Promise.resolve({
        lines: instruments.length ? [] : ["Choose a symbol from the Market desk to see its quote."],
        quoteSymbols: instruments.map((m) => m.symbol),
        path:
          base + "#" + (instruments.length === 1 ? marketQuoteId(instruments[0].ticker) : "market-stocks"),
      }),
    );
  }
  if (intent.cattle)
    pieces.push(
      cattlePrices(question, base, signal).catch(() => ({
        lines: ["USDA cattle prices are temporarily unavailable."],
        outcome: "unavailable",
        path: base + "#market-cattle",
      })),
    );
  if (intent.includeMetals)
    pieces.push(
      metalPrices(intent.metals).catch(() => ({
        lines: ["Metal spot prices are temporarily unavailable."],
        outcome: "unavailable",
        path: "/itm-trading",
        targetId: "metal-prices",
      })),
    );
  const results = await Promise.all(pieces);
  signal.throwIfAborted();
  if (results.length === 1) return results[0];
  return {
    ...results[0],
    lines: results.flatMap((r) => r.lines),
    links: results.flatMap((r) => [
      ...(r.links || []),
      ...(r.path && r !== results[0]
        ? [
            {
              title: r.path.startsWith("/itm-trading") ? "See metal prices" : "See cattle prices",
              url: r.path,
              targetId: r.targetId,
            },
          ]
        : []),
    ]),
    outcome: results.some(
      (r) => r.outcome === "unavailable" || r.outcome === "partial" || r.outcome === "empty",
    )
      ? "partial"
      : "answer",
  };
}

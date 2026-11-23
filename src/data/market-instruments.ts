// One list defines the edition ticker and the symbols readers can request in Fetch.
export const marketInstruments = [
  ["FOREXCOM:SPXUSD", "S&P 500", "s and p 500|sp 500|sp500|spx"],
  ["FOREXCOM:NSXUSD", "Nasdaq 100", "nasdaq|ndx"],
  ["FOREXCOM:DJI", "Dow Jones", "dow|dow jones industrial average|djia"],
  ["FX:EURUSD", "Euro / US dollar", "eur/usd|euro|eur usd"],
  ["BITSTAMP:BTCUSD", "Bitcoin", "btc|btc/usd"],
  ["BITSTAMP:ETHUSD", "Ethereum", "eth|ether|eth/usd"],
  ["NASDAQ:NVDA", "Nvidia", ""],
  ["EASYMARKETS:OILUSD", "Crude oil", "oil|wti"],
  ["NASDAQ:AAPL", "Apple", ""],
  ["NASDAQ:AMZN", "Amazon", ""],
  ["NASDAQ:MSFT", "Microsoft", ""],
  ["NASDAQ:META", "Meta", "meta platforms|facebook"],
  ["NASDAQ:AMD", "AMD", "advanced micro devices"],
  ["NASDAQ:PLTR", "Palantir", ""],
  ["NASDAQ:GOOGL", "Alphabet", "google"],
  ["NASDAQ:NFLX", "Netflix", ""],
  ["NYSE:DELL", "Dell", "dell technologies"],
  ["NYSE:XOM", "Exxon Mobil", "exxon|exxonmobil"],
  ["NYSE:JPM", "JPMorgan Chase", "jpmorgan|jp morgan|j p morgan"],
  ["NYSE:BAC", "Bank of America", ""],
].map(([symbol, name, aliases]) => {
  const ticker = symbol.split(":")[1];
  const names = [symbol, ticker, name, ...aliases.split("|").filter(Boolean)];
  return { symbol, ticker, name, pattern: new RegExp("\\b(?:" + names.join("|") + ")\\b", "i") };
});

export const metalNames = ["gold", "silver", "platinum", "palladium"];
export const cattleTerms = /\b(?:cattle|steers?|heifers?|calves|calf|livestock)\b/i;
const stocks = /\b(?:stocks?|shares?|equities|stock market|stock ticker|crypto(?:currency)?)\b/i;
const quoteTerms =
  /\b(?:prices?|pricing|quotes?|spot|worth|costs?|trading|selling|bringing|going (?:for|rate)|a share|valued at|performance|per (?:pound|head|cwt|ounce|share)|how much|ticker|exchange rate)\b/i;

export function marketRequest(question: string) {
  const subject = question.replace(/\b(?:NASDAQ|NYSE|FOREXCOM|FX|BITSTAMP|EASYMARKETS):(?=[A-Z0-9])/gi, "");
  const instruments = marketInstruments.filter((m) => m.pattern.test(subject));
  const metals = metalNames.filter((m) => new RegExp("\\b" + m + "\\b", "i").test(question));
  const includeMetals = !!metals.length || /\bmetals?\b/i.test(question);
  const cattle = cattleTerms.test(question);
  const equities = stocks.test(question) || instruments.length > 0;
  const overview =
    !equities && !includeMetals && !cattle && /\bmarket (?:prices?|quotes?|desk)\b/i.test(question);
  const short = question.trim().replace(/^[\s$]+|[?.!\s]+$/g, "");
  const bareName = short
    .replace(
      /^(?:(?:and )?(?:what|how) about |(?:how (?:is|are)|what(?:['’]s| is| are)|show me|compare) )/i,
      "",
    )
    .replace(/ (?:(?:doing|at)(?: today)?|today|right now)$/i, "");
  const bareSymbol = instruments.some((m) =>
    [m.ticker, m.symbol, m.name].some((n) => n.toLowerCase() === bareName.toLowerCase()),
  );
  const symbolQuestion =
    instruments.some((m) => new RegExp("\\b" + m.ticker + "\\b", "i").test(question)) &&
    /\b(compare|versus|vs|about|doing|show)\b/i.test(question);
  const matches =
    (cattle || equities || includeMetals) &&
    (quoteTerms.test(question) ||
      stocks.test(question) ||
      bareSymbol ||
      symbolQuestion ||
      /^(?:cattle|steers?|heifers?|gold|silver|platinum|palladium)(?: (?:today|prices?))?$/i.test(bareName) ||
      /^(?:(?:feeder|slaughter) cattle|steers?|heifers?)$/i.test(short));
  return {
    matches: matches || overview,
    instruments,
    metals,
    includeMetals: includeMetals || overview,
    cattle: cattle || overview,
    equities: equities || overview,
  };
}

export const marketQuoteId = (ticker: string) => "market-quote-" + ticker.toLowerCase();
export const cattleQuoteId = (label: string) =>
  "market-" +
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");

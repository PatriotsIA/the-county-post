/** label is the existing navigation link that opens this desk. */
export const fetchDesks = {
  changes: { label: "Since your last visit", county: true, help: "See newly published stories and meeting notices." },
  briefing: { label: "County briefing", county: true, help: "Read the local headlines, forecast and next published public meeting." },
  search: {
    label: "Search this edition",
    county: false,
    help: "Find related site pages, county figures and reports in the edition’s feeds.",
  },
  catalog: {
    label: "Site directory",
    county: false,
    help: "Locate named editorial features, op-eds, partners, services, and topical pages.",
  },
  videos: {
    label: "Featured videos",
    county: false,
    help: "Find videos and live channels on the featured video desk.",
  },
  quotes: {
    label: "Market prices",
    county: false,
    help: "Look up stocks by name or ticker, metal spot prices, and USDA steer and heifer prices by weight.",
  },
  turnout: {
    label: "Show Up Meter",
    county: true,
    help: "Look up past election turnout, ballots cast and registered voters.",
  },
  articles: {
    label: "News articles",
    county: false,
    help: "Answer what’s happening in an edition with a briefing from its current news feeds, or find reporting about a particular subject.",
  },
  gdp: {
    label: "Economic Data",
    county: true,
    help: "Find the county’s gross domestic product and data year.",
  },
  weather: {
    label: "Weather",
    county: true,
    help: "See the county forecast, current conditions, and active alerts.",
  },
  notices: {
    label: "Public Notices",
    county: true,
    help: "Look here for public meetings, hearings, bids, and links to official notices.",
  },
  sources: {
    label: "Local Sources",
    county: true,
    help: "Find local publications and outlets that cover this county.",
  },
  data: {
    label: "County Data",
    county: true,
    help: "Explore county statistics, charts, and the sources behind them.",
  },
  classifieds: {
    label: "Classifieds",
    county: true,
    help: "Start at the county classifieds desk to browse or post a listing.",
  },
  edition: {
    label: "County Home",
    county: true,
    help: "Open the county front page for local headlines and news feeds.",
  },
  newsletter: {
    label: "Morning Post",
    county: false,
    help: "Open The Morning Post to choose an edition and sign up for the daily email.",
  },
  submit: {
    label: "Submit A Story",
    county: false,
    help: "Open the submission form to send the newsroom a story or tip.",
  },
  elections: {
    label: "Elections",
    county: false,
    help: "Read coverage of elections, voting, and public records.",
  },
  markets: {
    label: "Economy & Markets",
    county: false,
    help: "Read reporting about jobs, businesses, and markets.",
  },
  taxes: {
    label: "Taxes & Public Finance",
    county: false,
    help: "Find reporting on taxes, bonds, levies, and public budgets.",
  },
} as const;

export type FetchDesk = keyof typeof fetchDesks;
export type FetchIntent = FetchDesk | "tour";

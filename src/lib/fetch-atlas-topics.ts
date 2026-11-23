import { countyCrimeMeasure } from "./county-crime-measures";
import { atlasDomainLabels } from "./atlas-domain-labels";
import { countyAtlasDomains, type CountyAtlasDomain } from "./county-atlas-api";

// Reader wording points to a published measure or to a desk when coverage varies.
const topics: [RegExp, CountyAtlasDomain, string?][] = [
  [
    /how many (?:people|folks|residents) (?:live|are there)|number of residents|population size/i,
    "demographics",
    "population",
  ],
  [
    /how much (?:do|does) (?:families|a family|households?|people) (?:make|earn)|typical (?:family|household) income/i,
    "economy",
    "median-household-income",
  ],
  [/house prices?|house values?|what .* homes? worth/i, "housing", "median-home-value"],
  [/how old .* (?:homes|houses)|age of (?:the )?(?:houses|homes)/i, "housing", "median-year-built"],
  [/what .*rent costs?|how much .*rent/i, "housing", "median-gross-rent"],
  [/without (?:a )?(?:vehicle|car)/i, "infrastructure", "no-vehicle-households-rate"],
  [/work(?:ing)? from home/i, "infrastructure", "work-from-home-rate"],
  [/broadband|internet access/i, "infrastructure", "internet-subscription-rate"],
  [/health insurance|health coverage|without insurance/i, "health", "uninsured-rate"],
  [/property tax(?:es)?|real estate tax(?:es)?/i, "government-finance", "median-real-estate-taxes"],
  [/traffic (?:deaths|fatalities)|killed .* (?:traffic|crashes)/i, "public-safety", "traffic-deaths"],
  [/fatal (?:traffic )?crashes/i, "public-safety", "traffic-fatal-crashes"],
  [/how long .* (?:get to work|commute)/i, "jobs-business", "mean-commute"],
  [
    /how many (?:kids|children|students) (?:are in|attend) school|enrolled in school/i,
    "education",
    "school-enrollment",
  ],
  [/voting.age population|old enough to vote/i, "civic-elections", "voting-age-population"],
  [/college degree|bachelor/i, "education", "bachelors-rate"],
  [/farms?|farmers?|cropland|livestock/i, "agriculture"],
];
export function atlasTopic(question: string) {
  const crime = countyCrimeMeasure(question);
  if (crime) return { domain: crime.domain, metric: crime.key };
  for (const [pattern, domain, metric] of topics) {
    if (pattern.test(question)) return { domain, metric };
  }
  const lower = question.toLowerCase();
  for (const domain of countyAtlasDomains) {
    if (
      [domain.replaceAll("-", " "), atlasDomainLabels[domain].toLowerCase()].some((name) =>
        lower.includes(name),
      )
    )
      return { domain };
  }
}

// A reader can use the label printed on any desk, including measures added since the app was built.
export function publishedMeasureQuestion(question: string) {
  const match = /^(?:what is|show(?: me)?) [“"]?(.+?)[”"]? on the (.+?) (?:data )?desk[?.!]*$/i.exec(question.trim());
  if (!match) return;
  const domain = countyAtlasDomains.find(d => [d, atlasDomainLabels[d]].some(label => label.toLowerCase() === match[2].toLowerCase()));
  return domain && {domain, label:match[1]};
}

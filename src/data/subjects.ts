import type { Topic } from "../lib/news-api";

/**
 * Editorial desk taxonomy, shared by the router, the site navigation, and the
 * build-time sitemap generator. Slugs here become URLs at three levels —
 * `/topics/:slug`, `/:state/:slug`, and `/:state/:county/:slug` — so renaming
 * one is a redirect-worthy change, not a cosmetic one.
 */
export type TopicFeedKind = Topic;
export type SubjectPageBase = { kind: TopicFeedKind; slug: string; title: string; kicker: string; description: string };
export type SubjectGroup = { slug: string; title: string; kicker: string; description: string; subjects: SubjectPageBase[] };
export type SubjectPage = SubjectPageBase & { categorySlug: string; categoryTitle: string };

export const topicSections: { kind: TopicFeedKind; title: string; kicker: string }[] = [
  { kind: "sports", title: "Sports", kicker: "Scores & highlights" },
  { kind: "obituaries", title: "Obituaries & public notices", kicker: "Community records" },
  { kind: "politics", title: "Politics", kicker: "Civic desk" },
  { kind: "economy", title: "Economy & business", kicker: "Markets" },
  { kind: "crime", title: "Crime & courts", kicker: "Public safety" },
  { kind: "opinion", title: "Opinion & op-eds", kicker: "Columns & analysis" },
];

export const subjectGroups: SubjectGroup[] = [
  {
    slug: "economy-markets",
    title: "Economy & Markets",
    kicker: "Markets desk",
    description: "Coverage of money, markets, jobs, local business, and the economic forces shaping county life.",
    subjects: [
      {
        kind: "monetary-policy",
        slug: "monetary-policy",
        title: "Monetary Policy",
        kicker: "Money desk",
        description: "Coverage of inflation, interest rates, the Federal Reserve, currency policy, and local economic impacts.",
      },
      {
        kind: "markets-investing",
        slug: "markets-investing",
        title: "Markets & Investing",
        kicker: "Market watch",
        description: "Coverage of commodities, stocks, bonds, investing, and market moves that matter outside Wall Street.",
      },
      {
        kind: "jobs-business",
        slug: "jobs-business",
        title: "Jobs & Business",
        kicker: "Business desk",
        description: "Coverage of employers, small businesses, hiring, industry, and local economic development.",
      },
    ],
  },
  {
    slug: "taxes-public-finance",
    title: "Taxes & Public Finance",
    kicker: "Public finance",
    description: "Coverage of taxes, public budgets, bonds, levies, school finance, and local government spending.",
    subjects: [
      {
        kind: "property-taxes",
        slug: "property-taxes",
        title: "Property Taxes",
        kicker: "Tax desk",
        description: "Coverage of property taxes, appraisals, assessments, tax levies, and homestead exemptions.",
      },
      {
        kind: "municipal-bonds",
        slug: "municipal-bonds",
        title: "Municipal Bonds",
        kicker: "Public debt",
        description: "Coverage of municipal bonds, school bonds, bond elections, public debt, and borrowing proposals.",
      },
      {
        kind: "budgets-levies",
        slug: "budgets-levies",
        title: "Budgets & Levies",
        kicker: "Budget desk",
        description: "Coverage of county, city, and school budgets, tax rates, levies, and public finance decisions.",
      },
    ],
  },
  {
    slug: "elections-transparency",
    title: "Elections & Transparency",
    kicker: "Civic records",
    description: "Coverage of elections, public records, open government, audits, recounts, and election administration.",
    subjects: [
      {
        kind: "voting-systems",
        slug: "voting-systems",
        title: "Voting Systems",
        kicker: "Election systems",
        description: "Coverage of voting equipment, ballot processing, certification, and election technology.",
      },
      {
        kind: "election-administration",
        slug: "election-administration",
        title: "Election Administration",
        kicker: "Election desk",
        description: "Coverage of election offices, polling places, voter registration, ballot access, and election calendars.",
      },
      {
        kind: "audits-recounts",
        slug: "audits-recounts",
        title: "Audits & Recounts",
        kicker: "Results desk",
        description: "Coverage of election audits, recounts, canvassing, post-election reviews, and certification disputes.",
      },
      {
        kind: "open-records",
        slug: "open-records",
        title: "Open Records",
        kicker: "Transparency desk",
        description: "Coverage of public records, FOIA requests, open meetings, and government transparency.",
      },
    ],
  },
];

export const subjectPages: SubjectPage[] = subjectGroups.flatMap((group) =>
  group.subjects.map((subject) => ({
    ...subject,
    categorySlug: group.slug,
    categoryTitle: group.title,
  })),
);

export const legacySubjectGroups: Record<string, SubjectGroup["slug"]> = {
  "sound-money": "economy-markets",
  "paper-elections": "elections-transparency",
  "bond-issues": "taxes-public-finance",
};

export function getSubjectPage(subjectSlug?: string) {
  return subjectPages.find((subject) => subject.slug === subjectSlug);
}

export function getSubjectGroup(subjectSlug?: string) {
  return subjectGroups.find((group) => group.slug === subjectSlug);
}

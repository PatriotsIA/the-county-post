import type { NewsFeedItem } from "../lib/news-api";

export const dataCentersOpEd = {
  slug: "the-data-centers-and-the-rest-of-us",
  path: "/op-eds/the-data-centers-and-the-rest-of-us",
  category: "Opinion",
  title: "The Data Centers and the Rest of Us",
  deck: "What a Thursday night with a spreadsheet taught me about the fight over the Panhandle's newest neighbors",
  byline: "By Dan Rogers, The County Post",
  publishedAt: "2026-09-03T12:00:00-05:00",
  paragraphs: [
    "Last Thursday evening I sat down with a spreadsheet of 8,314 rows that needed sorting. I had already spent the better part of an hour doing it the old way — row by row, my eyes and a delete key — and I was about five hundred rows in when I stopped and handed the job to an artificial intelligence tool instead. It finished the whole thing, checked its own work, and handed it back in about ten minutes.",
    "I sat there looking at it and thought: well. I guess I ought to appreciate those data centers everybody's fighting about.",
    "I say that as a man with real questions about them. The grid strain is not imaginary. The water draw is not imaginary. And the property tax arrangements some of these projects arrive with deserve a harder look than they usually get. If you're worried about what these facilities mean for your electric bill and your aquifer, you're not a Luddite — you're paying attention.",
    "But I want to try to hold both halves of this honestly, because I don't think anybody else in the conversation is bothering to.",
    "Here's what the data centers actually do, as best I can explain it. Think of them as schools. The great racks of computers are where the machines learn — where millions of miles of driving video get crunched into a system that can drive, where mountains of text get crunched into a tool that can sort a candidate list or draft a contract or read an X-ray. The learning is centralized and enormous. But then the learned thing graduates and goes to work out in the world — in the car, in the shop, in the tractor, on my desk in Amarillo. The data center is not a puppet-master running everything on a string. It's the schoolhouse. And the reason there's a land rush to build schoolhouses is that the students, once trained, turn out to be useful nearly everywhere.",
    "How useful? History gives us a clue, and also a warning about timing. When electricity arrived, factories bolted electric motors onto their old steam-driven layouts and got almost nothing for it — for thirty years. The big productivity gains came only when a new generation rebuilt the factory floor around what electricity made possible. The invention wasn't the payoff. Reorganizing the work was. Computers followed the same pattern: on every desk for years before the numbers moved.",
    "I believe we're at the front edge of the same story. The gains I found on a Thursday night didn't come from the technology existing — it had existed for a while. They came the moment I reorganized my own work around it. Multiply that adjustment across every ranch office, machine shop, clinic, and county clerk's office in the country and you get a productivity boost that could be the biggest in a generation. Skip the adjustment and you get expensive buildings and a disappointed country. Both futures are still on the table.",
    "Which brings me to the fight, and to a criticism I'd level at the technology companies and their friends in Washington: you never made the case. A transformation this size, landing this fast, in communities that bear its costs up front — the grid, the water, the construction traffic, the tax abatements — needed to be explained, patiently, county by county, the way the oil and gas industry learned to do over a hundred years. Instead, the projects arrived as done deals. Announcements instead of conversations. And into the space where the explanation should have been, fear moved in — as it always does, and as it always deserves to when nobody bothers to answer the questions.",
    "The costs of this transition are local and immediate. The benefits are broad and delayed. That gap is real, and pretending it isn't — in either direction — is how you get a public that trusts nobody on the subject.",
    "So here is where I land, and where I think this newspaper lands. The question in front of every county where these projects land is not \"data centers, good or bad.\" That question is already settled by economics far above our pay grade; they are coming. The question that is actually ours to answer, county by county, is: what's the deal? What do these specific projects pay into these specific school districts and county budgets? What do they draw from the grid and the water table, in numbers, on paper? What jobs are permanent and what jobs leave when the concrete cures? Who at the commissioners' table is asking, and what did they get answered before they voted?",
    "Those are knowable facts, and this paper intends to go get them and print them — the favorable ones and the unfavorable ones alike. That's the coverage a community that bears the costs is owed, and it's the conversation the companies should have started themselves.",
    "In the meantime, I'll keep using the tools the schoolhouses produce, keep my eye on the water table, and keep believing a community can be glad for the future and unafraid to ask it hard questions at the same time. That's not a contradiction. Around here, we just call it good business.",
  ],
  authorBio: "Dan Rogers is the publisher of The County Post and a Texas Panhandle cattleman.",
} as const;

export const featuredCountyPostOpEd: NewsFeedItem = {
  id: "county-post-op-ed-data-centers-rest-of-us",
  title: dataCentersOpEd.title,
  link: dataCentersOpEd.path,
  source: "The County Post",
  publishedAt: dataCentersOpEd.publishedAt,
  description: dataCentersOpEd.deck,
  categories: ["Opinion", "The County Post"],
};

export function prependFeaturedCountyPostOpEd(items: NewsFeedItem[]) {
  const remainingItems = items.filter(
    (item) =>
      item.id !== featuredCountyPostOpEd.id &&
      item.title.trim().toLowerCase() !== featuredCountyPostOpEd.title.toLowerCase(),
  );
  return [featuredCountyPostOpEd, ...remainingItems];
}

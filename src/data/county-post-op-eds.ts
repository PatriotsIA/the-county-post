import type { NewsFeedItem } from "../lib/news-api";

export type CountyPostOpEd = {
  id: string; slug: string; path: string; category: string; title: string; deck: string;
  byline: string; publishedAt: string; paragraphs: readonly string[]; authorBio: string;
};

export const dataCentersOpEd = {
  id: "county-post-op-ed-data-centers-rest-of-us",
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

// Paragraphs mark the author's emphasis with **double asterisks**.
export const texasMailerOpEd = {
  "id": "county-post-op-ed-texas-parents-transgender-mailer",
  "slug": "texas-parents-deserve-answers-about-the-transgender-mailer",
  "path": "/op-eds/texas-parents-deserve-answers-about-the-transgender-mailer",
  "category": "Opinion",
  "title": "Texas Parents Deserve Answers About the Transgender Mailer",
  "deck": "The most important question may not be what the pamphlet says. It is: Who sent it, and why?",
  "byline": "By Kristin Griswold, The County Post",
  "publishedAt": "2026-10-22T13:49:03-05:00",
  "paragraphs": [
    "There is something deeply unsettling about opening your mailbox and finding a glossy pamphlet addressed not to you, but to your child.",
    "That is what parents across Texas have reported in recent days. The publication, titled the “Texas Trans & LGBTQ+ Student Resource Guide,” presents itself as a resource for transgender and LGBTQ+ students. It discusses student rights, finding support outside the family, emancipation and other sensitive subjects.",
    "But the most important question may not be what the pamphlet says.",
    "It is: **Who sent it, and why?**",
    "That question matters because the organization prominently associated with the mailer, the Transgender Education Network of Texas, says it did not author, approve or distribute the material. TENT has publicly denied involvement, and reporting by The Texas Tribune found that the entity identified as the “Texas Transgender Student Union” was registered as a Wyoming LLC only in September.",
    "The timing also deserves scrutiny. The mailers began appearing as early voting started for the November 2026 election. No public evidence has yet established who paid for the mailing or who ultimately directed it.",
    "That uncertainty should concern Texans across the political spectrum.",
    "Parents who oppose transgender advocacy may understandably be angry that material concerning their children arrived without their knowledge. Parents who support transgender children should be equally concerned if an outside organization is falsely using the names and reputations of legitimate nonprofits to communicate with families.",
    "And everyone should be concerned when political tactics deliberately blur the line between advocacy and deception.",
    "There is an important distinction here: **protecting children and respecting parents does not require denying that transgender young people exist.** Nor does concern about transgender advocacy require assuming that every organization supporting LGBTQ+ youth is acting improperly.",
    "But neither should parents be expected to accept anonymous or misleading political communications involving their children without asking questions.",
    "The pamphlets reportedly direct students toward outside organizations and discuss what students can do if their parents do not support them. That is precisely the kind of material that deserves transparency about its authorship, funding and purpose.",
    "If the mailer was genuinely intended as a student resource, its sponsors should have no reason to hide.",
    "If it was designed primarily to provoke parents during an election, Texans deserve to know that, too.",
    "And if someone intentionally made the pamphlet appear to come from organizations that had nothing to do with it, that raises an entirely different set of questions about accountability.",
    "Already, the controversy has produced consequences beyond political arguments. TENT has reported backlash and threats after the mailers were attributed to the organization. Other nonprofits have also reportedly been dragged into the controversy after their names or contact information circulated online.",
    "That is not healthy political discourse.",
    "Texas parents are perfectly capable of deciding what they believe about transgender issues. They do not need anonymous operatives manufacturing outrage on their behalf.",
    "The proper response now is simple: **find out who did it.**",
    "Who created the Texas Transgender Student Union? Who financed the printing and postage? Who obtained the mailing lists? Who authorized the use of other organizations' names and websites? Was the mailer part of a political campaign? And did anyone intentionally attempt to mislead Texas families?",
    "Those questions deserve answers from investigators, election officials and anyone else with the authority to follow the money and the paper trail.",
    "Most Texans can disagree passionately about transgender policy, parental rights and the role of schools. That disagreement is part of democracy.",
    "But democracy depends on something more basic than agreement:",
    "**We need to know who is talking to us.**",
    "Texas parents should demand nothing less."
  ],
  "authorBio": "Kristin Griswold is a contributor to The County Post. The views expressed in this column are those of the author."
} as const;

export const millennialVoiceOpEd = {
  "id": "county-post-op-ed-millennial-generation-voice",
  "slug": "the-millennial-generation-has-a-voice-are-we-using-it",
  "path": "/op-eds/the-millennial-generation-has-a-voice-are-we-using-it",
  "category": "Opinion",
  "title": "The Millennial Generation Has a Voice. Are We Using It?",
  "deck": "Our generation has found its voice. Now we must decide how to use it.",
  "byline": "By Kristin Griswold, The County Post",
  "publishedAt": "2026-10-13T16:45:26-05:00",
  "paragraphs": [
    "Millennials have spent much of their adult lives navigating extraordinary change. We came of age during the rise of the internet, witnessed the aftermath of September 11, entered the workforce during or after the Great Recession, and have experienced profound shifts in the economy, technology, and American political life.",
    "We are a generation that has never been short on opinions, ideas, or expectations for the future.",
    "Yet an important question remains: Are we translating those opinions into meaningful civic participation?",
    "Born between 1981 and 1996, millennials are now approximately 30 to 45 years old. We are raising families, building careers, operating businesses, paying taxes, and contributing to our communities. The decisions being made in city halls, county courthouses, school board meetings, the Texas Legislature, and Washington, D.C., directly affect our daily lives.",
    "We have reached an age when our generation should be an established and consistent presence in the democratic process.",
    "And yet, participation remains uneven.",
    "Political discussion has never been more accessible. Social media provides an immediate platform for expressing frustration, debating public policy, and questioning elected leadership.",
    "But expressing an opinion and exercising civic responsibility are not necessarily the same thing.",
    "A thoughtful social media post can raise awareness. A community conversation can inspire action. Public criticism can hold elected officials accountable.",
    "These are valuable forms of engagement.",
    "But they do not replace the importance of understanding the issues, researching candidates, and participating in elections.",
    "For millennials who feel disconnected from the political process, the reasons are often complicated. Some have lost confidence in political institutions. Others feel that neither major party adequately represents their priorities. Many are balancing demanding careers, family responsibilities, and financial pressures.",
    "These concerns deserve acknowledgment.",
    "However, disengagement does not remove the influence of government from our lives. It simply means decisions continue to be made without our participation.",
    "In the Texas Panhandle, civic engagement is about far more than presidential elections or national political debates.",
    "Local government decisions influence the quality of our roads, the management of public resources, public safety, economic development, and the educational opportunities available to our children.",
    "County commissioners, city council members, school board trustees, and other local officials make decisions that directly shape the communities we call home.",
    "Yet these elections often receive considerably less public attention than national contests.",
    "It is worth asking ourselves how many of us can identify our local elected representatives, explain their responsibilities, or describe the issues currently before them.",
    "An informed electorate begins with an understanding of government at every level.",
    "Civic responsibility does not belong to any political party, ideology, or generation.",
    "Republicans, Democrats, independents, and those who identify with neither major party all have a place in the democratic process.",
    "Meaningful participation does not require agreement. It requires a willingness to become informed, consider differing perspectives, and recognize the importance of public decisions.",
    "Nor should voting be the beginning and end of our civic involvement.",
    "Attending public meetings, communicating with elected officials, volunteering in our communities, and seeking reliable information are all ways to contribute to a healthier civic culture.",
    "Democracy is strengthened when citizens remain engaged between election cycles, not simply when a national contest captures their attention.",
    "Encouraging greater participation also requires recognizing that voting is not equally convenient for everyone.",
    "Work schedules, childcare responsibilities, transportation challenges, unfamiliar election procedures, and difficulty accessing clear information can all discourage participation.",
    "Rather than assuming that every nonvoter is indifferent, communities should consider how to make reliable election information more accessible.",
    "Employers, civic organizations, educational institutions, community leaders, and local media all have opportunities to help residents better understand the electoral process.",
    "An informed citizen should know how to verify registration, locate accurate election information, learn about candidates, and understand the offices appearing on a ballot.",
    "Making that information available is an important public service.",
    "For many millennials, civic participation now carries an additional responsibility: the example we establish for our children.",
    "The next generation is watching how we discuss public affairs, respond to disagreements, evaluate information, and engage with our communities.",
    "We can demonstrate that political differences do not have to become personal hostility and that responsible citizenship involves more than expressing dissatisfaction.",
    "We can teach our children that public service matters, that elected officials are accountable to the people they represent, and that understanding government is part of understanding the world around them.",
    "These lessons begin long before a young person casts a first ballot.",
    "Millennials are no longer the emerging generation of American adults. We are firmly established in the workforce, in our communities, and in the institutions that shape public life.",
    "Our concerns about affordability, education, healthcare, economic opportunity, and the future are legitimate. So are our expectations of transparency, accountability, and responsible leadership.",
    "But those expectations are most meaningful when accompanied by informed civic engagement.",
    "We do not have to agree on every issue to recognize the value of participation. We do not have to share political beliefs to understand that representative government depends on the involvement of the people it serves.",
    "The question before millennials is not whether we have something to say.",
    "We clearly do.",
    "The question is whether we are willing to make civic participation a consistent part of our lives.",
    "Our generation has found its voice. Now we must decide how to use it."
  ],
  "authorBio": "Kristin Griswold is a contributor to The County Post. The views expressed in this column are those of the author."
} as const;

export const enoughAboutTheOtherGuyOpEd = {
  "id": "county-post-op-ed-enough-about-the-other-guy",
  "slug": "enough-about-the-other-guy",
  "path": "/op-eds/enough-about-the-other-guy",
  "category": "Opinion",
  "title": "Enough About The Other Guy",
  "deck": "Perhaps candidates should spend a little less time telling us about the person running against them and a little more time telling us about themselves.",
  "byline": "By Kristin Griswold, The County Post",
  "publishedAt": "2026-10-27T12:32:54-05:00",
  "paragraphs": [
    "Turn on the television. Check your mailbox. Scroll through social media. Open a website. Before long, chances are you will encounter another political advertisement telling you why you should be afraid of the other candidate.",
    "One candidate is supposedly too extreme. Another is allegedly out of touch. One can't be trusted. The other has a terrible record. One will destroy everything we value, while the other will somehow save it all.",
    "After a while, it becomes difficult to remember what any of the candidates actually intend to do.",
    "Political advertising has become a constant part of modern life, particularly during election season. Candidates and political groups spend enormous amounts of money trying to get our attention. Yet too often, those messages seem to tell us more about what a candidate thinks is wrong with the opponent than what the candidate believes is right for the community.",
    "That should concern all of us, regardless of political party.",
    "There is certainly a place for candidates to point out differences. Voters deserve to know about voting records, past statements, policy positions and decisions that may affect the public. Holding elected officials accountable is an important part of democracy.",
    "But there is a difference between informing voters about a legitimate disagreement and simply trying to make the other person look bad.",
    "Instead of another advertisement explaining why an opponent is supposedly unfit for office, wouldn't it be refreshing to hear a candidate say:",
    "Here is what I believe.",
    "Here is what I want to accomplish.",
    "Here is how I plan to pay for it.",
    "Here is what I would do differently.",
    "And here is what I will do if you give me your vote.",
    "Those are the answers voters can actually use.",
    "The problem with attack-oriented advertising is that it can leave voters with plenty of reasons to dislike candidates but very little information about what those candidates would actually do once elected.",
    "And governing is about more than winning an election.",
    "Whether the office is local, state or federal, the people elected will eventually have to sit down, make decisions, negotiate, set priorities and live with the consequences of those decisions. Campaign advertisements rarely show us that side of politics.",
    "Perhaps candidates should spend a little less time telling us about the person running against them and a little more time telling us about themselves.",
    "Tell us about your experience.",
    "Tell us your priorities.",
    "Tell us what problems you believe need to be addressed.",
    "Tell us what you would change—and what you would leave alone.",
    "Tell us what your plans would cost.",
    "Tell us what you believe government should and should not be doing.",
    "And, perhaps most importantly, tell us what you will be willing to compromise on when circumstances require it.",
    "Voters don't need candidates to agree with one another. In fact, disagreement is a natural and necessary part of a democracy.",
    "What voters need is enough information to make their own judgments.",
    "So the next time another political advertisement appears on the screen and begins with everything wrong with \"the other candidate,\" perhaps we should ask a simple question:",
    "\"That's interesting. But what are you going to do?\"",
    "That is the conversation worth having.",
    "And it is one that could make elections a lot more informative—and a lot less exhausting—for everyone."
  ],
  "authorBio": "Kristin Griswold is a contributor to The County Post. The views expressed in this column are those of the author."
} as const;

// Newest first; County Post originals appear on every opinion desk.
export const countyPostOpEds: readonly CountyPostOpEd[] = [enoughAboutTheOtherGuyOpEd, texasMailerOpEd, millennialVoiceOpEd, dataCentersOpEd];

export const featuredCountyPostOpEds: NewsFeedItem[] = countyPostOpEds.map((article) => ({
  id: article.id,
  title: article.title,
  link: article.path,
  source: "The County Post",
  publishedAt: article.publishedAt,
  description: article.deck,
  categories: ["Opinion", "The County Post"],
}));

export function prependFeaturedCountyPostOpEds(items: NewsFeedItem[]) {
  const remainingItems = items.filter((item) => !featuredCountyPostOpEds.some((featured) =>
    item.id === featured.id || item.title.trim().toLowerCase() === featured.title.toLowerCase(),
  ));
  return [...featuredCountyPostOpEds, ...remainingItems];
}

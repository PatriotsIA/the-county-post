export const fetchLessons: {
  title: string;
  text: string;
  selector?: string;
  mobile?: string;
  example?: string;
}[] = [
  {
    title: "Find your edition",
    selector: ".nav-link-directory",
    mobile: ".menu-toggle",
    text: "Open Find Your State & County News and type your county name. Choose the result with your state beside it. In Fetch, use the name you know, such as Orleans Parish, Louisiana, or North Slope Borough, Alaska. You can also give a city and state. If the city spans several counties, choose one or read them all.",
    example: "Show me local headlines in Orleans Parish, Louisiana",
  },
  {
    title: "Explore the desks",
    selector: ".context-nav",
    text: "The links under the newspaper’s name belong to the edition you’re reading. On a county page, Weather opens the forecast, Public Notices lists official notices, and County Data opens the statistics. Use Back in your browser to return.",
  },
  {
    title: "Jump to a feed",
    selector: ".page-jump-toggle",
    text: "On a long page, choose Jump to in the lower corner. Pick a section such as Sports or Obituaries to move straight there. Choose a headline to read the publisher’s story.",
  },
  {
    title: "Search the news",
    selector: "#desk-general",
    text: "Use a name or a few words you remember, such as “library hours.” Try “Search the site for library hours” to check other pages too. Name the county and state to search another edition. After a briefing, select Choose a story or say “The one about the library.” You can ask “Who reported that?” or “When was it published?” Choose Read the original story for the publisher’s full report. Looking for an older story? Choose Search earlier coverage.",
    example: "Show me today’s headlines",
  },
  {
    title: "Find facts about your county",
    text: "Open County Data to see the Atlas. Choose Housing for rent and home values, Health for insurance, or Jobs & Business for commuting. Each measure gives its source and date. The Economic Data desk has GDP and historical income and unemployment figures. After a GDP answer, try “And in 2020?” or “What about Seattle, Washington?” to look up the same figure again.",
    example: "How many people live in Potter County, Texas?",
  },
  {
    title: "Compare places",
    text: "List the places you want, or choose Compare counties and use Add another place. Try “Compare GDP in Potter, Randall and Lubbock counties in Texas.” You can include a whole state or type “Add King County, Texas.” Ask “And in 2020?” to change the year. For a trend, try “Is rent going up faster in Potter or Randall County, Texas?” Fetch needs two shared years to answer. Choose Compare states for statewide figures, including several measures in one question. Read the year beside each figure. The ± beside a survey estimate shows its margin of error.",
    example: "Compare rent and household income in Texas and Oklahoma",
  },
  {
    title: "Check weather and public notices",
    text: "Choose Weather for the county forecast and active alerts. Ask “Will it rain this weekend?” and then “What about Monday morning?” Open the full weather report to see the hours Fetch used. Choose Public Notices for meetings, hearings, and bids. Follow the official notice link to check its date and details. For headlines, weather, and the next listed meeting together, choose Catch me up. Choose Remember on a county edition to use that county when you return.",
    example: "Will I need an umbrella in Potter County, Texas?",
  },
  {
    title: "Find services or start again",
    text: "Use Browse the site in Fetch for the daily Morning Post email, classifieds, local publishers, videos, partners, or the story submission form. If a desk is unavailable, choose Try again to repeat the same question. If you lose your place, choose Start over. You can always type a few words or choose a button.",
    example: "Browse the site",
  },
];

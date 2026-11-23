export type TourGuide = "site" | "fetch";
export const tourTitles = {
  site: "Learn How To Use The County Post",
  fetch: "How To Use Fetch",
} as const;

type Lesson = {
  title: string;
  instructions: string[];
  selector?: string;
  mobile?: string;
  example?: string;
  // Match the current edition's real navigation, including configured external destinations.
  nav?: string;
  countyOnly?: boolean;
};

const site: Lesson[] = [
  {
    title: "Find your edition", selector: ".nav-link-directory", mobile: ".menu-toggle",
    instructions: [
      "Choose Find Your State & County News to open the directory. On a phone, open the menu first.",
      "Pick a state, or type a county and state in Find A County, such as “Orange, TX.” Choose the matching result. Bookmark / Add web app in the footer helps you save the edition.",
      "Use the directory button below to try it. Back to my results brings you back to this lesson. Choose Next step to continue the tour.",
    ],
    nav: "Find Your State & County News",
  },
  {
    title: "Explore the desks", selector: ".context-nav",
    instructions: [
      "Look at the name at the top of the page to see which edition you’re reading. The row of links beneath it leads to that edition’s desks.",
      "Try Economy & Markets, Taxes & Public Finance, or Elections. Choose a subject within the desk, such as jobs, property taxes, or open records. County editions also have Weather, County Data, and Local Sources.",
    ],
    nav: "Economy & Markets",
  },
  {
    title: "Jump to a feed", selector: ".page-jump-toggle",
    instructions: [
      "Choose Jump to in the lower corner. Under News feeds on this page, pick the section you want. A county front page can have local headlines, sports, obituaries, politics, economy, crime, and opinion.",
      "Choose Show stories if the feed is closed. Scroll inside the feed for more stories. Choose a headline to read it, then go back or close the publisher’s tab to return.",
    ],
  },
  {
    title: "Search the news", selector: "#desk-general",
    instructions: [
      "If you remember the subject but not the headline, open Ask Fetch. Give it a few words from the story and the place, such as “library news in Potter County, Texas.”",
      "Check the publisher and date. Choose a headline to read it, or choose Search earlier coverage when offered. For the outlets themselves, open Local Sources in the county edition.",
    ],
    example: "Find articles about schools in Potter County, Texas", nav: "Local Sources", countyOnly: true,
  },
  {
    title: "Find facts about your county", nav: "County Data", countyOnly: true,
    instructions: [
      "Open County Data and pick a desk. Housing has rent and home values. Health, Education, Public Safety, and Agriculture each have their own measures.",
      "Read the value, unit, year, and source on the card. Read the chart or data table when available. Use Download CSV for a spreadsheet or Download JSON for the desk’s records.",
    ],
    example: "How many people live in Potter County, Texas?",
  },
  {
    title: "Compare places",
    instructions: [
      "Open Fetch and name the measure and every place you want to compare. Include the state for each county. You can also choose Compare counties or Compare states and use the menus.",
      "Read the year and source beside each figure. You can add another place or ask for a different year. Fetch flags figures that are missing or cannot be compared directly.",
    ],
    example: "Compare rent and household income in Texas and Oklahoma",
  },
  {
    title: "Check the county weather", nav: "Weather", countyOnly: true,
    instructions: [
      "In a county edition, choose Weather. Check the observation time and station, then find the day or hour you need. Read any active alerts.",
      "For a particular time, ask Fetch about rain this weekend or conditions on Monday morning. Choose Open full weather report to see the forecast behind its answer.",
    ],
    example: "Will I need an umbrella in Potter County, Texas?",
  },
  {
    title: "Find reader services",
    instructions: [
      "Choose Browse the site in Fetch to see pages grouped by task. Open a group such as Classifieds, email and reader services, then choose a destination.",
      "For information about the newspaper itself, use About. The footer links to Privacy and Terms. The next lessons walk through individual desks and services.",
    ],
    example: "Browse the site", nav: "About",
  },
  {
    title: "Look up economic history", nav: "Economic Data", countyOnly: true,
    instructions: [
      "Open Economic Data in the county edition. Find a series such as GDP, unemployment, or household income and check its reporting period.",
      "Read the available history and follow the source link for the underlying series. To look up one year directly, ask Fetch for the county, measure, and year.",
    ],
    example: "What was GDP in Potter County, Texas in 2020?",
  },
  {
    title: "Find meetings, hearings, and bids", nav: "Public Notices", countyOnly: true,
    instructions: [
      "Open Public Notices on a county page. Use the category and coverage filters to look for a meeting, hearing, or procurement notice.",
      "Follow the issuing agency’s link to confirm the time, location, or deadline. The publication date tells you when the notice appeared. The event date tells you when to attend. Coverage varies by county.",
    ],
  },
  {
    title: "Follow elections and turnout", nav: "Elections",
    instructions: [
      "Open Elections for reporting on voting systems, election administration, audits, and open records. Choose a subject to narrow the coverage.",
      "For participation figures, look for the Show Up Meter on a county page. Check the election year and what the percentage counts before comparing it with another county.",
    ],
    example: "Show voter turnout in Potter County, Texas",
  },
  {
    title: "Check stocks, metals, and cattle", selector: ".market-panel",
    instructions: [
      "Find Market data & local weather near the top of the page and choose Show if the panel is closed. Use the stock ticker, metal spot prices, or cattle report for the type of price you need.",
      "For livestock, check the auction, report date, weight band, and price unit. Ask Fetch for a steer or heifer in a particular weight range to find the matching row.",
    ],
    example: "Show metal prices",
  },
  {
    title: "Watch video and read opinion", selector: "#desk-video", nav: "Op-Eds",
    instructions: [
      "Choose Watch News Now or find Featured Videos on the page. Choose a video or channel. Use Pop out when offered to keep the player in view as you read.",
      "Open Op-Eds to read columns. For more features, look for Panhandle Legends in Texas editions, ITM Trading in the main menu, and White House News beside Elections.",
    ],
  },
  {
    title: "Get the Morning Post by email", nav: "Morning Post",
    instructions: [
      "Open Morning Post, choose your national, state, or county edition, and enter your email. Open the link in the confirmation email and choose Confirm subscription.",
      "Use the links in a newsletter to manage delivery or unsubscribe. To invite someone else, choose Give the Gift of The Morning Post and enter their edition and email.",
    ],
  },
  {
    title: "Browse classifieds or place a listing", nav: "Classifieds",
    instructions: [
      "Choose Classifieds to open the marketplace for your edition. Check the place shown, then browse listings and open one to see its description and contact options.",
      "To list something yourself, use the posting option in the marketplace and follow its instructions for your category and location.",
    ],
  },
  {
    title: "Send a story or a news tip", nav: "Submit A Story",
    instructions: [
      "Open Submit A Story from the edition the item concerns. Enter your name, email, and a headline or topic. You can send reporting, an opinion piece, a public notice, or an upcoming event.",
      "Include where and when it happened, the details editors can verify, and how to reach you. Review the form before sending it to the newsroom for editorial review.",
    ],
  },
  {
    title: "Find partners or advertise", nav: "Advertise",
    instructions: [
      "Open Partners to browse participating organizations. From a county edition, use its Partners desk for local listings.",
      "For an advertising placement, choose Advertise from the main menu and follow the advertiser site’s steps to select coverage and submit materials.",
    ],
  },
];

const fetch: Lesson[] = [
  {
    title: "Ask your first question",
    instructions: [
      "Choose a button such as Read the news, or type a question at the bottom and choose Send. A few words like “weather in Potter County, Texas” are enough.",
      "Choose Try below for a real example. After you see the answer, choose Back to tour to pick up this lesson again.",
    ],
    example: "What’s the weather in Potter County, Texas?",
  },
  {
    title: "Tell Fetch where to look",
    instructions: [
      "On the national or a state edition, include the county and state for a local answer. On a county page, Fetch uses that county unless you name another place.",
      "A city can span several counties. Fetch can show each county’s results. Choose a county to narrow them, or use Change place if you meant somewhere else.",
    ],
    example: "Show local headlines in Amarillo, Texas",
  },
  {
    title: "Follow up on a story or figure",
    instructions: [
      "Ask for headlines or describe the story you remember. Then say “The second story” or “Who published that?” to follow up on the same list.",
      "For figures, try “And in 2020?” For a comparison, name several counties or states, then add or replace one. Check the dates, units, and sources Fetch shows.",
    ],
    example: "Compare GDP in Potter, Randall and Lubbock counties in Texas",
  },
  {
    title: "Go straight to the answer",
    instructions: [
      "Ask Fetch to open a desk, or choose the page link below an answer. On a guided destination, look for the highlighted section and the collie.",
      "Choose Show me again to see that section again. Back to my results brings back the answer. If a lookup failed, choose Try again.",
    ],
    example: "What is the median gross rent in Potter County, Texas?",
  },
  {
    title: "Catch up on your county",
    instructions: [
      "Choose Catch me up for headlines, weather, and the next listed meeting. Use Remember on a county edition if you want to use it again later.",
      "Choose Since my last visit for recently published headlines and meeting notices. Change the starting date to see a different period.",
    ],
    example: "What changed in Potter County, Texas since my last visit?",
  },
  {
    title: "Reopen a chat or get an update",
    instructions: [
      "Choose Past chats and open a conversation by its title, or choose Continue last chat on the welcome screen. The saved answer keeps the sources and figures you saw.",
      "Ask a follow-up to keep going. Choose Check for updates to add a fresh answer. Start over begins another conversation.",
    ],
  },
  {
    title: "Keep a backup or use private chat",
    instructions: [
      "Past chats are saved in this browser. Before clearing its data or switching devices, choose Past chats and Save a backup. In the other browser, choose Restore chats and select that file.",
      "On a shared device, choose Private chat before asking a question. To remove a saved conversation, open Past chats, choose Delete chat beside its title, and confirm.",
    ],
  },
];

export const tourLessons = { site, fetch };

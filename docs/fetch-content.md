# What Fetch can retrieve

Fetch runs on loopback Vite or an explicitly enabled preview build. The front end ships to Amplify from main. The County Post News API has a separate SAM stack and CodePipeline. The local guide reads the same public data clients as the editions. The browser resolves reader tasks and runs searches against the edition’s own content. The answer, value, attribution, article link, and edition come from the site or its data services.

A Fetch navigation opens the relevant section and moves keyboard focus to the requested item. A blue and red pulse and the running collie mark it for just under five seconds. Escape dismisses the marker. Readers who prefer reduced motion see a steady outline and a still collie.

## Content map

| Reader request | Where the site gets it | Fetch behavior and coverage |
| --- | --- | --- |
| Editions and navigation | County and state directory, React Router, masthead and edition menus | Recognizes named counties and states throughout a question. Repeated county names can be narrowed by state. Multi-county cities and towns return results from each county edition, with a button or typed reply to narrow the original question. A place name shared by multiple states can be clarified first. The selected county’s FIPS identifies county data. |
| News stories | News API page bundles at national, state, and county scope | Broad questions return up to five headlines from the edition’s lead feed, with publisher excerpts, dates, and original links where available. County briefings favor stories that name the county or a distinctive town in the feed scope. An empty lead feed triggers a check of the other desks. Topic searches match titles, descriptions, publishers, and categories across the lead and relevant desks. Both use the edition’s county-locality checks. |
| Editorial and opinion | Published op-ed registry, bylines, decks, and canonical story paths | Finds originals by subject, author, or title. The same nationally distributed op-eds appear on county opinion desks. Results identify them as County Post opinion. |
| Subject pages | Shared editorial taxonomy | National, state, and county routes for Economy & Markets, Taxes & Public Finance, Elections, and their subject pages. The basic sports, politics, economy, crime, obituaries, and opinion feeds also have edition-page anchors. |
| Weather | County weather document, NWS observations and forecasts, U.S. Drought Monitor, NASA POWER | Shows station conditions, observation time and active alerts. Readers can name weekdays, nights, ranges or the weekend, then change the day in a follow-up. Weekend means Saturday and Sunday in county time. Morning, afternoon and evening answers use published hourly forecasts starting at 6 a.m., noon and 6 p.m. local time, respectively. The report link highlights the first matching card or hour. A direct request such as “Open tonight’s forecast” can take a reader straight there. Missing periods are named in the answer. Rainfall history and drought questions can use the county-center estimate or weekly drought report. The full desk supplies hourly detail, charts, warnings, and source links. |
| County Data Atlas | County overview declares domains, metric keys, availability, and featured measures. A domain document supplies observations, sources, units, and vintages. | Uses the requested county’s catalog to select a domain and measure. Links to the domain for detailed series, comparisons, downloads, suppression, and coverage notes. |
| Economic data | County FRED economic-data endpoint | Retrieves nominal or inflation-adjusted county GDP and its observation year. Separates the county figure from a city or metropolitan estimate. The economic desk also publishes unemployment and income series. |
| Voter turnout | Show Up Meter’s public dataset, keyed by election and county FIPS | Gives recorded ballots, registered voters, turnout percentage, and election label. Coverage varies by election and county. |
| Notices | County public-notices API, source registry, rollout and status metadata | Shows published notices and official source links. Regional records carry a coverage label. Ingestion currently targets Texas. |
| Local sources | Reviewed county outlet registry | Returns publication names and links. Some counties have few or no reviewed outlets. |
| Markets | Edition ticker’s 20 TradingView symbols, metal spot quotes, and USDA cattle reports | Shows the provider’s stock, index, FX, oil, or crypto quote card by name or ticker. Returns metal prices with timestamps and USDA prices with auction, report date and published steer or heifer weight band. Readers can open the exact quote in the Market desk. |
| Video and sponsored features | Featured-video API, channel and live-stream lists, Panhandle Legends episodes, ITM Trading feature | Finds cataloged video titles and published watch links. Featured channels and live availability change. The Legends collection and ITM feature have canonical destinations. |
| Partners and advertising | Edition-aware partner registry and public advertiser landing page | Locates directory entries and handoffs. A partner is identified separately from an editorial source. |
| Reader services | Morning Post, submissions, classifieds, directory, About, Privacy and Terms | Opens the relevant page. Classified inventory lives in a separate marketplace. Newsletter story links resolve individual IDs through the newsletter API. Neither service provides a sitewide searchable archive through these clients. |

## City and town boundaries

Fetch uses Census places and their county parts. Incorporated places use the 2025 subcounty estimates geography, including county parts with zero residents. Census-designated places and Connecticut use the 2020 place list, which matches the county boundaries used by Connecticut editions. The guide loads its national index on first open. It includes single-county and multi-county places, and common names for selected Census records such as Boise and Honolulu. A single-county answer identifies the city and county edition. An explicit county name selects that jurisdiction. If a state-qualified city name is misspelled, a near match requires the reader’s confirmation. It treats a metropolitan region as a different geography from a city and labels all answers with the county they cover. Refresh the bundled index with `python3 scripts/dev/update-fetch-city-counties.py`.

## Atlas coverage

The twelve domains are demographics, economy and income, housing, jobs and business, education, health, civic life and elections, public safety, agriculture, environment and disasters, government and public finance, and infrastructure and connectivity. The overview reports the actual release for each county. Examples include population, median age, rent, home values, unemployment, labor force participation, commute time, educational attainment, uninsured rate, voting-age population, traffic deaths, disaster declarations, property taxes, and internet subscriptions. Missing and suppressed measures retain their published status.

## Search boundaries

Article search covers a bounded window of the current edition feeds (up to 50 county lead items or 32 state/national lead items, then up to 32 items per searched desk). It uses title and feed metadata. Publisher full text, historical archives, unlisted classifieds, and private subscriber records are outside that index. The guide links readers to the published item or service when deeper detail lives there.

Local entry points include [edition routes](../src/App.tsx), [site catalog and public data lookup](../src/lib/fetch-content.ts), [article retrieval](../src/lib/fetch-articles.ts), and [the news locality contract](feeds.md).

## Pilot verification

The default build omits Fetch. Set `VITE_FETCH_PREVIEW=true` only on the intended Amplify preview branch to include it. A built preview uses the published News API URL and the in-browser guide. When choosing the hosted preview URL, use its exact origin in the News API stack’s `CorsOrigins` parameter. The production domain already receives the allow-origin header. A check using `https://feature-fetch-guide.d2z6lt4e5q50in.amplifyapp.com` as the origin returned HTTP 200 without that header on November 19 and November 23, 2026. Browsers on that origin would block the data. Verify the header for the actual hosted URL before inviting readers.

```sh
curl -sS -o /dev/null -D - -H "Origin: $PREVIEW_ORIGIN" \
  https://d2vo13idhuovzg.cloudfront.net/v1/counties/idaho/ada/weather
```

The expected `Access-Control-Allow-Origin` value is the preview’s origin, including scheme and hostname.

News lookup includes the matching edition’s mounted feed cards after locality and topic filtering, including RSS fallback. A quoted visible headline or an “on this page” reference can select a state or national desk embedded on a county page. Fetch holds the briefing order in memory for numbered and named follow-ups. Choose a story by button, number, publisher, or words from its headline or displayed excerpt. When several stories match, the numbered choices keep their displayed order and identify the county in a multi-county edition. Fetch can open the original, give its feed publication date and publisher, repeat the excerpt, or look for related coverage. Navigating to another page clears that context.

For a county figure, a short reply such as “And in 2020?” requests another year for the same measure and place. “What about Seattle, Washington?” carries the subject to the new place. A short date reply also works for forecasts and news briefings, such as “Tomorrow?” or “Yesterday?” A multi-county answer keeps all county parts until the reader chooses one. After narrowing, the reader can choose **Show all counties** or type “both counties again” to restore the area for the current question. “In my county” uses the open county edition, and Start over clears the conversation.

Publication windows use the reader’s displayed time zone. “This week” begins Sunday, and future and undated reports are excluded from dated results. If the searched feeds have no match in that window, Fetch can offer one explicitly labeled earlier report.

Each completed question or clarification choice emits a browser `fetch-pilot-outcome` event with `outcome`, `route`, and `duration_ms`. Routes distinguish recognized requests from free-text discovery. Count outcomes and compare response times by route. Set `VITE_FETCH_METRICS=true` on the preview branch to forward these fields through the existing GA integration. The event contains no prompt, story, county, or conversation history.

The County Post browser workflow builds the site and runs Playwright on pull requests and pushes to main. It also runs `npm run test:fetch-release` against a Fetch-enabled production bundle in desktop Chromium, desktop Firefox and mobile WebKit. That suite uses controlled API responses for geography, news, focus return, county narrowing, and county comparisons. The hosted preview still needs a live-service check from its own origin. Fetch coverage includes Potter/Randall, rural Briscoe County, a shared county name, the national and state pages, date boundaries, visible RSS during an outage, story selection, and mobile keyboard navigation. Before public release, use the hosted preview with a screen reader to hear the briefing, choose a numbered story, and close Fetch with focus back on its launcher.

## Guided discovery and comparisons

**Browse the site** groups the public destinations by reader task. **Explore county figures in Fetch** reads the selected county’s Atlas catalog. Selecting a desk lists its published measures, including keys added after the guide was built. Selecting a measure shows its value, vintage, source, and desk link. Readers can also name a measure, request an observation year or ask about a trend. Historical income and unemployment questions can use county FRED observations. Weather questions recognize everyday terms such as “umbrella” and support hourly forecasts.

**Learn How To Use The County Post** walks readers through the editions, news desks, data, weather, markets and reader services. **How To Use Fetch** covers asking a first question, choosing places, following up, comparing figures, opening results and managing private or saved chats. Both buttons appear on first open. Readers can jump to any lesson, try an example and return to the same step. The county picker, state comparison controls, and site directory all work without entering a question.

**Compare counties** accepts a list of counties across states. Readers can name places, add more by typing or using the menus, and remove individual selections. “Compare GDP in Potter, Randall and King counties in Texas” gives each county a row. It compares one measure at a time. GDP in current or chained 2017 dollars, unemployment and median household income use the county economic series. Population, median monthly gross rent and median home value use the corresponding Atlas desks. The year menu shows the years returned by any selected county. Changing years reuses the loaded records. Each result identifies its county, source and period, and preserves available survey margins. An arithmetic difference requires matching measures, periods, units and sources. A missing, suppressed or unreachable figure leaves the other results available. From a city answer, **Compare these counties** keeps the question and its year. All counties in the city area are included. Mixed state and county requests show statewide figures from the state snapshot for population, household income, rent and home value. Other statewide measures are labeled unavailable. Group rankings require comparable figures for every selected place.

**Compare states** covers the 50 states and DC. It supports population, median gross rent, median household income, per capita income, median owner-occupied home value, median age, household count, and the number of counties listed in the site directory. A prompt can request multiple states, measures, and population years. The guide shows arithmetic differences, dates, sources, and survey margins of error. Population change uses the selected endpoints. Directory counts use the current edition list, which includes county equivalents.

The checked-in extract uses state total rows for July 1 of 2020 through 2025 and statewide ACS estimates for the 2020–2024 five-year period. Run `python3 scripts/dev/update-fetch-state-data.py` to reproduce the extract. When adopting a new Census release, update the source dates, controls, and regression expectations together. [Population estimates](https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv) · [ACS summary files](https://www.census.gov/programs-surveys/acs/data/summary-file.2024.html)

For a local preview backed by the published feeds, weather, economy, notices, sources, markets, videos and Atlas, set `VITE_LOCAL_PUBLISHED_NEWS=true` in `.env.development.local`. The development server forwards these public reads to the site’s configured CloudFront distribution.

For a local preview using just the full published Atlas, set `VITE_LOCAL_PUBLISHED_ATLAS=true` in `.env.development.local`. The Vite development server reads the public edition’s county Atlas endpoints through a same-origin GET route. Both the county data pages and Fetch use those documents. Other news and weather requests continue to use the configured News API. The default and deployed builds use the configured News API for the Atlas.

## Finding something in everyday words

A reader can describe an action such as finding a buyer, contacting the newsroom, or finding out who covers their area. A broad topic such as housing can lead to figures, listings or reporting. Choosing a task carries the original place and question forward.

Free-text discovery searches published editorial and service pages, the text of County Post opinion pieces, featured video titles, reviewed county outlets, official notices, the selected edition’s feed headlines and excerpts, and the actual metric labels and descriptions in an identified county’s available Atlas desks. It displays the matching pages and stories as they arrive. An exact multi-word featured measure can be offered from the county overview. Selecting it opens its full record. Broader searches also read unfeatured measures, share the Atlas cache, and run three data desks at a time per county. Readers can select a matching measure to see its published value, date, source, and desk. Search tolerates a single typing mistake in longer words and recognizes a small set of common news terms. Edition and county matching retain the directory’s geographic rules.

## Nationwide edition checks

Run `npm run test:fetch-geography -- --workers=3` for the full directory. It builds a Fetch-enabled production bundle, opens every state edition and checks a state population answer. It then opens Fetch on every county edition, uses the weather shortcut, and asks for weather in a different state. Each observation carries the requested endpoint’s FIPS code, and each report link must point to that county. From the national edition it also asks for a news briefing for each county, checks the original local story link, and verifies that an unrelated wire story stays out. It asks for a Saturday forecast in a town in each county. Every county covered by the town must show its own Saturday forecast and report link. The Friday forecast must stay out of the answer. These checks use controlled responses so they can run without contacting public services.

Readers can use jurisdiction names such as “Municipality of Anchorage,” “Lake and Peninsula Borough,” and “Newport News city,” or enter a labeled county code such as “FIPS 01001.” A state-only weather question brings up that state’s counties. D.C. has one county equivalent, so Fetch can show its weather immediately. D.C. also participates in state population comparisons. The town index includes New England towns that the Census lists as county subdivisions and uses historic counties for Connecticut towns. Locally documented communities fill the remaining gaps, so every county edition has at least one mapped community. [Census geography files](https://www.census.gov/library/reference/code-lists/ansi/2020.html) · [Kalaupapa](https://health.hawaii.gov/kalaupapaupdates/) · [James City County](https://www.jamescitycountyva.gov/905/History)

Connecticut’s eight historic county editions use their published Atlas measures when available. For an empty demographics desk, Fetch can cite the April 1, 2020 population count on the historic county boundaries. It labels the date and geography and reports a missing observation when a reader requests a different year. An empty county data desk offers the other desks with published figures for that county. Newer federal county-level releases use planning regions. [2020 Census county counts](https://tigerweb.geo.census.gov/tigerwebmain/Files/acs25/tigerweb_acs25_county_2020_tab20_ct.html) · [Census Bureau geography change](https://www.census.gov/programs-surveys/acs/technical-documentation/user-notes/2023-01.html)

## Reader pilot before launch

The [November 20 local test session](fetch-test-session-2026-11-20.md) records the reader issues reproduced, fixes verified, and remaining acceptance checks.

Use a fresh browser on the preview. Ask a reader to do the following on their own phone, then repeat with a reader who uses a screen reader. Let each person choose their own words. Record which task they finished, where they needed help, and what they thought the answer meant.

| Reader task | What to check |
| --- | --- |
| From the national edition, find a story you remember about a school budget in Amarillo, Texas. | Can the reader identify the county, publisher, date and relevant passage, open the original story, and find earlier coverage? Earlier search reads a larger window of the available feeds. |
| Find out whether rent is going up faster in Potter or Randall County, Texas. | Can the reader name the periods and the change for each county? When the site only has one shared year, can they find and explain the latest rents instead? |
| Remember a county, open a different edition, and catch up on home. | Can the reader identify the publication or forecast dates and the next meeting listed, recognize a gap in coverage, and forget the county? The preference is stored on that browser. |
| Recover from an interrupted lookup. | Using a controlled outage on the preview, restore service and ask the reader to finish. Can they find **Try again**, recognize cached results, and recover the original answer without retyping the question? |

Record human outcomes separately from automated browser checks. For screen-reader sessions, listen for the county name and result headings, then check that the reader can reach the original source and return to the launcher.

## City crime comparisons

Fetch uses the municipal police department's full-year reporting jurisdiction when a reader asks for a city crime rate. The local extract uses the 2025 Texas DPS Crime by Jurisdiction workbook. Run `python3 scripts/dev/update-fetch-city-crime.py` to reproduce it. The importer matches city police departments in the place directory and keeps records with 12 months of reporting, a positive population served and offense counts that reconcile to the published total. Fetch checks the city name, state and agency's county before using a row. County links describe the city's geography. Rates use agency populations.

“Which has a higher crime rate, Amarillo, Texas or Lubbock, Texas?” compares reported index offenses per 100,000 people served. Readers can also ask for violent or property crime. Texas DPS includes human trafficking in its violent index and arson in its property index. Unavailable places and years are identified in the answer. [Texas DPS annual report and jurisdiction tables](https://www.dps.texas.gov/section/crime-records/crime-texas)

## County crime statistics

Every county edition has a Public Safety page under `/:stateSlug/:countySlug/data/public-safety`. Fetch, the county Data Atlas, and the JSON and CSV downloads share one county release. The November 20, 2026 extract includes 2025 observations for 2,986 editions, earlier observations for 121, and an explicit gap for 36. Each gap has labeled statewide context. County comparisons use the edition’s five-digit FIPS code.

The release draws on four sources:

- The 2025 figures for 2,971 editions group FBI reporting agencies by the county of their headquarters. Rates use the population served by reporting agencies. Coverage weights that population by the months each agency reported. A city department may serve people on both sides of a county line. The County Post extract selects the violent and property offense rates and counts and adds a combined rate. [Probative Growth, v2.1.0](https://doi.org/10.5281/zenodo.24011321) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- For 111 other editions, PlaceStats supplies a pair of rates from the FBI Return A file for the latest available common year through 2025. Participating agencies must have reported all 12 months and serve at least 90% of residents. [Violent crime](https://placestats.org/us/indicator/ucr-violent_crime_rate/) · [Property crime](https://placestats.org/us/indicator/ucr-property_crime_rate/)
- The Connecticut Division of Criminal Justice supplies 2024 counts and population for the Tolland and Windham judicial districts. Each district’s towns match the historic county in the edition directory. The importer verifies the town sets and converts the offense counts to rates per 100,000 residents. [2024 report, page 3](https://portal.ct.gov/dcj/-/media/dcj-beta/connecticut-data-report2025.pdf#page=3) · [Judicial district town definitions](https://www.cga.ct.gov/current/pub/chap_890.htm)
- For 23 editions, the University of Wisconsin Population Health Institute supplies a historical violent crime rate through its 2022 County Health Rankings trends release. Each page displays the year of observation. [County Health Rankings data and documentation](https://www.countyhealthrankings.org/health-data/methodology-and-sources/data-documentation/national-data-documentation-2010-2023)

Run `python3 scripts/dev/update-county-crime.py --cache /tmp/county-crime-inputs` from the repository with Node dependencies installed, curl, and pdftotext available. Use an empty cache to check for upstream revisions. Run `npm run test:fetch-geography -- --grep "every published edition"` to verify the extract against the edition directory.

### Editions awaiting a verified county crime figure

| State | County or county-equivalent editions |
| --- | --- |
| Alaska | Chugach, Copper River, Denali, Hoonah-Angoon, Kusilvak, Lake and Peninsula, Southeast Fairbanks, Yakutat, Yukon-Koyukuk |
| Hawaii | Kalawao |
| Indiana | Benton, Fountain, Jasper, Jefferson, Morgan, Ohio, Orange, Owen, Switzerland, Union |
| Mississippi | Benton, Holmes, Issaquena, Jefferson Davis, Lawrence, Perry, Quitman, Wilkinson, Yazoo |
| Nebraska | Blaine, Garden |
| New Mexico | Harding |
| South Dakota | Buffalo, Grant, Haakon |
| West Virginia | Clay |

Readers in these editions can also explore participating agencies in the Bureau of Justice Statistics dashboard. [LEARCAT](https://learcat.bjs.ojp.gov/)

## Checking Fetch against the published County Data pages

Run `npm run audit:fetch-measures` to check Potter County, Texas, Fairfield County, Connecticut, and Sitka City and Borough, Alaska. The check discovers each desk and measure, types its printed label in Fetch, and matches the county, value, unit when provided, vintage, source link and destination card. For one county, pass its five-digit FIPS code after `--`. For nationwide coverage use `--all`, or split the directory using `--shard=1/64` through `--shard=64/64`. Each run reads current published data and requires Chromium.

Fetch records county edition visits on the reader’s browser. Opening another desk in that county keeps the same starting time. Asking from the national edition reads the county’s last visit on that browser. A first visit starts at the beginning of today. The date control lets the reader include earlier publications.

The Fetch published measure parity workflow checks the three sample editions on relevant pull requests and main-branch changes. The nightly run checks one of 64 nationwide shards in rotation. A manual workflow run can repeat a specific shard when a publisher changes its data. Check the run log for the exact footprint of a passing audit.

## Additional uncoached reader sessions

Use the local preview on the participant’s device. Give only the task in the first column. Keep the observation column with the facilitator. Have a returning county visit available for the last task. Run one session on a reader’s own phone and one with a reader who regularly uses their screen reader.

| Read to the participant | Observe without prompting |
| --- | --- |
| You compared rent in Potter and Randall counties, Texas, for 2020. You meant Potter County in Pennsylvania. Fix the comparison and tell me what year and other county you have. | Either a typed correction or the place controls work. Check that the reader can identify the retained year, county, and any missing figure. |
| Find the figures behind one answer. Point out the figure Fetch used, return to your answer, and show me that figure again. | Check focus on arrival, discovery of both return controls, and preservation of the original answer. Record what the screen reader announces. |
| Among Randall and Lubbock counties, where are rents lower and household incomes higher than in Potter County, Texas? Explain what the figures allow you to conclude. | Listen for the reference county, both conditions, any gaps and a source. A correct explanation of insufficient data counts. |
| See what has been published in your county since you last visited. Now find what was published since a day you choose. | Listen for the county, date range, publisher, and distinction between a notice’s publication and its meeting date. |
| Find yesterday’s county comparison, add a third county, then move the conversation to another browser. | Give the reader a previously saved chat and a second browser. Observe whether they find Past chats, retain the comparison year, and transfer the backup themselves. Ask where someone else using the first browser could see it. |

For each task record device/browser, assistive technology if used, completed independently / completed with help / stopped, the reader’s interpretation, and the point of difficulty. A wrong county, lost comparison place, inaccessible destination or misunderstood coverage gap warrants a fix and a repeat of that task. Automated browser checks and facilitator rehearsals are separate from participant outcomes.

## Saved conversations and release

**Past chats** stores conversations in IndexedDB for the County Post origin. **Continue last chat** opens the dated original and restores the selected measures, places and story order. **Check for updates** appends a new turn. External live quote widgets can be reopened from their saved destination. A private chat keeps its turns in memory. **Start over** begins a separate conversation. Removing a chat affects that browser profile. A downloaded backup contains its own copy.

**Save a backup** downloads a versioned JSON file. **Restore chats** validates the complete file before writing and merges by conversation and turn ID. A reader can use this to move chats from the local preview to the hosted preview or from a preview to production, since each origin has separate storage. Transcripts and backup files stay with the reader. Existing public County Post data requests continue to run when a question needs them.

Before enabling Fetch for readers:

1. Integrate the local Fetch changes with the currently deployed main revision. Run the build, browser release tests, and geography and published-measure checks on that revision. The default build keeps the launcher off.
2. Build an Amplify preview branch with the branch override `VITE_FETCH_PREVIEW=true` and the published `VITE_NEWS_API_URL`. Check the exact preview origin against the News API, including county weather, news, public notices and Atlas responses. Update the API stack’s `CorsOrigins` and verify its responses if the origin is missing.
3. On the HTTPS preview, repeat the saved-comparison, fresh-browser import, private-chat and changed-story tests. Run the uncoached phone and screen-reader pilot. Record the participants’ outcomes separately from browser automation.
4. After approval, merge the tested revision, set the same build flag on the production branch, rebuild, and smoke-test the canonical domain. For rollback, remove the production override or set it to false and rebuild. This hides Fetch and preserves saved conversations on that origin.

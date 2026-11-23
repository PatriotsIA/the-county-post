# Fetch local test session, November 20, 2026

The local pilot runs at `http://127.0.0.1:5180/texas/potter`. This session exercised national, state and county editions. The standard production bundle was also opened locally on the national, Maine and Potter County pages. Each page mounted with Fetch disabled.

## Reader problems reproduced and fixed

| Reader action | Original result | Verified behavior |
| --- | --- | --- |
| Compare crime rates in Amarillo, Lubbock and Dallas | Fetch ranked only Lubbock and Dallas. | It lists all three police jurisdictions. A group ranking requires a figure for each. An unrecognized city prompts for clarification. |
| Ask for rent in several cities, including Reno, Texas | Clarifying which Reno could lose the other cities. | The reader chooses the intended Reno, then sees the county choices for every city. The answer labels the figures as county-wide. |
| Ask “Which has the cheapest rent?” after comparing counties, or “Which has the most?” after comparing state populations | Fetch could start a new search. | The answer carries the places, measure and year forward. The reader can also remove a place by name. Shared county names require a state. |
| Add King County for 2020 to a comparison showing the latest figures | The new county appeared, but the year stayed on latest. | The year changes for the entire group. A missing historical figure stays labeled. |
| Use Oregon’s abbreviation in “Baker County OR and Yell County AR” | Fetch could read OR as a conjunction and lose the state qualifier. | Both city and county lists retain Oregon. A generated check covered 3,144 three-county prompts with different separators and 51 three-state prompts. |
| Ask Fetch to take the reader to a specific steer price, then reopen it | A partial USDA report blocked navigation to a valid row. Reopening could also replay a completed navigation. | Fetch can guide the reader to the verified row in a partial report. Navigation is consumed once. Changing the question or closing Fetch cancels a pending navigation. |

## Checks against published data

- Compared the median rent shown in Fetch with the housing Atlas response for Potter County TX, Orleans Parish LA, Anchorage Municipality AK, Los Angeles County CA, Miami-Dade County FL, Washington County UT and Washington County OR. All seven matched the published 2024 ACS five-year figures.
- Checked that the first story link in a Miami-Dade briefing appeared in the county page feed. Fetch disclosed that some sources were unavailable. The current feed contents can change.
- Followed the request for a 500-pound steer to the 500–549 lb USDA row. The focused row showed the quoted price of $460.63 per hundredweight. Visually checked that the Apple TradingView card displayed the stock symbol and a numeric quote.
- Confirmed that a Honolulu weather question from the national edition reached the Honolulu County forecast, with the local station, time zone and requested forecast day.

## Repeated use and accessibility

A Chromium session at each of 320 and 1,280 CSS pixels ran 20 cycles of five questions. Each cycle compared state populations, requested a ranking, removed a state, switched to city crime statistics, asked for an unavailable year, and closed and reopened Fetch with the keyboard. All 200 answers kept the expected context. The checks found no horizontal overflow or uncaught page exceptions. External data requests were blocked for this exercise.

Axe-core 4.10.3 reported zero WCAG 2/2.1 A/AA violations in the Fetch dialog across ten scans. Each width covered the welcome panel, state results, county results, city clarification and the tutorial. Human screen-reader use and the virtual keyboard on a physical phone remain separate acceptance checks.

## Suite evidence

| Scope | Result |
| --- | --- |
| Nationwide geography | 177 checks passed on the first pass and again on replay. The replay took 13.2 minutes. Controlled responses exercised all 3,143 county editions, 50 states and DC, cross-state weather routing, and county news and town lookups from the national edition. |
| Fetch-enabled release bundle | All 87 checks passed without retries, 29 each in desktop Chromium, desktop Firefox and mobile WebKit. Firefox is included in the repository’s release suite and browser-test workflow. |
| Full site browser suite | All 218 checks passed in 10.2 minutes with one Chromium worker and retries disabled. An earlier concurrent run had failures in the advertising and classifieds tests and several tests that needed retries. |
| Production build, lint and whitespace checks | Passed. Fetch remained opt-in for the production bundle. |

The geography suite verifies routing and attribution with controlled observations. The published-data spot checks above cover a sample of actual records. City police figures in this build use the available Texas municipal dataset. The Seattle test verifies the coverage gap stays visible alongside the Texas results and suppresses a group ranking.

The next acceptance step is to repeat the reader pilot on the intended preview origin and on a physical phone with a screen-reader user. That checks the spoken order of the answers, the virtual keyboard, and whether a reader can reach and recognize the highlighted destination without coaching.

import { expect, test } from "@playwright/test";
import { counties, getCountiesForState } from "../../src/data/counties";
import { states } from "../../src/data/states";
import { getExactSearchState, searchCounties, searchStates } from "../../src/data/place-search";

test("every county is discoverable with its state in either order, abbreviations and punctuation", () => {
  test.setTimeout(120_000);
  const failures: string[] = [];
  for (const county of counties) {
    for (const query of [
      `${county.displayName}, ${county.state.name},`,
      `${county.state.name}, ${county.displayName}`,
      `${county.state.abbr.toLowerCase()}, ${county.slug}`,
      county.displayName,
    ]) {
      if (!searchCounties(query).some((match) => match.fips === county.fips)) failures.push(`${county.fips}: ${query}`);
    }
  }
  expect(counties).toHaveLength(3143);
  expect(failures).toEqual([]);
});

test("all 50 states and DC return their complete county lists for names and abbreviations", () => {
  for (const state of states) {
    const expected = getCountiesForState(state.slug).map((county) => county.fips);
    for (const query of [state.name, `  ${state.abbr.toLowerCase()}, `, state.slug]) {
      expect(searchCounties(query).map((county) => county.fips)).toEqual(expected);
      expect(searchStates(query)).toEqual([state]);
      expect(getExactSearchState(query)).toEqual(state);
    }
  }
});

test("Jefferson has no result cap and accepts county/state combinations and the reported typo", () => {
  const jefferson = searchCounties("Jefferson County");
  expect(jefferson.length).toBeGreaterThan(10);
  expect(jefferson.some((county) => county.fips === "48245")).toBe(true);
  for (const query of ["texas, jeffson", "jefferson, texas,", "TX Jefferson", "jefferson county texas", "jefferson, tex"]) {
    expect(searchCounties(query).map((county) => county.fips)).toEqual(["48245"]);
  }
  expect(searchCounties("Texas, jeff").map((county) => county.fips)).toContain("48245");
  expect(searchCounties("texas,")).toHaveLength(254);
  expect(searchCounties("Jefferson, Virginia")).toEqual([]);
  expect(searchCounties("West Virginia, Jefferson").map((county) => county.fips)).toEqual(["54037"]);
  expect(searchCounties("no-such-county-987654321")).toEqual([]);
});

test("county/city collisions, parish names, accents, cities, FIPS and state filters stay intact", () => {
  expect(searchCounties("Baltimore City, MD").map((county) => county.slug)).toEqual(["baltimore-city"]);
  expect(searchCounties("Baltimore County, MD").map((county) => county.slug)).toEqual(["baltimore"]);
  expect(searchCounties("LA, Jefferson Parish").map((county) => county.fips)).toContain("22051");
  expect(searchCounties("Saint Louis City, MO").map((county) => county.fips)).toEqual(["29510"]);
  expect(searchCounties("Texas, Amarillo").map((county) => county.slug)).toContain("potter");
  expect(searchCounties("48245").map((county) => county.slug)).toEqual(["jefferson"]);
  expect(searchCounties("Dóna Ana, NM").map((county) => county.fips)).toEqual(["35013"]);
  const texas = getCountiesForState("texas");
  expect(searchCounties("", texas)).toEqual(texas);
  expect(searchCounties("Jeffson, TX", texas).map((county) => county.fips)).toEqual(["48245"]);
  expect(searchCounties("Jefferson, Florida", texas)).toEqual([]);
});

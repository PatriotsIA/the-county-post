import { getCountyByState } from "@nickgraffis/us-counties";
import { states, type StateSite } from "./states";

type UsCounty = {
  name: string;
};

const countyNameStates = new Map<string, StateSite[]>();

for (const state of states) {
  for (const county of getCountyByState(state.name) as UsCounty[]) {
    const key = county.name.toLowerCase();
    const list = countyNameStates.get(key) || [];
    list.push(state);
    countyNameStates.set(key, list);
  }
}

export function getOtherStatesWithCountyName(countyName: string, targetAbbr: string) {
  return (countyNameStates.get(countyName.toLowerCase()) || []).filter((state) => state.abbr !== targetAbbr);
}

export function isAmbiguousCountyName(countyName: string) {
  return (countyNameStates.get(countyName.toLowerCase())?.length || 0) > 1;
}

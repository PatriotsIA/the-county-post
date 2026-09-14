import { useLocation } from "react-router-dom";
import { getCounty } from "../data/counties";
import { getStateBySlug } from "../data/states";
import { countyAdKey } from "../data/ads";

/** Target the edition being read, including national context feeds on county pages. */
export function useAdEditionKey(countyKey?: string) {
  const { pathname } = useLocation();
  const [stateSlug, countySlug] = pathname.split("/").filter(Boolean);
  const state = getStateBySlug(stateSlug);
  const county = state ? getCounty(state.slug, countySlug) : undefined;
  return countyKey ?? (county ? countyAdKey(county.state.slug, county.slug) : state?.slug);
}

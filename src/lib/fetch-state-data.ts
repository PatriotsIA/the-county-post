import snapshot from "../data/fetch-state-census.json";
import type { StateMeasure } from "./fetch-state-comparison";

type StateRow = { population: Record<string, number> } & Record<
  Exclude<StateMeasure, "counties" | "population">,
  number[]
>;
export const stateData: Record<string, StateRow> = snapshot;
export const populationSource =
  "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv";

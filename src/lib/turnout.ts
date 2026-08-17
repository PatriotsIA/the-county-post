type TurnoutEntry = {
  registeredVoters: number;
  ballotsCast: number;
};

type TurnoutElection = {
  id: string;
  year: number;
  electionLabel: string;
  electionType: string;
  updatedAt: string;
  source?: {
    name?: string;
    url?: string;
  };
  byFips: Record<string, TurnoutEntry>;
};

type TurnoutDataset = {
  schemaVersion: number;
  generatedAt: string;
  elections: TurnoutElection[];
};

const turnoutUrl = import.meta.env.VITE_TURNOUT_DATA_URL?.trim() || "/data/turnout/latest.json";
const turnoutCacheKey = "the-county-post.turnout.latest";

let inMemoryDataset: TurnoutDataset | null = null;

function isValidEntry(entry: unknown): entry is TurnoutEntry {
  if (!entry || typeof entry !== "object") return false;
  const candidate = entry as Partial<TurnoutEntry>;
  return (
    typeof candidate.registeredVoters === "number" &&
    Number.isFinite(candidate.registeredVoters) &&
    candidate.registeredVoters > 0 &&
    typeof candidate.ballotsCast === "number" &&
    Number.isFinite(candidate.ballotsCast) &&
    candidate.ballotsCast >= 0
  );
}

function isValidDataset(dataset: unknown): dataset is TurnoutDataset {
  if (!dataset || typeof dataset !== "object") return false;
  const candidate = dataset as Partial<TurnoutDataset>;
  if (typeof candidate.schemaVersion !== "number" || typeof candidate.generatedAt !== "string" || !Array.isArray(candidate.elections)) {
    return false;
  }

  return candidate.elections.every((election) => {
    if (!election || typeof election !== "object") return false;
    const candidateElection = election as Partial<TurnoutElection>;
    if (
      typeof candidateElection.id === "string" &&
      typeof candidateElection.year === "number" &&
      typeof candidateElection.electionLabel === "string" &&
      typeof candidateElection.electionType === "string" &&
      typeof candidateElection.updatedAt === "string" &&
      candidateElection.byFips
    ) {
      return Object.values(candidateElection.byFips).every(isValidEntry);
    }
    return false;
  });
}

function readCachedDataset() {
  try {
    const cached = window.localStorage.getItem(turnoutCacheKey);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    return isValidDataset(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedDataset(dataset: TurnoutDataset) {
  try {
    window.localStorage.setItem(turnoutCacheKey, JSON.stringify(dataset));
  } catch {
    // A full county dataset may exceed a browser's storage quota.
  }
}

async function loadTurnoutDataset() {
  if (inMemoryDataset) return inMemoryDataset;

  try {
    const response = await fetch(turnoutUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Turnout fetch failed: ${response.status}`);
    const dataset: unknown = await response.json();
    if (!isValidDataset(dataset)) throw new Error("Turnout payload schema mismatch.");
    inMemoryDataset = dataset;
    writeCachedDataset(dataset);
    return dataset;
  } catch {
    const cached = readCachedDataset();
    if (cached) {
      inMemoryDataset = cached;
      return cached;
    }
    throw new Error("Unable to load turnout data.");
  }
}

export type CountyTurnoutSummary = {
  electionId: string;
  year: number;
  registeredVoters: number;
  ballotsCast: number;
  turnoutPct: number;
  electionLabel: string;
};

export async function getCountyTurnoutHistoryByFips(fips: string): Promise<CountyTurnoutSummary[]> {
  const dataset = await loadTurnoutDataset();
  return dataset.elections
    .flatMap((election) => {
      const entry = election.byFips[fips];
      if (!entry || entry.registeredVoters <= 0) return [];
      return [{
        electionId: election.id,
        year: election.year,
        registeredVoters: entry.registeredVoters,
        ballotsCast: entry.ballotsCast,
        turnoutPct: Math.min(100, (entry.ballotsCast / entry.registeredVoters) * 100),
        electionLabel: election.electionLabel,
      }];
    })
    .sort((a, b) => b.year - a.year);
}

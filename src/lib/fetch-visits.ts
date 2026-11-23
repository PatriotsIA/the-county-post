// Desk navigation within one county shares the cutoff from entry into that edition.
let activeVisit: { fips: string; previous?: number } | undefined;

function storedVisit(fips: string) {
  try {
    const stored = Number(localStorage.getItem("fetch.visit." + fips));
    if (stored > 0 && stored <= Date.now()) return stored;
  } catch { /* Browser storage is optional. */ }
}

export function recordCountyVisit(fips?: string) {
  if (activeVisit?.fips === fips) return;
  activeVisit = fips ? { fips, previous: storedVisit(fips) } : undefined;
  if (fips) {
    try {
      localStorage.setItem("fetch.visit." + fips, String(Date.now()));
    } catch { /* Readers can still choose a starting day. */ }
  }
}

function previousCountyVisit(fips: string) {
  return activeVisit?.fips === fips ? activeVisit.previous : storedVisit(fips);
}

export function dateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function changesWindow(fips: string, question: string, selected?: number) {
  const typed = question.match(/\bsince (\d{4}-\d{2}-\d{2})\b/i)?.[1];
  const previous = previousCountyVisit(fips);
  const since =
    selected ?? (typed ? Date.parse(typed + "T00:00:00") : previous) ?? new Date().setHours(0, 0, 0, 0);
  const day = dateInputValue(new Date(since));
  const valid =
    Number.isFinite(since) && since <= Date.now() && (selected !== undefined || !typed || typed === day);
  return {
    since,
    day: valid ? day : "",
    firstVisit: previous === undefined && !typed && selected === undefined,
  };
}

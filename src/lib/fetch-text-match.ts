export const recalledStory =
  /\b(?:that|the|a|an) (?:news )?(?:story|article|piece|report) (?:about|on|I|from|that)\b|\bI (?:remember reading|remember seeing|read|saw) something about\b/i;

export const searchWords = (value: string) =>
  value
    .toLowerCase()
    .replace(/[’']/g, "")
    .match(/[\p{L}\d]+/gu) || [];
export const wordStem = (word: string) =>
  word.length > 4 ? word.replace(/ies$/, "y").replace(/s$/, "") : word;

// Allow one missing, transposed, or mistyped letter in a longer search word.
// Never approximate a date, dollar amount, short acronym, or geographic scope.
export function closeSpelling(a: string, b: string) {
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1 || /\d/.test(a + b)) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length)
    return (
      a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
    );
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

const equivalents: [string, RegExp][] = [
  ["helicopter", /\b(?:choppers?|rotorcraft)\b/gi],
  ["wildfire", /\b(?:brush|grass|wildland) fires?\b/gi],
  ["obituary", /\b(?:obits?|death notices?)\b/gi],
  ["collision", /\b(?:wrecks?|crashes|crash)\b/gi],
  ["layoff", /\b(?:job cuts?|laid off|layoffs?)\b/gi],
];

export function newsQueryWords(text: string) {
  for (const [term, pattern] of equivalents) text = text.replace(pattern, term);
  return searchWords(text);
}

export function searchField(text: string) {
  const exact = new Set(searchWords(text).map(wordStem));
  const aliases = new Set(equivalents.filter(([, pattern]) => text.search(pattern) >= 0).map(([term]) => term));
  // Preserve Black Hawk as a name in a reader’s query. A helicopter query may find it in a report.
  if (/\bblack hawks?\b/i.test(text)) aliases.add("helicopter");
  return { exact, aliases };
}
export function termWeight(term: string, field: ReturnType<typeof searchField>) {
  if (field.exact.has(term)) return 4;
  if (field.aliases.has(term)) return 3;
  for (const word of field.exact) if (closeSpelling(term, word)) return 1;
  return 0;
}

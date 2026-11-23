export function asksForLowerFigure(text: string) {
  return /\b(?:has|had|is|was|are|were|with|the)\s+(?:(?:a|the)\s+)?(?:lowest|lower|smallest|smaller|fewest|fewer|least|cheapest|cheaper)\b/i.test(
    text,
  );
}

// Recognize a short follow-up only when its subject is fully accounted for.
export function comparisonRank(text: string, measures: readonly { pattern: RegExp }[]) {
  let rest = text.toLowerCase().trim();
  const lead =
    /^(?:and )?(?:which(?: (?:one|place|state|county|of (?:them|these)))?|who|where) (?:is|has|had|was|has got) (?:the )?(highest|higher|largest|larger|most|lowest|lower|smallest|smaller|fewest|least|cheapest|cheaper)\b/.exec(
      rest,
    );
  if (!lead) return;
  rest = rest.slice(lead[0].length);
  for (const measure of measures) rest = rest.replace(measure.pattern, " ");
  rest = rest.replace(/\b(?:in|for) (?:19|20)\d{2}\b|\b(?:value|figure|one|please)\b|[?.!,]/g, "").trim();
  if (!rest) return asksForLowerFigure(lead[0]) ? "low" : "high";
}

export function removalName(text: string) {
  return /^(?:please )?(?:remove|drop|leave out)\s+(.+?)(?: from (?:the|this|our) (?:comparison|list))?[.?!]*$/i.exec(
    text.trim(),
  )?.[1];
}

export function placeCorrection(text: string) {
  const swap = /^replace (.+?) with (.+?)[.!?]*$/i.exec(text);
  if (swap) return { from: swap[1], to: swap[2] };
  const fix = /^(?:no[, ]+)?(?:i meant|change (?:it|that|the place) to) (.+?)[.!?]*$/i.exec(text);
  if (fix) return { from: undefined, to: fix[1] };
}

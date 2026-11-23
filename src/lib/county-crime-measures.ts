// Wording shared by the Atlas lookup and the two-county comparison.
export const countyCrimeMeasures = [
  {
    key: "violent-crime-count",
    label: "Reported violent offenses",
    pattern: /\b(?:how many|number of|count of) (?:reported )?violent (?:crimes?|offenses?)\b/i,
  },
  {
    key: "property-crime-count",
    label: "Reported property offenses",
    pattern: /\b(?:how many|number of|count of) (?:reported )?property (?:crimes?|offenses?)\b/i,
  },
  {
    key: "violent-crime-rate",
    label: "Reported violent crime rate",
    pattern: /\bviolent (?:crimes?|offenses?)\b/i,
  },
  {
    key: "property-crime-rate",
    label: "Reported property crime rate",
    pattern: /\bproperty (?:crimes?|offenses?)\b/i,
  },
  {
    key: "reported-crime-rate",
    label: "Combined reported violent and property crime rate",
    pattern: /\bcrime (?:rates?|statistic\w*|stats|data|figures)\b|\b(?:more|less|higher|lower) crime\b/i,
  },
].map((m) => ({ ...m, domain: "public-safety" as const }));

export function countyCrimeMeasure(question: string) {
  if (
    /\b(?:hate|drug|gun|cyber|organized|domestic|juvenile|financial|white.collar|sex|motor vehicle|arson|murder|assault|burglary|robbery|fraud)\b/i.test(
      question,
    )
  )
    return;
  return countyCrimeMeasures.find((m) => m.pattern.test(question));
}

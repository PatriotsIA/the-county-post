import type { ContentLink } from "./fetch-content";
import { newsQueryWords, searchField, wordStem } from "./fetch-text-match";

export type StoryAction = "detail" | "publisher" | "date" | "open" | "related";
const commands: [StoryAction, RegExp][] = [
  ["related", /\b(more like|similar to|related (?:to|stories)|more stories like)\b/],
  ["open", /^(?:please )?(?:open|read|take me to)\b/],
  [
    "date",
    /\b(?:when|what date)\b.*\b(?:published|posted|written|reported|come out|appear)\b|\bpublication date\b/,
  ],
  [
    "publisher",
    /\b(who (?:reported|wrote|published|covered)|which (?:publisher|outlet|source)|source (?:of|for))\b/,
  ],
  [
    "detail",
    /\b(tell me (?:more|about)|more (?:details|about)|summari[sz]e|what (?:did|does) .+ (?:say|report))\b/,
  ],
];
const ordinals = ["first", "second", "third", "fourth", "fifth"];
const position = "(first|second|third|fourth|fifth|last|\\d{1,2}(?:st|nd|rd|th)?)";
const listedPosition = new RegExp(
  `\\b${position}\\s+(?:story|one|headline|article|report)\\b|\\b(?:story|article|headline|number)\\s*#?\\s*${position}\\b`,
  "i",
);
const shortPosition = new RegExp(
  `^(?:(?:please )?(?:open|read|summarize|tell me about) )?(?:the )?#?${position}[.!?]*$`,
  "i",
);
const filler = new Set(
  "a an about appear are article articles by can come could date did do does fetch for from give headline headlines how i in is it like me more of on one open out outlet please posted publication publisher published read related report reported reports say show similar source stories story tell that the this to us was what when which who wrote you written".split(
    " ",
  ),
);

export function storyReference(
  question: string,
  stories: ContentLink[],
  selected?: ContentLink,
  pending?: StoryAction,
) {
  const command = question.toLowerCase();
  if (pending && /^(?:please )?(?:find|search|look for)\b/.test(command)) return;
  const ordinal = command.match(listedPosition) || command.match(shortPosition);
  const reference = /\b(?:story|article|headline|report|one|that|this|it|similar)\b/.test(command);
  const describing =
    /^(?:please )?(?:show me )?(?:the |that )?(?:one|story|article) (?:about|on|from|with)\b/.test(command);
  const action =
    commands.find(([, pattern]) => pattern.test(command))?.[0] ||
    pending ||
    (ordinal || describing ? "detail" : undefined);
  if (!action || (!reference && !selected && !pending && !ordinal)) return;
  if (ordinal) {
    const word = ordinal[1] || ordinal[2];
    const index =
      word === "last"
        ? stories.length - 1
        : ordinals.includes(word)
          ? ordinals.indexOf(word)
          : parseInt(word, 10) - 1;
    return { action, story: stories[index], positional: true };
  }
  const terms = newsQueryWords(command)
    .filter((w) => !filler.has(w))
    .map(wordStem);
  if (terms.length) {
    const matches = stories.filter((s) => {
      const field = searchField([s.title, s.excerpt, s.publisher].filter(Boolean).join(" "));
      return terms.every((term) => field.exact.has(term) || field.aliases.has(term));
    });
    if (!matches.length && !/\b(story|article|headline)\b/.test(command) && !describing) return;
    return {
      action,
      story: matches.length === 1 ? matches[0] : undefined,
      matches,
      subject: terms.join(" "),
    };
  }
  return { action, story: selected || (stories.length === 1 ? stories[0] : undefined) };
}

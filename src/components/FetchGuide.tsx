import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { counties, getCounty, getCountiesForState, type CountySite } from "../data/counties";
import { getStateBySlug, states, type StateSite } from "../data/states";
import { fetchDesks, type FetchDesk, type FetchIntent } from "../data/fetch-guide";
import {
  countyMatches,
  formalCountyReference,
  normalizeEditionQuestion,
  destinationName,
  editorialDesk,
  deskOptions,
  replyOption,
  type DeskOption,
  localIntent,
  namesCounty,
  requestedPlace,
  mentionedState,
} from "../lib/fetch-guide";
import {
  cityLabel,
  comparisonCities,
  findCityReference,
  qualifiedLocality,
  similarCityNames,
  narrowCounty,
  type CityArea,
  type CityReference,
} from "../lib/fetch-city";
import { getExactSearchState } from "../data/place-search";
import { editionOfVisibleHeadline } from "../lib/fetch-articles";
import { hasForecastDate, withoutForecastDates } from "../lib/fetch-weather";
import { lookupFollowup, withoutLocation } from "../lib/fetch-followup";
import { storyReference, type StoryAction } from "../lib/fetch-story-reference";
import { recordFetchOutcome } from "../lib/fetch-pilot";
import { siteCatalog, storiesFor, type ContentResult, type ContentLink, type FetchOutcome } from "../lib/fetch-content";
import { cityCrimeAnswer, crimeStatistic } from "../lib/fetch-city-crime";
import { FetchAnswer, ResultLinks, type AnswerRequest } from "./FetchAnswer";
import { tourLessons, tourTitles, type TourGuide } from "../data/fetch-lessons";
import { atlasTopic, publishedMeasureQuestion } from "../lib/fetch-atlas-topics";
import { comparisonQuestion, explicitStateList, type Comparison } from "../lib/fetch-state-comparison";
import { addCountiesToStateComparison, countyComparisonQuestion, type CountyComparison } from "../lib/fetch-county-comparison";
import { FetchCountyComparison } from "./FetchCountyComparison";
import { FetchStateComparison } from "./FetchStateComparison";
import { FetchDirectory } from "./FetchDirectory";
import collie from "../assets/fetch-collie.webp";
import running from "../../CPCollieRunning.gif";

import { placeCorrection, removalName } from "../lib/fetch-comparison-followup";
import { guideTo, pendingArrival } from "../lib/fetch-navigation";

import { FetchChatHistory, FetchSavedTurn, FetchTranscript } from "./FetchChatHistory";
import { captureAnswer, chatId, DeletedChatError, getChat, recentChats, saveTurn, type ChatSummary, type SavedChat, type ChatTurn } from "../lib/fetch-chats";
import { packContext, unpackContext, type HistoryFilters } from "../lib/fetch-chat-context";

type NavLink = { targetId?: string; label: string; to: string; external?: boolean };
export type FetchGuideProps = {
  county?: CountySite;
  state?: StateSite;
  linksFor: (county?: CountySite, region?: StateSite) => NavLink[];
};
type DeskTask = {
  desk: FetchDesk;
  teach: boolean;
  question: string;
  atlasChoice?: AnswerRequest["atlasChoice"];
};
type DeskResult =
  | { mode: "answer"; lookup: AnswerRequest }
  | { mode: "desk"; link: NavLink; desk: FetchDesk; edition?: string }
  | { mode: "message"; text: string };

type StoryEntry = { lookup: AnswerRequest; story: ContentLink; siblings: ContentLink[] };
type TourView = { mode: "tour"; guide: TourGuide; step: number };
export type FetchView =
  | { mode: "welcome" | "message"; text?: string }
  | { mode: "story"; lookup: AnswerRequest; stories: ContentLink[]; action: StoryAction; story?: ContentLink; choices?: ContentLink[] }
  | {
      mode: "options";
      question: string;
      place: string;
      county?: CountySite;
      scope?: StateSite | null;
      city?: CityReference;
      options: DeskOption[];
    }
  | { mode: "cities"; places: CityArea[]; task: DeskTask; spelling?: string }
  | { mode: "area"; area: CityArea; task: DeskTask; rows: DeskResult[]; storyChoices?: { action: StoryAction; entries: StoryEntry[] } }
  | { mode: "cityLocations"; choices: CityArea[][]; query: CountyComparison }
  | { mode: "cityCrime"; choices: CityArea[][]; question: string }
  | { mode: "browse" }
  | { mode: "compare"; query: Comparison }
  | { mode: "compareCounties"; query: CountyComparison }
  | TourView
  | { mode: "answer"; lookup: AnswerRequest }
  | {
      mode: "place";
      region?: StateSite;
      task: DeskTask;
      matches: CountySite[];
      text: string;
    }
  | { mode: "desk"; link: NavLink; desk: FetchDesk; edition?: string; explanation?: string };

type View = FetchView;
let privateSession = false;

export default function FetchGuide({
  county,
  state,
  linksFor,
  open,
  onClose, keepResults,
}: FetchGuideProps & { open: boolean; keepResults: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [savedCounty, setSavedCounty] = useState<CountySite | undefined>(() => {
    try {
      const fips = localStorage.getItem("fetch.preferredCounty");
      return fips ? counties.find((c) => c.fips === fips) : undefined;
    } catch {
      return undefined;
    }
  });
  const [saveStatus, setSaveStatus] = useState("");
  function rememberCounty(chosen?: CountySite) {
    try {
      if (chosen) localStorage.setItem("fetch.preferredCounty", chosen.fips);
      else localStorage.removeItem("fetch.preferredCounty");
      setSavedCounty(chosen);
      setSaveStatus(
        chosen
          ? `Saved ${chosen.displayName}, ${chosen.state.abbr} on this device.`
          : "Saved county cleared.",
      );
    } catch {
      setSaveStatus("This browser could not save your preference.");
    }
  }
  function countyPreference(chosen?: CountySite) {
    return (
      <div className="fetch-actions">
        {chosen && savedCounty !== chosen && (
          <button onClick={() => rememberCounty(chosen)}>
            Remember {chosen.displayName}, {chosen.state.abbr} on this device
          </button>
        )}
        {savedCounty && (
          <button onClick={() => rememberCounty()}>
            Forget {savedCounty.displayName}, {savedCounty.state.abbr}
          </button>
        )}
      </div>
    );
  }
  const panel = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const shown = useRef<{ lookup: AnswerRequest; stories: ContentLink[] } | null>(null);
  const expected = useRef<AnswerRequest | undefined>(undefined);
  const navigationRequest = useRef<AnswerRequest | undefined>(undefined);
  const narrowedCounty = useRef<CountySite | undefined>(undefined);
  const narrowedFrom = useRef<CityArea | undefined>(undefined);
  const areaResults = useRef(new Map<AnswerRequest, ContentResult>());
  const expectedArea = useRef<AnswerRequest[]>([]);
  const timing = useRef<{ started: number; route: "local" | "unrecognized" } | null>(null);
  const finish = useCallback((outcome: FetchOutcome) => {
    if (!timing.current) return;
    const { route, started } = timing.current;
    timing.current = null;
    recordFetchOutcome(outcome, route, started);
  }, []);
  const [view, updateView] = useState<View>({ mode: "welcome" });
  const [returnLesson, setReturnLesson] = useState<TourView>();
  const [pickerState, setPickerState] = useState("");
  useEffect(() => {
    if (!open) return;
    panel.current?.showModal();
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus({ preventScroll: true });
  }, [open]);
  const [query, setQuery] = useState("");
  const [lastQuestion, showQuestion] = useState("");
  const [historyPage, setHistoryPage] = useState<"list" | "transcript" | "loading">();
  const [transcript, setTranscript] = useState<SavedChat>();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [privateChat, setPrivateChat] = useState(() => {
    try {
      return sessionStorage.getItem("fetch.privateChat") === "true";
    } catch {
      return privateSession;
    }
  });
  const thread = useRef<string | undefined>(undefined);
  const turn = useRef<{ id: string; at: number; question: string } | undefined>(undefined);
  const liveContent = useRef<HTMLDivElement>(null);
  const written = useRef("");
  const historyRequest = useRef(0);
  const writeQueue = useRef(Promise.resolve());
  const refreshRequest = useRef<{ lookup: AnswerRequest; filters: HistoryFilters } | undefined>(undefined);
  const activeFilters = useRef<{ lookup: AnswerRequest; filters?: HistoryFilters } | undefined>(undefined);
  const [updatedFrom, setUpdatedFrom] = useState<ChatTurn>();
  const edition = county ? `${county.displayName}, ${county.state.abbr}` : state?.name || "National edition";

  function setLastQuestion(question: string) {
    ++historyRequest.current;
    setHistoryPage(undefined);
    setUpdatedFrom(undefined);
    turn.current = question ? { id: chatId(), at: Date.now(), question } : undefined;
    written.current = "";
    showQuestion(question);
  }
  const reloadChats = useCallback(async () => {
    await writeQueue.current;
    setChats(await recentChats());
  }, []);
  useEffect(() => {
    if (open && !privateChat)
      void reloadChats().catch(() => setHistoryStatus("Chat storage is unavailable in this browser."));
  }, [open, privateChat, reloadChats]);
  const persist = useCallback((entry: ChatTurn) => {
    const signature = JSON.stringify(entry);
    if (signature === written.current) return;
    written.current = signature;
    const create = !thread.current;
    const id = (thread.current ||= chatId());
    writeQueue.current = writeQueue.current
      .then(() => saveTurn(id, entry, create))
      .catch(error => {
        setHistoryStatus(error instanceof DeletedChatError ? "This chat was deleted in another tab. Choose Start over to save a new chat." : "This browser could not save your chat.");
        if (create && thread.current === id) thread.current = undefined;
        written.current = "";
      });
  }, []);
  const saveDestination = useCallback(
    (path: string, view: View, text: string, sources: ChatTurn["links"] = []) => {
      if (privateChat || !turn.current) return;
      persist({
        ...turn.current,
        edition,
        text,
        links: [...sources, { label: "Open destination", href: path }],
        context: packContext({
          view,
          stories:
            view.mode === "answer" && shown.current?.lookup === view.lookup ? shown.current.stories : [],
          areaStories: [],
        }),
      });
    },
    [edition, privateChat, persist],
  );
  const onResult = useCallback(
    (lookup: AnswerRequest, data: ContentResult, final: boolean, filters?: HistoryFilters) => {
      if (expectedArea.current.includes(lookup) || areaResults.current.has(lookup)) {
        areaResults.current.set(lookup, data);
        if (final) {
          expectedArea.current = expectedArea.current.filter((pending) => pending !== lookup);
          if (!expectedArea.current.length) {
            setThinking(false);
            const outcomes = [...areaResults.current.values()].map((r) => r.outcome || "answer");
            finish(outcomes.every((o) => o === outcomes[0]) ? outcomes[0] : "partial");
          }
        }
        return;
      }
      if (lookup !== expected.current) return;
      activeFilters.current = {
        lookup,
        filters: filters && { since: filters.since, earlier: filters.earlier },
      };
      shown.current = { lookup, stories: storiesFor(lookup, data) };
      if (final) {
        setThinking(false);
        const hasDestination =
          !data.outcome ||
          data.outcome === "answer" ||
          (data.outcome === "partial" && data.targetId && data.path?.endsWith("#" + data.targetId));
        if (
          panel.current?.open &&
          navigationRequest.current === lookup &&
          data.path &&
          hasDestination &&
          (data.quoteSymbols?.length || 0) <= 1 &&
          !data.links?.some((link) => link.url.startsWith("/"))
        ) {
          navigationRequest.current = undefined;
          finish("navigation");
          saveDestination(
            data.path,
            { mode: "answer", lookup },
            data.lines.join("\n"),
            (data.links || []).map((l) => ({ label: l.title, href: l.url })),
          );
          panel.current.close();
          onClose();
          guideTo(data.path, data.targetId);
          navigate(data.path);
          return;
        }
        finish(data.outcome || "answer");
      }
    },
    [finish, navigate, onClose, saveDestination],
  );
  useLayoutEffect(() => {
    const el = liveContent.current,
      entry = turn.current;
    if (!open || historyPage || privateChat || !el || !entry || view.mode === "welcome") return;
    function capture() {
      if (!el || !entry || turn.current !== entry) return;
      const context = packContext({
        view,
        stories:
          view.mode === "answer" && shown.current?.lookup === view.lookup
            ? shown.current.stories
            : view.mode === "story"
              ? view.stories
              : [],
        areaStories:
          view.mode === "area"
            ? view.rows.map((r) =>
                r.mode === "answer" ? storiesFor(r.lookup, areaResults.current.get(r.lookup)) : [],
              )
            : [],
        narrowedFrom: narrowedFrom.current,
        filters:
          view.mode === "answer" && activeFilters.current?.lookup === view.lookup
            ? activeFilters.current.filters
            : undefined,
      });
      persist({ ...entry, edition, ...captureAnswer(el), context });
    }
    capture();
    const observer = new MutationObserver(capture);
    observer.observe(el, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [open, historyPage, privateChat, view, lastQuestion, edition, persist]);
  function changePrivacy(value: boolean) {
    privateSession = value;
    setPrivateChat(value);
    try {
      sessionStorage.setItem("fetch.privateChat", String(value));
    } catch {
      /* Still private for this session. */
    }
  }
  function newChat(isPrivate: boolean) {
    thread.current = undefined;
    changePrivacy(isPrivate);
    setTranscript(undefined);
    setHistoryStatus("");
    setLastQuestion("");
    setReturnLesson(undefined);
    setQuery("");
    shown.current = null;
    setView({ mode: "welcome" });
    input.current?.focus();
  }
  async function openSaved(id: string) {
    setHistoryPage("loading");
    const request = ++historyRequest.current;
    try {
      await writeQueue.current;
      const chat = await getChat(id);
      if (request !== historyRequest.current) return;
      if (!chat) {
        await reloadChats();
        setHistoryPage("list");
        setHistoryStatus("This chat has been deleted.");
        return;
      }
      const last = chat.turns[chat.turns.length - 1];
      const context = unpackContext(last.context);
      thread.current = id;
      turn.current = undefined;
      written.current = "";
      setTranscript(chat);
      setHistoryPage("transcript");
      changePrivacy(false);
      setView(context.view);
      navigationRequest.current = undefined;
      setThinking(false);
      showQuestion(last.question);
      setQuery("");
      activeFilters.current =
        context.view.mode === "answer"
          ? { lookup: context.view.lookup, filters: context.filters }
          : undefined;
      shown.current = null;
      narrowedFrom.current = context.narrowedFrom;
      if (context.view.mode === "answer" || context.view.mode === "story") {
        shown.current = { lookup: context.view.lookup, stories: context.stories };
        narrowedCounty.current = context.narrowedFrom ? context.view.lookup.county : undefined;
      }
      if (context.view.mode === "area")
        context.view.rows.forEach((r, i) => {
          if (r.mode === "answer") {
            const links = context.areaStories[i] || [];
            areaResults.current.set(r.lookup, {
              lines: [],
              links,
              sections: [{ label: "Headlines", ordered: true, links }],
            });
          }
        });
    } catch {
      if(request!==historyRequest.current) return;
      setHistoryPage("list");
      setHistoryStatus("This chat could not be opened.");
    }
  }
  function showHistory() {
    ++historyRequest.current;
    navigationRequest.current = undefined;
    setHistoryPage("list");
    void reloadChats().catch(() => setHistoryStatus("Chat storage is unavailable in this browser."));
  }
  function refreshSaved() {
    if (!transcript) return;
    const previous = transcript.turns.at(-1)!;
    if (view.mode === "answer" || view.mode === "story") {
      const lookup = { ...view.lookup };
      beginTurn();
      setLastQuestion("Check for updates · " + lookup.question);
      setView({ mode: "answer", lookup });
      navigationRequest.current = undefined;
      refreshRequest.current = { lookup, filters: activeFilters.current?.filters || {} };
    } else if (view.mode === "welcome") ask(previous.question);
    else {
      beginTurn();
      setLastQuestion(previous.question);
      setView({ ...view });
    }
    setUpdatedFrom(previous);
  }
  const [thinking, setThinking] = useState(false);
  useEffect(() => {
    if (!open || !historyPage) return;
    panel.current?.querySelector<HTMLElement>(".fetch-history h3")?.focus({ preventScroll: true });
  }, [open, historyPage, transcript]);
  useEffect(()=>{
    if(open && updatedFrom && !historyPage) panel.current?.querySelector<HTMLElement>(".fetch-update-heading")?.focus();
  },[open,updatedFrom,historyPage]);
  const steps = tourLessons[view.mode === "tour" ? view.guide : "site"];
  const tutorial = view.mode === "tour" ? steps[view.step] : undefined;

  const needsCounty = tutorial?.countyOnly && !county;
  const lessonDestination = tutorial?.nav
    ? linksFor(county, state).find(link => link.label === (needsCounty ? "Find Your State & County News" : tutorial.nav))
    : undefined;

  useEffect(() => {
    if (open && tutorial && !historyPage)
      panel.current?.querySelector<HTMLElement>(".fetch-lesson-heading")?.focus({ preventScroll: true });
  }, [open, tutorial, historyPage]);

  useEffect(() => {
    if (!open || historyPage) return;
    let target: HTMLElement | undefined;
    if (tutorial?.selector) {
      target = Array.from(document.querySelectorAll<HTMLElement>(tutorial.selector)).find(el => el.getClientRects().length);
      if (!target && tutorial.mobile) target = document.querySelector<HTMLElement>(tutorial.mobile) || undefined;
    } else if (view.mode === "desk") {
      target = Array.from(document.querySelectorAll<HTMLAnchorElement>(".context-nav a, .nav a")).find(
        (a) => a.getAttribute("href") === view.link.to && a.getClientRects().length > 0,
      );
    }
    if (!target) return;
    target.classList.add("fetch-highlight");
    target.scrollIntoView({ block: "center", behavior: "instant" });
    return () => target.classList.remove("fetch-highlight");
  }, [open, view, tutorial, historyPage]);

  function beginTurn() {
    expected.current = undefined;
    navigationRequest.current = undefined;
    timing.current = { started: performance.now(), route: "local" };
  }

  function setView(next: View) {
    if (!(next.mode === "answer" || next.mode === "story" || next.mode === "options" || next.mode === "desk"))
      narrowedCounty.current = undefined;
    if (next.mode === "answer" && next.lookup.county !== narrowedCounty.current)
      narrowedCounty.current = undefined;
    if (next.mode !== "answer" || next.lookup.county !== narrowedCounty.current)
      narrowedFrom.current = undefined;
    if (next.mode === "place") setPickerState(next.region?.slug || state?.slug || "");
    expected.current = next.mode === "answer" ? next.lookup : undefined;
    navigationRequest.current =
      next.mode === "answer" &&
      (next.lookup.kind === "quotes" || next.lookup.kind === "weather") &&
      /^(?:please )?(?:take me to|open|go to|navigate to|bring me to)\b/i.test(next.lookup.question)
        ? next.lookup
        : undefined;
    expectedArea.current =
      next.mode === "area" ? next.rows.flatMap((r) => (r.mode === "answer" ? [r.lookup] : [])) : [];
    areaResults.current.clear();
    setThinking(next.mode === "answer" || expectedArea.current.length > 0);
    if (
      next.mode === "cityLocations" ||
      (next.mode === "cityCrime" && next.choices.some((options) => options.length > 1)) ||
      (next.mode === "compare" && (!next.query.metrics.length || !next.query.places.length)) ||
      (next.mode === "compareCounties" &&
        (!next.query.measure ||
          next.query.slots.some((s) => !s.county && !s.statewide) ||
          new Set(next.query.slots.map(s => s.county || s.statewide)).size < 2)) ||
      next.mode === "options" ||
      next.mode === "cities" ||
      next.mode === "place" ||
      (next.mode === "story" && !next.story)
    )
      finish("clarification");
    else if (next.mode === "cityCrime")
      finish(
        cityCrimeAnswer(
          next.choices.map((options) => options[0]),
          next.question,
        ).outcome || "answer",
      );
    else if (next.mode === "message") finish("empty");
    else if (next.mode !== "answer" && next.mode !== "compareCounties" && !expectedArea.current.length)
      finish("answer");
    const content = panel.current?.querySelector(".fetch-content");
    if (content && !(next.mode === view.mode && (view.mode === "compare" || view.mode === "compareCounties")))
      content.scrollTop = 0;
    updateView(next);
  }

  function respondToStory(
    lookup: AnswerRequest,
    stories: ContentLink[],
    action: StoryAction,
    story?: ContentLink,
    subject = "",
    choices?: ContentLink[],
  ) {
    if (story && action === "related") {
      setView({
        mode: "answer",
        lookup: { ...lookup, kind: "articles", question: subject || story.title, relatedUrl: story.url },
      });
      return;
    }
    if (story && action === "open" && /^https?:\/\//i.test(story.url)) {
      window.open(story.url, "_blank", "noopener,noreferrer");
      finish("navigation");
    }
    setView({ mode: "story", lookup, stories, action, story, choices });
  }

  function chooseStory(lookup: AnswerRequest, stories: ContentLink[], action: StoryAction, story?: ContentLink) {
    beginTurn();
    setLastQuestion(story?.title || "Choose a story");
    respondToStory(lookup, stories, action, story);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>(".fetch-story-heading")?.focus());
  }

  function close() {
    navigationRequest.current = undefined;
    if (view.mode === "area" && !pendingArrival) {
      expectedArea.current = view.rows.flatMap((r) => (r.mode === "answer" ? [r.lookup] : []));
      areaResults.current.clear();
    }
    setThinking(false);
    timing.current = null;
    panel.current?.close();
    onClose();
  }

  function go(link: NavLink) {
    finish("navigation");
    saveDestination(link.to, {mode:"message",text:"Opened " + link.label}, "Opened " + link.label);
    guideTo(link.to, link.targetId);
    close();
    navigate(link.to);
  }

  function selectDesk(
    desk: FetchDesk,
    destination: CountySite | undefined,
    teach: boolean,
    question?: string,
    scope: StateSite | null | undefined = state,
  ) {
    selectTask({ desk, teach, question: question || "" }, destination, scope);
  }

  function selectTask(
    task: DeskTask,
    destination?: CountySite,
    scope: StateSite | null | undefined = state,
    cityName?: string,
  ) {
    if (fetchDesks[task.desk].county && !destination) {
      setView({
        mode: "place",
        task,
        region: scope || undefined,
        matches: [],
        text: "Which county should I open? Enter a city or county and its state.",
      });
      return;
    }
    const result = deskResult(task, destination, scope, cityName);
    if (result.mode === "desk" && !task.teach) go(result.link);
    else setView(result);
  }

  function deskResult(
    { desk, teach, question, atlasChoice }: DeskTask,
    destination: CountySite | undefined,
    scope: StateSite | null | undefined = state,
    cityName?: string,
  ): DeskResult {
    const navigating =
      !question || /^(?:please )?(?:open|take me to|go to|navigate to|bring me to)\b/i.test(question);
    const editorial = desk === "catalog" && question ? editorialDesk(question) : undefined;
    if (editorial) {
      const editionBase = destination
        ? `/${destination.state.slug}/${destination.slug}`
        : scope
          ? "/" + scope.slug
          : "";
      return {
        mode: "desk",
        desk,
        link: {
          label: editorial.title,
          to: (editionBase || (editorial.path.startsWith("#") ? "/" : "/topics")) + editorial.path,
        },
      };
    }
    const topic = desk === "data" && destination && question ? atlasTopic(question) : undefined;
    if (topic && destination && navigating) {
      return {
        mode: "desk",
        desk,
        link: {
          label: "County Data",
          targetId: topic.metric ? "atlas-" + topic.metric : undefined,
          to: `/${destination.state.slug}/${destination.slug}/data/${topic.domain}`,
        },
      };
    }
    if (
      desk === "changes" || desk === "briefing" ||
      desk === "search" ||
      desk === "articles" ||
      desk === "gdp" ||
      desk === "catalog" ||
      desk === "videos" ||
      desk === "quotes" ||
      desk === "turnout" ||
      (desk === "weather" && !teach && hasForecastDate(question)) ||
      (!navigating &&
        !teach &&
        (desk === "weather" || desk === "notices" || desk === "sources" || desk === "data"))
    ) {
      return {
        mode: "answer",
        lookup: {
          kind: desk,
          cityName,
          atlasChoice,
          question: question || "",
          county: destination,
          state: destination?.state || scope || undefined,
        },
      };
    }
    const link = linksFor(destination, scope || undefined).find(
      (item) => !item.external && item.label === fetchDesks[desk].label,
    );
    if (!link)
      return { mode: "message", text: "That desk is unavailable in this edition. Try a different desk." };
    return { mode: "desk", desk, link, edition: destination?.displayName };
  }

  function selectCity(area: CityArea, task: DeskTask) {
    narrowedFrom.current = undefined;
    if (area.counties.length === 1) {
      const county = area.counties[0];
      narrowedCounty.current = county;
      if (task.desk === "edition" && /\b(?:what|which) count(?:y|ies)\b/i.test(task.question)) {
        const result = deskResult({ ...task, teach: true }, county, county.state);
        if (result.mode === "desk")
          setView({
            ...result,
            explanation: `${area.name}, ${county.state.name} is covered by the ${county.displayName} edition.`,
          });
        else setView(result);
        return;
      }
      selectTask(task, county, county.state, area.name);
      return;
    }
    const rows = area.counties.map((c) => deskResult(task, c, c.state));
    setView({ mode: "area", area, task, rows });
  }

  function focusCounty(county: CountySite, area: CityArea, task: DeskTask) {
    narrowedFrom.current = area;
    narrowedCounty.current = county;
    selectTask(task, county, county.state);
  }

  function routeCity(city: CityReference, task: DeskTask) {
    if (city.places.length === 1) selectCity(city.places[0], task);
    else setView({ mode: "cities", places: city.places, task });
  }

  function resolvePlace(place: string, task: DeskTask, earlier?: CountySite[], preferredState?: StateSite) {
    const scope = preferredState || county?.state || state;
    narrowedFrom.current = undefined;
    const region = !earlier?.length && getExactSearchState(place);
    if (region) {
      const members = getCountiesForState(region.slug);
      if (fetchDesks[task.desk].county && members.length === 1) selectTask(task, members[0], region);
      else selectTask(task, undefined, region);
      return;
    }
    if (!earlier?.length && !formalCountyReference(place)) {
      const city = findCityReference(place, scope);
      if (city && !city.subject.replace(/[^a-z0-9]/gi, "")) {
        routeCity(city, task);
        return;
      }
    }
    let matches = countyMatches(place, earlier?.length ? earlier : undefined);
    if (
      county &&
      county.state.slug === scope?.slug &&
      !earlier?.length &&
      matches.some((c) => c.fips === county.fips) &&
      [county.displayName, county.name, county.slug, county.fips].some(
        (name) => name.toLowerCase() === place.toLowerCase(),
      )
    ) {
      selectTask(task, county);
      return;
    }
    if (
      (preferredState || !county) &&
      scope &&
      !earlier?.length &&
      (matches.some((c) => c.displayName.toLowerCase() === place.toLowerCase()) || !mentionedState(place))
    ) {
      const inEdition = matches.filter((candidate) => candidate.state.slug === scope.slug);
      if (inEdition.length) matches = inEdition;
    }
    if (matches.length === 1) {
      // Partial and typo matches from the directory should be confirmed.
      const match = matches[0];
      if (namesCounty(place, match) || (earlier?.length && getExactSearchState(place))) {
        selectTask(task, match);
        return;
      }
    }
    const locality = !earlier?.length && qualifiedLocality(place);
    if (locality && !/\b(?:county|borough|parish)\b/i.test(locality.name)) {
      const suggestions = similarCityNames(locality.name, locality.state);
      if (suggestions.length && !matches.some((c) => namesCounty(place, c))) {
        setView({
          mode: "cities",
          spelling: locality.text,
          places: suggestions,
          task: { ...task, question: qualifiedLocality(task.question)?.subject || task.question },
        });
        return;
      }
    }
    setView({
      mode: "place",
      task,
      region: locality ? locality.state : undefined,
      matches: matches.length ? matches : earlier || [],
      text: /^\d{5}$/.test(place)
        ? "Enter the city and state for a ZIP code, or type FIPS before a county code."
        : !matches.length
          ? "I couldn’t match that place. Try a city or county name and its state."
          : matches.length === 1
            ? "Is this the county you meant?"
            : "Which county did you mean? Choose below or type the state to narrow it down.",
    });
  }

  function compareCityLocations(choices: CityArea[][], query: CountyComparison) {
    if (choices.some((options) => options.length > 1)) {
      setView({ mode: "cityLocations", choices, query });
      return;
    }
    const areas = [...new Set(choices.map((options) => options[0]))];
    setView({
      mode: "compareCounties",
      query: {
        ...query,
        guidance:
          areas
            .map(
              (area) => cityLabel(area) + " covers " + area.counties.map((c) => c.displayName).join(" and "),
            )
            .join(". ") +
          ". These figures cover whole counties. Choose a county where more than one is listed.",
        slots: areas.map((area) => ({
          state: area.counties[0].state,
          county: area.counties.length === 1 ? area.counties[0] : undefined,
          candidates: area.counties,
        })),
      },
    });
  }

  function ask(text: string) {
    const original = text.trim();
    if (!original) return;
    const question = normalizeEditionQuestion(original);
    setThinking(false);
    beginTurn();
    setLastQuestion(original);
    const namedTour = question.match(/^(?:please )?(?:learn how to use|how (?:do I|can I|to) use|help me use) (Fetch|(?:the )?County Post)[?!. ]*$/i);
    if (namedTour) {
      setQuery("");
      startTour(namedTour[1].toLowerCase() === "fetch" ? "fetch" : "site");
      return;
    }
    if (publishedMeasureQuestion(original)) {
      setQuery("");
      selectDesk("data", county || (view.mode === "answer" ? view.lookup.county : undefined), false, original);
      return;
    }
    if (/^(?:what(?:’s|'s| is| has)? (?:changed|new) )?since my last visit[?! .]*$/i.test(question)) {
      setQuery("");
      const previous = view.mode === "answer" || view.mode === "story" ? view.lookup.county : undefined;
      selectDesk("changes", previous || county || savedCounty, false, question);
      return;
    }
    if (/^(?:please )?(?:catch me up|give me my briefing)[.!?]*$/i.test(question)) {
      setQuery("");
      selectDesk("briefing", savedCounty || county, false, question);
      return;
    }
    setQuery("");
    if (
      view.mode === "answer" &&
      narrowedFrom.current &&
      /^(?:(?:show|include|see) (?:me )?)?(?:all|both)(?: (?:the|of the))? counties(?: again)?[.!?]*$/i.test(
        question,
      )
    ) {
      selectCity(narrowedFrom.current, {
        desk: view.lookup.kind,
        teach: false,
        question: view.lookup.question,
        atlasChoice: view.lookup.atlasChoice,
      });
      return;
    }
    if (view.mode === "answer" || view.mode === "story") {
      const prior = view.lookup;
      const correction = question.match(/^(?:no[, ]+)?(?:i meant|change (?:it|the place) to) (.+?)[.!?]*$/i);
      if ((correction || /^change place$/i.test(question)) && (prior.county || prior.state)) {
        const task = {desk: prior.kind, teach: false, question: withoutLocation(prior), atlasChoice: prior.atlasChoice};
        if (correction) {
          const name = correction[1].replace(/\s+in\s+/i, ", ");
          resolvePlace(formalCountyReference(name)?.place || name, task);
        } else setView({mode:"place", task, region:prior.state, matches:[], text:"Choose the state and county for this question."});
        return;
      }
    }
    if (view.mode === "area") {
      const chosen = narrowCounty(question, view.area);
      if (chosen) {
        focusCounty(chosen, view.area, view.task);
        return;
      }
      const entries = view.storyChoices?.entries || view.rows.flatMap((row) => {
        if (row.mode !== "answer") return [];
        const siblings = storiesFor(row.lookup, areaResults.current.get(row.lookup));
        return siblings.map((story) => ({ lookup: row.lookup, story, siblings }));
      });
      const match = entries.length
        ? storyReference(question, entries.map((entry) => entry.story), undefined, view.storyChoices?.action)
        : undefined;
      if (match) {
        // County lists number their own stories. Only the clarification list has a shared order.
        const sharedOrder = !!view.storyChoices || entries.every((entry) => entry.lookup === entries[0].lookup);
        const entry = (!match.positional || sharedOrder) && entries.find((e) => e.story === match.story);
        if (entry) respondToStory(entry.lookup, entry.siblings, match.action, entry.story, match.subject);
        else {
          const matches = match.matches;
          const choices = matches?.length ? entries.filter((e) => matches.includes(e.story)) : entries;
          updateView({ ...view, storyChoices: { action: match.action, entries: choices } });
          finish("clarification");
        }
        return;
      }
    }
    if (view.mode === "cities") {
      const region = view.spelling ? undefined : getExactSearchState(question);
      const replyCity = findCityReference(question);
      const places = view.places.filter(
        (p) =>
          p.counties[0].state.slug === region?.slug ||
          (replyCity && !replyCity.subject.replace(/[\s.,!?]/g, "") && replyCity.places.includes(p)),
      );
      if (places.length === 1) {
        selectCity(places[0], view.task);
        return;
      }
      if (!places.length && replyCity && !replyCity.subject.replace(/[\s.,!?]/g, "")) {
        if (replyCity.places.length === 1) selectCity(replyCity.places[0], view.task);
        else setView({ mode: "cities", places: replyCity.places, task: view.task });
        return;
      }
      if (places.length) {
        setView({ ...view, places });
        return;
      }
    }
    if (view.mode === "options") {
      const option = replyOption(question, view.options);
      if (option) {
        if (view.city) {
          routeCity(view.city, {
            desk: option.desk,
            teach: false,
            question: option.query || view.city.subject,
          });
          return;
        }
        routeDesk(option.desk, option.query || view.question, view.place, view.county, false, view.scope);
        return;
      }
    }
    if (
      /\b(browse (?:the )?(?:site|desks)|what (?:can i find|data do you have)|where (?:does|is) (?:the|all the) data|i(?:['’]m| am) lost|where (?:do i|should i) start|don['’]?t know (?:where|what)|help me (?:get started|find my way))\b/i.test(
        question,
      ) ||
      /^(help|help me|menu|browse)[?.!]*$/i.test(question)
    ) {
      setView({ mode: "browse" });
      return;
    }
    if (view.mode === "place" && view.matches.length && !localIntent(question)) {
      const candidate = view.matches.filter((c) => namesCounty(question, c));
      if (candidate.length === 1) {
        selectTask(view.task, candidate[0]);
        return;
      }
      if (candidate.length || getExactSearchState(question)) {
        resolvePlace(question, view.task, view.matches, getStateBySlug(pickerState) || state);
        return;
      }
    }
    const cityScope = county?.state || state;
    const namedStatesOnly = explicitStateList(question);
    const explicitCounty = formalCountyReference(question);
    const citiesCompared =
      !namedStatesOnly &&
      !/\b(?:count(?:y|ies)|parish|borough|FIPS|articles?|headlines?|news|stories)\b/i.test(question) &&
      !explicitCounty
        ? comparisonCities(question, cityScope)
        : undefined;
    const cityChoices = citiesCompared?.choices;
    if (view.mode === "compare" && placeCorrection(question)) {
      const revised = comparisonQuestion(question, view.query);
      if (revised) setView({ mode: "compare", query: revised });
      return;
    }
    const countyComparison = countyComparisonQuestion(
      question,
      view.mode === "compareCounties"
        ? view.query
        : view.mode === "compare"
          ? addCountiesToStateComparison(question, view.query)
          : undefined,
      county,
      state,
      view.mode === "area" ? { area: view.area, question: view.task.question } : undefined,
      view.mode === "answer" ? view.lookup : undefined,
    );
    const wantsCities =
      citiesCompared && (crimeStatistic(question) || /\b(?:cities|city of)\b/i.test(question));
    if (countyComparison && !wantsCities) {
      setView({ mode: "compareCounties", query: countyComparison });
      return;
    }
    const stateContext = county
      ? /\b(?:my|our|this) state\b/i.test(question)
        ? county.state
        : undefined
      : state;
    // A state-only addition belongs to the open state comparison even when the
    // place parser could interpret "Add Kansas" as a town named Add in Kansas.
    const addedState = /^(?:add|include|and|also compare) (.+?)[.!?]*$/i.exec(question);
    if (namedStatesOnly || (view.mode === "compare" &&
        (removalName(question) || (addedState && getExactSearchState(addedState[1]))))) {
      const comparison = comparisonQuestion(
        question,
        view.mode === "compare" ? view.query : undefined,
        stateContext,
      );
      if (comparison) {
        setView({ mode: "compare", query: comparison });
        return;
      }
    }
    if (localIntent(question) === "quotes") {
      selectDesk("quotes", county, false, question, state);
      return;
    }
    if (citiesCompared?.unmatched.length && (crimeStatistic(question) || citiesCompared.choices.length > 2)) {
      setView({
        mode: "message",
        text:
          "I couldn’t match every city in that comparison. Please repeat the list with the city and state for " +
          citiesCompared.unmatched.join(" and ") +
          ".",
      });
      return;
    }
    if (crimeStatistic(question) && !explicitCounty) {
      if (cityChoices?.every((options) => options.length)) {
        setView({ mode: "cityCrime", choices: cityChoices, question });
        return;
      }
      if (!/\b(?:county|counties|parish|state)\b/i.test(question)) {
        const single = findCityReference(question, cityScope);
        if ((single || cityChoices) && /\b(?:or|versus|vs|than|between|and)\s+(?=\p{L})/iu.test(question)) {
          setView({
            mode: "message",
            text: "I need both city names and their states for this comparison. Try “Compare crime rates in Amarillo, Texas and Lubbock, Texas.”",
          });
          return;
        }
        if (single) {
          setView({ mode: "cityCrime", choices: [single.places], question });
          return;
        }
      }
    }
    if (
      view.mode === "cityCrime" &&
      /^(?:and |what about |how about )?(?:in )?(?:(?:violent|property|index) crime(?: rates?)?|(?:19|20)\d{2})[?!.,]*$/i.test(
        question,
      )
    ) {
      const year = question.match(/\d{4}/)?.[0] || view.question.match(/\d{4}/)?.[0] || "";
      const metric = /crime/i.test(question) ? question : view.question.replace(/\b\d{4}\b/g, "");
      setView({ ...view, question: metric + " " + year });
      return;
    }
    if (cityChoices?.every((options) => options.length)) {
      const comparison = countyComparisonQuestion("Compare counties " + question);
      if (comparison?.measure) {
        compareCityLocations(cityChoices, comparison);
        return;
      }
    }
    const previous =
      view.mode === "answer" || view.mode === "story"
        ? view.lookup
        : view.mode === "area" && view.rows[0]?.mode === "answer"
          ? view.rows[0].lookup
          : undefined;
    const followup = previous && lookupFollowup(question, previous);
    if (previous && followup) {
      const task = {
        desk: previous.kind,
        teach: false,
        question: followup.question,
        atlasChoice: previous.atlasChoice,
      };
      if (followup.pageEdition) {
        narrowedFrom.current = undefined;
        selectTask(task, county, state);
      } else if (followup.place) {
        resolvePlace(followup.place, task, undefined, previous.state);
      } else if (view.mode === "area") {
        selectCity(view.area, task);
      } else {
        setView({
          mode: "answer",
          lookup: { ...previous, question: followup.question, relatedUrl: undefined },
        });
      }
      return;
    }
    const countyReference = explicitCounty;
    const cityLookupScope = view.mode === "place" ? getStateBySlug(pickerState) || state : cityScope;
    const city = countyReference ? undefined : findCityReference(question, cityLookupScope);
    const locality = !city && !countyReference ? qualifiedLocality(question) : undefined;
    const comparison =
      !city &&
      !countyReference &&
      !locality &&
      comparisonQuestion(
        question,
        view.mode === "compare" ? view.query : undefined,
        stateContext,
      );
    if (comparison) {
      setView({ mode: "compare", query: comparison });
      return;
    }
    const context =
      view.mode === "story"
        ? view
        : view.mode === "answer" && shown.current?.lookup === view.lookup
          ? shown.current
          : null;
    if (context?.stories.length) {
      const choices = view.mode === "story" && !view.story ? view.choices : undefined;
      const match = storyReference(
        question,
        choices || context.stories,
        view.mode === "story" ? view.story : undefined,
        view.mode === "story" && !view.story ? view.action : undefined,
      );
      if (match) {
        respondToStory(context.lookup, context.stories, match.action, match.story, match.subject,
          match.matches?.length ? match.matches : choices);
        return;
      }
    }
    const intent =
      localIntent(countyReference?.subject ?? city?.subject ?? question) ||
      (city && /\bwho (?:writes|reports|covers)\b/i.test(question) ? "sources" : undefined);
    if (intent === "tour") {
      startTour("site");
      return;
    }
    if (view.mode === "place" && !intent && city) {
      routeCity(city, view.task);
      return;
    }
    if (view.mode === "place" && !intent) {
      resolvePlace(
        countyReference?.place || question,
        view.task,
        view.matches,
        getStateBySlug(pickerState) || state,
      );
      return;
    }
    const pageScope = /\b(?:here|(?:my|this|our) (?:county|edition))\b/i.test(question);
    const teach = /\b(how (?:do i|can i|to)|where (?:do|can|could|would) i|show me how)\b/i.test(question);
    const areaContext =
      city ||
      (view.mode === "area" &&
      !pageScope &&
      (intent || /\b(?:there|that (?:city|area)|those counties)\b|^(?:and|what about)\b/i.test(question)) &&
      !mentionedState(question) &&
      !/\b(?:national|nationwide)\b/i.test(question) &&
      !requestedPlace(question)
        ? { places: [view.area], subject: question }
        : undefined);
    if (areaContext) {
      const options = deskOptions(areaContext.subject);
      if (options.length) {
        setView({ mode: "options", question, place: "", city: areaContext, options });
      } else {
        const editionRequest =
          !intent &&
          (!areaContext.subject.replace(/[\s,.?!]/g, "") ||
            /^(?:(?:open|find|visit|take me to|show me)\s*[.!?]?|(?:what|which) count(?:y|ies)\b.*)$/i.test(
              areaContext.subject,
            ));
        routeCity(areaContext, {
          desk: intent || (editionRequest ? "edition" : "search"),
          teach,
          question: areaContext.subject,
        });
      }
      return;
    }
    const siteSearch = question.match(
      /\bsearch (?:the |this )?(?:whole |entire )?(?:site|edition|paper) (?:for|about)\s+(.+)/i,
    );
    const place =
      countyReference?.place ||
      (locality
        ? locality.text
        : requestedPlace(
            siteSearch
              ? siteSearch[1]
              : intent === "articles"
                ? question.replace(
                    /\b(today|yesterday|this (?:week|morning|afternoon|evening))\b(?:['’]s)?/gi,
                    "",
                  )
                : intent === "weather" ? withoutForecastDates(question) : question,
          ));
    if (!place && !/^(?:open|take me to|go to|navigate to)\b/i.test(question)) {
      const region = county?.state || state;
      const current = county
        ? `counties/${county.state.slug}/${county.slug}`
        : region
          ? `states/${region.slug}`
          : "national";
      const edition = editionOfVisibleHeadline(question, current);
      if (edition) {
        const [level, stateSlug, countySlug] = edition.split("/");
        selectDesk(
          "articles",
          level === "counties" ? getCounty(stateSlug, countySlug) : undefined,
          false,
          question,
          level === "national" ? null : getStateBySlug(stateSlug),
        );
        return;
      }
    }
    if (
      /\b(?:find|change|choose|switch|pick)\s+(?:(?:a|my|another|the|your|different|to)\s+)*county\b/i.test(
        question,
      ) &&
      !place
    ) {
      selectDesk("edition", undefined, false);
      return;
    }
    if (!intent && question.split(/\s+/).length <= 12) {
      const name = destinationName(question);
      const namedLink = linksFor(county).find(
        (link) => !link.external && link.label.toLowerCase() === name.toLowerCase(),
      );
      if (namedLink) {
        go(namedLink);
        return;
      }
      const namedState = getExactSearchState(name);
      if (namedState) {
        go({ label: namedState.name, to: `/${namedState.slug}` });
        return;
      }
      if (/^[\p{L}\d ,.'-]+$/u.test(name) && name.length >= 3 && countyMatches(name).length) {
        resolvePlace(name, { desk: "edition", teach: false, question: "" });
        return;
      }
    }

    let selected: FetchIntent | undefined = intent;
    if (
      !selected &&
      siteCatalog(question, county, state).some(
        (hit) => hit.title.length > 3 && question.toLowerCase().includes(hit.title.toLowerCase()),
      )
    )
      selected = "catalog";
    const conversationEdition =
      !place && !pageScope && (view.mode === "answer" || view.mode === "story") ? view.lookup : undefined;
    const contextCounty = conversationEdition
      ? conversationEdition.county
      : pageScope
        ? county
        : narrowedCounty.current || county;
    const scope = conversationEdition ? conversationEdition.state || null : state;
    const options =
      !selected || selected === "data" || selected === "taxes" || selected === "catalog"
        ? deskOptions(question)
        : [];
    if (options.length) {
      setView({ mode: "options", question, place, county: contextCounty, scope, options });
      return;
    }
    if (
      !selected &&
      /^(?:(?:can|could) you )?(?:help me(?: with something(?: else)?)?|what (?:else )?can you do)[?.!]*$/i.test(
        question,
      )
    ) {
      setView({
        mode: "message",
        text: "What would you like to do? Choose a button or tell me a little more.",
      });
      return;
    }
    if (!selected) {
      if (timing.current) timing.current.route = "unrecognized";
      selected = "search";
    }
    routeDesk(selected, question, place, contextCounty, teach, scope);
  }

  function routeDesk(
    selected: FetchDesk,
    question: string,
    place: string,
    contextCounty: CountySite | undefined,
    offerLink: boolean,
    scope: StateSite | null | undefined = state,
  ) {
    const region = getExactSearchState(place) || (!place ? mentionedState(question) : undefined);
    if (
      !place &&
      (selected === "articles" || selected === "search") &&
      /\b(national|nationwide)\b/i.test(question)
    )
      selectDesk(selected, undefined, false, question, null);
    else if (region && !fetchDesks[selected].county)
      selectDesk(selected, undefined, offerLink, question, region);
    else if (place) resolvePlace(place, { desk: selected, teach: offerLink, question });
    else if (region && fetchDesks[selected].county)
      resolvePlace(region.name, { desk: selected, teach: offerLink, question });
    else selectDesk(selected, contextCounty, offerLink, question, scope);
  }

  function shortcut(label: string, action: () => void) {
    setThinking(false);
    setQuery("");
    setLastQuestion(label);
    action();
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
  }
  const crimeResult =
    view.mode === "cityCrime" && view.choices.every((options) => options.length === 1)
      ? cityCrimeAnswer(
          view.choices.map((options) => options[0]),
          view.question,
        )
      : undefined;
  function startTour(guide: TourGuide) {
    setReturnLesson(undefined);
    setView({ mode: "tour", guide, step: 0 });
  }
  const tourButtons = (
    <div className="fetch-actions fetch-tutorial-options">
      {(["site", "fetch"] as const).map(guide => (
        <button key={guide} onClick={() => shortcut(tourTitles[guide], () => startTour(guide))}>
          {tourTitles[guide]}
        </button>
      ))}
    </div>
  );
  const quickLinks = (
    <>
      <button onClick={() => ask("Catch me up")}>
        Catch me up
        {savedCounty && savedCounty !== county
          ? " · " + savedCounty.displayName + ", " + savedCounty.state.abbr
          : ""}
      </button>
      <button onClick={() => ask("Since my last visit")}>Since my last visit</button>
      <button onClick={() => ask("Show me local headlines")}>Read the news</button>
      <button onClick={() => ask("What’s the weather?")}>Check the weather</button>
      <button onClick={() => ask("Browse the site")}>Browse the site</button>
      <button onClick={() => ask("Compare counties")}>Compare counties</button>
      <button onClick={() => ask("Compare states")}>Compare states</button>
      <button onClick={() => shortcut("Find my county", () => selectDesk("edition", undefined, false))}>
        Find my county
      </button>
      <button onClick={() => shortcut("Public meetings", () => selectDesk("notices", county, false))}>
        Public meetings
      </button>
      {view.mode === "message" &&
        (["weather", "sources", "data", "classifieds", "newsletter", "submit"] as const).map((desk) => (
          <button
            key={desk}
            onClick={() => shortcut(fetchDesks[desk].label, () => selectDesk(desk, county, false))}
          >
            {fetchDesks[desk].label}
          </button>
        ))}
    </>
  );

  return (
    <>
      <dialog
        id="fetch-guide"
        className={`fetch-panel${tutorial?.selector === ".page-jump-toggle" && !historyPage ? " fetch-tour-top" : ""}`}
        ref={panel}
        aria-labelledby="fetch-title"
        onClickCapture={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
          const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
          if (link && (!link.target || link.target === "_self") && !link.hasAttribute("download"))
            guideTo(link.href, link.dataset.fetchTarget);
        }}
        onCancel={close}
        onClick={(event) => {
          if (event.target === panel.current) close();
        }}
      >
        <div className="fetch-inner">
          <header className="fetch-header">
            <picture>
              {thinking && <source media="(prefers-reduced-motion: no-preference)" srcSet={running} />}
              <img alt="" src={collie} />
            </picture>
            <div>
              <small>The County Post</small>
              <h2 id="fetch-title">Ask Fetch</h2>
            </div>
            <button className="fetch-close" onClick={close} aria-label="Close Fetch">
              ×
            </button>
          </header>
          <div className="fetch-edition">{edition}</div>
          <div className="fetch-chat-tools">
            <button onClick={showHistory}>Past chats</button>
            {!privateChat && !historyStatus && <small>Saved in this browser</small>}
            {historyPage && <button onClick={()=>newChat(false)}>New chat</button>}
            <button onClick={()=>newChat(!privateChat)}>{privateChat ? "End private chat" : "Private chat"}</button>
          </div>
          {privateChat && <small className="fetch-chat-notice">Private chat · history is off</small>}
          {historyStatus && <p className="fetch-chat-notice" role="status">{historyStatus}</p>}
          <div className="visually-hidden" role="status">
            {open &&
              view.mode === "area" &&
              (thinking
                ? `Checking ${view.area.counties.length} county editions for ${cityLabel(view.area)}.`
                : `Results for ${cityLabel(view.area)} are grouped under ${view.area.counties.length} county names. Choose a county or type its name to narrow your answer.`)}
          </div>
          {historyPage ? <div className="fetch-content">
            {historyPage==="loading" ? <p role="status">Opening your chat…</p> : historyPage==="list" ? <FetchChatHistory chats={chats} openChat={openSaved} reload={reloadChats}
              onDeleted={id=>{if(id===thread.current) {thread.current=undefined;turn.current=undefined;setTranscript(undefined);}}}/> :
              transcript && <FetchTranscript chat={transcript} refresh={refreshSaved} onNavigate={close}/>}
          </div> : <div className="fetch-content">
            {updatedFrom && <div className="fetch-history"><h3>Previous answer</h3><FetchSavedTurn turn={updatedFrom} onNavigate={close}/>
              <h3 className="fetch-update-heading" tabIndex={-1}>Updated answer</h3></div>}
            <div ref={liveContent}
            onChangeCapture={event=>{
              const el=event.target;
              if(el instanceof HTMLSelectElement && el.selectedOptions[0]) {
                const label=el.labels?.[0]?.firstChild?.textContent?.trim();
                setLastQuestion([label,el.selectedOptions[0].textContent].filter(Boolean).join(" · "));
              }
            }}
            onClickCapture={event=>{
              const choice=(event.target as Element).closest("button");
              if(choice && !choice.closest(".fetch-state-pickers") && choice.textContent?.trim())
                setLastQuestion(choice.textContent.trim());
            }}
            aria-live={view.mode === "area" ? "off" : "polite"}
            aria-atomic="false"
          >
            {lastQuestion && view.mode !== "tour" && <p className="fetch-question">{lastQuestion}</p>}

            {view.mode === "cities" && (
              <section>
                <h3>Which place did you mean?</h3>
                <p>
                  {view.spelling
                    ? `I couldn’t match “${view.spelling}” exactly. Choose a suggestion or enter another place.`
                    : "Choose a place or type its state."}
                </p>
                <div className="fetch-actions">
                  {view.places.map((p) => (
                    <button
                      key={p.counties.map((c) => c.fips).join("-")}
                      onClick={() => {
                        beginTurn();
                        selectCity(p, view.task);
                      }}
                    >
                      {cityLabel(p)}
                      {view.places.some((other) => other !== p && cityLabel(other) === cityLabel(p))
                        ? " · " + p.counties.map((c) => c.displayName).join(", ")
                        : ""}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {(open || keepResults) && view.mode === "area" && (
              <section className="fetch-area">
                <h3>{cityLabel(view.area)}</h3>
                <p>
                  {view.area.name} spans {view.area.counties.length} counties. Each result below covers its
                  whole county. You can type a county name at any time.
                </p>
                {view.storyChoices && (
                  <section>
                    <h4>Which story did you mean?</h4>
                    <ol className="fetch-story-choices">
                      {view.storyChoices.entries.map(({lookup, story, siblings}) => (
                        <li key={lookup.county?.fips + story.url}>
                          <button onClick={() => chooseStory(lookup, siblings, view.storyChoices!.action, story)}>
                            {story.title} · {lookup.county?.displayName}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                {view.rows.map((row, i) => {
                  const c = view.area.counties[i];
                  if (row.mode === "answer")
                    return (
                      <FetchAnswer
                        key={c.fips}
                        visible={open}
                        lookup={row.lookup}
                        onNavigate={close}
                        onResult={onResult}
                        onChooseStory={chooseStory}
                        onChoose={(choice) => {
                          beginTurn();
                          narrowedFrom.current = view.area;
                          narrowedCounty.current = c;
                          setView({
                            mode: "answer",
                            lookup: { ...row.lookup, kind: "data", atlasChoice: choice },
                          });
                        }}
                      />
                    );
                  return (
                    <section className="fetch-answer" key={c.fips}>
                      <small>
                        {c.displayName}, {c.state.abbr}
                      </small>
                      {row.mode === "desk" ? (
                        <div className="fetch-actions">
                          <button onClick={() => go(row.link)}>
                            Open {row.link.label} · {c.displayName}
                          </button>
                        </div>
                      ) : (
                        <p>{row.text}</p>
                      )}
                    </section>
                  );
                })}
                {(view.task.desk === "gdp" || view.task.desk === "data") && (
                  <div className="fetch-actions">
                    <button onClick={() => ask("Compare these counties")}>Compare these counties</button>
                  </div>
                )}
                <p>Show results for one county</p>
                <div className="fetch-actions" aria-label="Narrow to one county">
                  {view.area.counties.map((c) => (
                    <button
                      key={c.fips}
                      onClick={() => {
                        beginTurn();
                        focusCounty(c, view.area, view.task);
                      }}
                    >
                      {c.displayName}, {c.state.abbr}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {(open || keepResults) && view.mode === "answer" && (
              <FetchAnswer
                visible={open}
                lookup={view.lookup}
                refresh={refreshRequest.current?.lookup===view.lookup ? refreshRequest.current.filters : undefined}
                onNavigate={close}
                onResult={onResult}
                onChooseStory={chooseStory}
                onChoose={(choice) => {
                  beginTurn();
                  setLastQuestion(choice.label);
                  setView({
                    mode: "answer",
                    lookup: {
                      ...view.lookup,
                      kind: "data",
                      question: view.lookup.kind === "search" ? view.lookup.question : choice.label,
                      atlasChoice: choice,
                    },
                  });
                }}
              />
            )}
            {view.mode === "answer" &&
              (view.lookup.kind === "data" || view.lookup.kind === "gdp") &&
              view.lookup.county && (
                <div className="fetch-actions">
                  <button onClick={() => ask("Compare with another county")}>
                    Compare with another county
                  </button>
                </div>
              )}
            {(view.mode === "answer" || view.mode === "story") && (view.lookup.county || view.lookup.state) &&
              <div className="fetch-actions"><button onClick={() => ask("Change place")}>Change place</button></div>}
            {view.mode === "answer" && narrowedFrom.current && (
              <div className="fetch-actions">
                <button onClick={() => ask("Show all counties again")}>
                  Show all counties in {narrowedFrom.current.name}
                </button>
              </div>
            )}
            {((view.mode === "answer" && view.lookup.kind === "weather") ||
              (view.mode === "area" && view.task.desk === "weather" && view.rows[0]?.mode === "answer")) && (
              <div className="fetch-actions">
                <button onClick={() => ask("Today?")}>Today’s forecast</button>
                <button onClick={() => ask("Tomorrow?")}>Tomorrow’s forecast</button>
                <button onClick={() => ask("This weekend?")}>This weekend</button>
              </div>
            )}
            {view.mode === "answer" && view.lookup.kind === "search" && (
              <div className="fetch-actions">
                <button onClick={() => ask("Browse the site")}>Browse by subject</button>
              </div>
            )}
            {view.mode === "story" && (
              <section className="fetch-answer">
                <small>
                  {view.lookup.county
                    ? `${view.lookup.county.displayName}, ${view.lookup.county.state.abbr}`
                    : view.lookup.state?.name || "National edition"}
                </small>
                {view.story ? (
                  <>
                    <h3 className="fetch-story-heading" tabIndex={-1}>{view.story.title}</h3>
                    {view.action === "date" ? (
                      <p>{view.story.publicationDate ? `Published ${view.story.publicationDate}.` :
                        "The feed didn’t provide a publication date for this story."}</p>
                    ) : view.action === "publisher" ? (
                      <p>
                        {view.story.publisher
                          ? `Reported by ${view.story.publisher}.`
                          : "The feed didn’t identify a publisher."}
                      </p>
                    ) : (
                      <p>
                        {view.story.excerpt ||
                          "The feed provides the headline. The publisher has the full story."}
                      </p>
                    )}
                    <p><small>{view.action === "date" ? view.story.publisher : view.story.credit}</small></p>
                    <a href={view.story.url} target="_blank" rel="noreferrer">
                      Read the original story
                    </a>
                    {view.stories.length > 1 && (
                      <div className="fetch-actions">
                        <button onClick={() => chooseStory(view.lookup, view.stories, "detail")}>
                          Choose another story
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="fetch-story-heading" tabIndex={-1}>Which story did you mean?</h3>
                    <ol className="fetch-story-choices">
                      {(view.choices || view.stories).map((story) => (
                        <li key={story.url}>
                          <button
                            onClick={() => chooseStory(view.lookup, view.stories, view.action, story)}
                          >
                            {story.title}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </section>
            )}
            {view.mode === "browse" && (
              <FetchDirectory
                county={county}
                state={state}
                go={close}
                askDesk={(desk, question) => selectDesk(desk, county, false, question)}
                compare={(level) => ask("Compare " + level)}
              />
            )}
            {(view.mode === "cityCrime" || view.mode === "cityLocations") && (
              <section className="fetch-answer">
                <h3>{view.mode === "cityCrime" ? "City crime statistics" : "Choose the cities to compare"}</h3>
                {crimeResult ? (
                  <>
                    {crimeResult.lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {crimeResult.sections?.map((section) => (
                      <section key={section.label}>
                        <h4>{section.label}</h4>
                        {section.lines?.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                        <ResultLinks links={section.links} onNavigate={close} />
                      </section>
                    ))}
                    <ResultLinks links={crimeResult.links || []} onNavigate={close} />
                  </>
                ) : (
                  view.choices.map((options, index) =>
                    options.length === 1 ? (
                      <p key={index}>{cityLabel(options[0])}</p>
                    ) : (
                      <label key={index}>
                        Which {options[0].name}?
                        <select
                          value=""
                          onChange={(e) => {
                            const choices = view.choices.map((slot, i) => i === index ? [options[Number(e.target.value)]] : slot);
                            if (view.mode === "cityLocations") compareCityLocations(choices, view.query);
                            else setView({ ...view, choices });
                          }}
                        >
                          <option value="" disabled>
                            Choose the state and county
                          </option>
                          {options.map((area, i) => (
                            <option value={i} key={i}>
                              {cityLabel(area)} · {area.counties.map((c) => c.displayName).join(", ")}
                            </option>
                          ))}
                        </select>
                      </label>
                    ),
                  )
                )}
              </section>
            )}
            {(open || keepResults) && view.mode === "compareCounties" && (
              <FetchCountyComparison
                query={view.query}
                finish={finish}
                onNavigate={close}
                update={(query) => {
                  beginTurn();
                  setView({ mode: "compareCounties", query });
                }}
              />
            )}
            {view.mode === "compare" && (
              <FetchStateComparison
                query={view.query}
                update={(query) => {
                  beginTurn();
                  setView({ mode: "compare", query });
                }}
                onNavigate={close}
              />
            )}
            {view.mode === "welcome" && (
              <>
                <h3>What can I find for you?</h3>
                {tourButtons}
                {!privateChat && chats[0] && <div className="fetch-actions"><button onClick={()=>void openSaved(chats[0].id)}>Continue last chat</button></div>}
                <p>
                  {county
                    ? "Choose a button or type a few words, like “rain tomorrow” or “library news.” I’ll use this county unless you name another county or city."
                    : "Choose a button or type a few words. For a local answer, include the county and state, or give a city and state. For example, “What’s the weather in Potter County, Texas?”"}
                </p>
                <div className="fetch-actions">{quickLinks}</div>
                {countyPreference(county)}
              </>
            )}
            {view.mode === "answer" &&
              view.lookup.kind === "briefing" &&
              countyPreference(view.lookup.county)}
            {saveStatus &&
              (view.mode === "welcome" || (view.mode === "answer" && view.lookup.kind === "briefing")) && (
                <p role="status">{saveStatus}</p>
              )}
            {view.mode === "options" && (
              <section>
                <h3>What would you like to find?</h3>
                <div className="fetch-actions">
                  {view.options.map((o) => (
                    <button
                      key={o.desk}
                      onClick={() => {
                        beginTurn();
                        if (view.city) {
                          routeCity(view.city, {
                            desk: o.desk,
                            teach: false,
                            question: o.query || view.city.subject,
                          });
                          return;
                        }
                        routeDesk(
                          o.desk,
                          o.query || view.question,
                          view.place,
                          view.county,
                          false,
                          view.scope,
                        );
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {view.mode === "message" && (
              <>
                <p>{view.text}</p>
                {tourButtons}
                <div className="fetch-actions">{quickLinks}</div>
              </>
            )}
            {view.mode === "tour" && tutorial && (
              <>
                <small>
                  {tourTitles[view.guide]} · {view.step + 1} of {steps.length}
                </small>
                <h3 className="fetch-lesson-heading" tabIndex={-1}>{tutorial.title}</h3>
                <label className="fetch-lesson-picker" aria-live="off">
                  Jump to a lesson
                  <select
                    value={view.step}
                    onChange={(e) => setView({ ...view, step: Number(e.target.value) })}
                  >
                    {steps.map((step, i) => (
                      <option key={step.title} value={i}>
                        {i + 1}. {step.title}
                      </option>
                    ))}
                  </select>
                </label>
                <ol className="fetch-lesson-instructions">
                  {tutorial.instructions.map(line => <li key={line}>{line}</li>)}
                </ol>
                {tutorial.example && (
                  <div className="fetch-actions">
                    <button
                      onClick={() => {
                        setReturnLesson(view);
                        void ask(tutorial.example!);
                      }}
                    >
                      Try “{tutorial.example}”
                    </button>
                  </div>
                )}
                <div className="fetch-actions">
                  {lessonDestination && (lessonDestination.external ? (
                    <a href={lessonDestination.to} target="_blank" rel="noreferrer">{lessonDestination.label} (opens in a new tab)</a>
                  ) : (
                    <button onClick={() => go(lessonDestination)}>
                      {needsCounty ? "Choose a county for " + tutorial.nav : lessonDestination.to === "/states" ? "Open directory" : "Open " + lessonDestination.label}
                    </button>
                  ))}
                  {view.step > 0 && (
                    <button onClick={() => setView({ ...view, step: view.step - 1 })}>Previous</button>
                  )}
                  {view.step < steps.length - 1 && (
                    <button onClick={() => setView({ ...view, step: view.step + 1 })}>Next step</button>
                  )}
                  <button
                    onClick={() => {
                      setLastQuestion("");
                      setView({ mode: "welcome" });
                    }}
                  >
                    {view.step === steps.length - 1 ? "Finish tour" : "End tour"}
                  </button>
                </div>
              </>
            )}
            {view.mode === "place" && (
              <>
                <p>{view.text}</p>
                {!view.matches.length && (
                  <div className="fetch-state-pickers" aria-live="off">
                    <label>
                      State
                      <select value={pickerState} onChange={(e) => setPickerState(e.target.value)}>
                        <option value="">Choose a state</option>
                        {states.map((s) => (
                          <option key={s.slug} value={s.slug}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {pickerState && (
                      <label>
                        County
                        <select
                          value=""
                          onChange={(e) => {
                            const chosen = getCounty(pickerState, e.target.value);
                            if (chosen) {
                              beginTurn();
                              selectTask(view.task, chosen);
                            }
                          }}
                        >
                          <option value="">Choose a county</option>
                          {getCountiesForState(pickerState).map((c) => (
                            <option key={c.fips} value={c.slug}>
                              {c.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
                <div className="fetch-actions fetch-place-list">
                  {view.matches.map((match) => (
                    <button
                      key={match.fips}
                      onClick={() => {
                        beginTurn();
                        selectTask(view.task, match);
                      }}
                    >
                      {match.displayName}, {match.state.abbr}
                    </button>
                  ))}
                </div>
              </>
            )}
            {view.mode === "desk" && (
              <>
                <h3>{view.link.label}</h3>
                <p>
                  {view.explanation ||
                    `${fetchDesks[view.desk].help} Look for “${view.link.label}” in the navigation, or open it here.`}
                </p>
                <div className="fetch-actions">
                  <button onClick={() => go(view.link)}>
                    Open {view.link.label}
                    {view.edition ? ` · ${view.edition}` : ""}
                  </button>
                </div>
              </>
            )}
          </div></div>}
          {!historyPage && view.mode !== "welcome" && (
            <div className="fetch-actions fetch-reset">
              <button
                onClick={() => {
                  newChat(privateChat);
                }}
              >
                Start over
              </button>
              {returnLesson !== undefined && view.mode !== "tour" && (
                <button
                  onClick={() => {
                    setThinking(false);
                    setLastQuestion("");
                    setQuery("");
                    setView(returnLesson);
                    setReturnLesson(undefined);
                  }}
                >
                  Back to tour
                </button>
              )}
            </div>
          )}
          {(!historyPage || historyPage==="transcript") && <form
            className="fetch-form"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(query);
            }}
          >
            <input
              ref={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Ask Fetch a question"
              placeholder={
                view.mode === "place"
                  ? "City, county, or state…"
                  : county
                    ? "Ask about your edition…"
                    : "Ask about a city or county…"
              }
            />
            <button type="submit" disabled={!query.trim()}>
              Send
            </button>
          </form>}
        </div>
      </dialog>
    </>
  );
}

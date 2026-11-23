import { useLocation, useNavigationType } from "react-router-dom";
import { guideTo, pendingArrival } from "../lib/fetch-navigation";
import { recordCountyVisit } from "../lib/fetch-visits";
import { useCallback, useEffect, useRef, useState } from "react";
import type FetchGuide from "./FetchGuide";
import type { FetchGuideProps } from "./FetchGuide";
import collie from "../assets/fetch-collie.webp";
import "./FetchGuide.css";
import { FetchArrival } from "./FetchArrival";

export default function FetchLauncher(props: FetchGuideProps) {
  const location = useLocation();
  const navigation = useNavigationType();
  const [route, setRoute] = useState({
    key: location.key,
    session: location.key,
    arrival: undefined as typeof pendingArrival,
  });
  if (route.key !== location.key) {
    const arrival =
      navigation !== "POP" && pendingArrival?.url === window.location.href ? pendingArrival : undefined;
    setRoute({ key: location.key, session: arrival ? route.session : location.key, arrival });
  }
  useEffect(() => {
    recordCountyVisit(props.county?.fips);
  }, [props.county]);
  return <FetchSession key={route.session} {...props} arrival={route.arrival} />;
}

function FetchSession({
  arrival,
  ...props
}: FetchGuideProps & { arrival?: NonNullable<typeof pendingArrival> }) {
  const [replay, setReplay] = useState(0);
  const [fresh, setFresh] = useState(0);
  const [dismissed, setDismissed] = useState<typeof arrival>();
  const guided = !!arrival && dismissed !== arrival;
  const button = useRef<HTMLButtonElement>(null);
  const [Guide, setGuide] = useState<typeof FetchGuide>();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const close = useCallback(() => {
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  }, []);

  async function launch(restore = false) {
    if (guided && !restore) {
      if (arrival.originPath !== window.location.pathname) setFresh((n) => n + 1);
      setDismissed(arrival);
    }
    if (status === "loading") return;
    if (!Guide) {
      setStatus("loading");
      try {
        const module = await import("./FetchGuide");
        setGuide(() => module.default);
        setStatus("idle");
      } catch {
        setStatus("error");
        return;
      }
    }
    setOpen(true);
  }

  return (
    <>
      <FetchArrival replay={replay} />
      {guided && !open && (
        <div className="fetch-return-controls">
          <button
            onClick={() => {
              guideTo(arrival.url, arrival.target);
              setReplay((n) => n + 1);
            }}
          >
            Show me again
          </button>
          <button onClick={() => launch(true)}>Back to my results</button>
        </div>
      )}
      <button
        ref={button}
        className="fetch-launcher"
        type="button"
        aria-haspopup="dialog"
        aria-controls={Guide ? "fetch-guide" : undefined}
        aria-expanded={open}
        onClick={() => launch()}
      >
        <img src={collie} alt="" />
        {status === "loading" ? "Opening Fetch…" : status === "error" ? "Retry opening Fetch" : "Ask Fetch"}
      </button>
      {Guide && <Guide key={fresh} keepResults={guided} {...props} open={open} onClose={close} />}
    </>
  );
}

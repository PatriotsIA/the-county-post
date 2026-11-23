import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import running from "../../CPCollieRunning.gif";
import still from "../assets/fetch-collie.webp";

import { consumeArrival, pendingArrival } from "../lib/fetch-navigation";

export function FetchArrival({replay}: {replay: number}) {
  const location = useLocation();
  const navigation = useNavigationType();
  const marker = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const request = pendingArrival;
    const dog = marker.current;
    if (
      navigation === "POP" ||
      !request ||
      !dog ||
      request.url !== window.location.href ||
      Date.now() > request.expires
    )
      return;
    const arrival = request;
    const image = dog;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateDog = () => {
      image.src = motion.matches ? still : running;
    };
    const resize = new ResizeObserver(() => {
      if (target) position();
    });
    let target: HTMLElement | undefined;
    let addedTabIndex = false;
    let frame = 0,
      timer = 0,
      fallback = 0;
    const observer = new MutationObserver(schedule);
    function position() {
      if (!dog || !target) return;
      const box = target.getBoundingClientRect();
      const size = dog.offsetWidth;
      const height = dog.offsetHeight;
      const left =
        box.right + size + 8 < innerWidth
          ? box.right + 4
          : box.left > size + 8
            ? box.left - size - 4
            : Math.min(innerWidth - size - 6, box.right - size);
      const beside = left >= box.right || left + size <= box.left;
      dog.style.left = Math.max(4, left) + "px";
      dog.style.top = (beside ? box.top : Math.max(2, box.top - height - 4)) + "px";
      dog.style.visibility = box.bottom < 0 || box.top > innerHeight ? "hidden" : "visible";
    }
    function clear() {
      resize.disconnect();
      observer.disconnect();
      motion.removeEventListener("change", updateDog);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      clearTimeout(fallback);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
      window.removeEventListener("keydown", escape);
      target?.classList.remove("fetch-arrival-target");
      if (addedTabIndex) target?.removeAttribute("tabindex");
      image.hidden = true;
      image.removeAttribute("src");
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") clear();
    }
    function locate(allowFallback = false) {
      if (window.location.href !== arrival.url || pendingArrival !== arrival) return;
      let element = arrival.target ? document.getElementById(arrival.target) : null;
      if (element && !element.getClientRects().length) {
        element = Array.from(document.querySelectorAll<HTMLElement>("#" + CSS.escape(arrival.target)))
          .find(candidate => candidate.getClientRects().length) || null;
      }
      if (!element && (!arrival.target || allowFallback)) {
        element =
          (arrival.target.startsWith("market-") && document.getElementById("market-data-panel")) ||
          (arrival.target.startsWith("weather-period-") && document.getElementById("weather-forecast-heading")) ||
          (arrival.target.startsWith("weather-hour-") && document.getElementById("weather-hourly-heading")) ||
          document.querySelector<HTMLElement>("main h1:not(.visually-hidden)") ||
          document.getElementById("desk-general") ||
          document.querySelector<HTMLElement>("main h2, .masthead-hero h1");
      }
      if (!element?.getClientRects().length) return;
      target = element;
      consumeArrival();
      observer.disconnect();
      clearTimeout(fallback);
      target.querySelector<HTMLElement>(".feed-collapse-toggle[aria-expanded=false]")?.click();
      addedTabIndex = !target.hasAttribute("tabindex") && target.tabIndex < 0;
      if (addedTabIndex) target.tabIndex = -1;
      target.classList.add("fetch-arrival-target");
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        behavior: "instant",
        block: target.offsetHeight > innerHeight * 0.65 ? "start" : "center",
        inline: "nearest",
      });
      updateDog();
      image.hidden = false;
      motion.addEventListener("change", updateDog);
      resize.observe(target);
      resize.observe(document.body);
      position();
      window.addEventListener("scroll", position, true);
      window.addEventListener("resize", position);
      window.addEventListener("keydown", escape);
      timer = window.setTimeout(clear, 4800);
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => locate());
    }
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "open"],
    });
    schedule();
    fallback = window.setTimeout(() => {
      locate(true);
      if (!target) clear();
    }, 8000);
    return clear;
  }, [location.key, location.pathname, location.hash, navigation, replay]);
  return <img ref={marker} alt="" className="fetch-arrival-dog" hidden aria-hidden="true" />;
}

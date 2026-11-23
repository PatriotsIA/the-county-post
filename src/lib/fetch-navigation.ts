export let pendingArrival: { url: string; target: string; originPath: string; expires: number } | undefined;

// Kept only for this navigation. Reload, Back and copied links should open normally.
export function guideTo(to: string, targetId?: string) {
  const url = new URL(to, window.location.href);
  if (url.origin !== window.location.origin) return;
  const deskTarget = /\/weather$/.test(url.pathname)
    ? "current-weather-heading"
    : /\/data$/.test(url.pathname)
      ? "atlas-domain-heading"
      : /\/data\/[^/]+$/.test(url.pathname)
        ? "atlas-metrics-heading"
        : "";
  pendingArrival = {
    url: url.href,
    originPath: window.location.pathname,
    target: targetId || url.hash.slice(1) || deskTarget,
    expires: Date.now() + 16000,
  };
}

export function consumeArrival() {
  pendingArrival = undefined;
}

import { useEffect, useId, useState } from "react";
import type { CountySite } from "../data/counties";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

// Browsers never tell a page whether it is bookmarked, so the reminder is
// remembered on this device instead: once closed, or once the bookmark
// shortcut is used, it does not return on its own for that edition.
function wasDismissed(key: string) {
  try { return window.localStorage.getItem(key) === "true"; } catch { return false; }
}

function rememberDismissal(key: string) {
  try { window.localStorage.setItem(key, "true"); } catch { /* Closing still works when storage is blocked. */ }
}

export function BookmarkPrompt({ county, autoShow }: { county?: CountySite; autoShow: boolean }) {
  const editionPath = county ? `/${county.state.slug}/${county.slug}` : "/";
  const storageKey = `county-post:bookmark-dismissed:${editionPath}`;
  const headingId = useId();
  const [visible, setVisible] = useState(false);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMac = !isIOS && /Mac/i.test(navigator.platform);
  const pageName = county ? county.displayName : "The County Post";

  useEffect(() => {
    setVisible(autoShow && !wasDismissed(storageKey) && !isStandalone());
  }, [autoShow, storageKey]);

  useEffect(() => {
    if (!autoShow) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "d" || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      rememberDismissal(storageKey);
      setVisible(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [autoShow, storageKey]);

  function dismiss() {
    rememberDismissal(storageKey);
    setVisible(false);
  }

  return (
    <>
      <button type="button" className="save-site-link" onClick={() => setVisible(true)}>
        Bookmark / Add web app
      </button>
      {visible ? (
        <aside className="bookmark-toast" aria-labelledby={headingId} onKeyDown={(event) => {
          if (event.key === "Escape") dismiss();
        }}>
          <button className="bookmark-toast-close" type="button" onClick={dismiss} aria-label="Dismiss bookmark reminder">×</button>
          <p className="kicker">Keep The County Post handy</p>
          <h2 id={headingId}>Bookmark {pageName}</h2>
          <p>{county ? "Save your county for quick access to local news, weather, and updates." : "Save the nationwide homepage for news from across America."}</p>
          <div className="bookmark-toast-instructions">
            {!autoShow ? (
              <p><a href={editionPath}>Open {county ? `the ${county.displayName} homepage` : "the nationwide homepage"}</a> first, then:</p>
            ) : null}
            {isIOS ? (
              <>
                <p><strong>Bookmark:</strong> Tap Share (the square with an upward arrow), then <strong>Add Bookmark</strong>.</p>
                <p><strong>Home Screen:</strong> Tap Share, then <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</p>
              </>
            ) : isAndroid ? (
              <>
                <p><strong>Bookmark:</strong> Open the browser menu (three dots) and tap the star.</p>
                <p><strong>Home screen:</strong> Open the browser menu, then tap <strong>Add to Home screen</strong>.</p>
              </>
            ) : (
              <p>Press <strong>{isMac ? "Cmd+D" : "Ctrl+D"}</strong>, or select the star in your browser's address bar.</p>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}

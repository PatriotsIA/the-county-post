import { useEffect, useId, useState } from "react";
import type { CountySite } from "../data/counties";

type InstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function wasDismissed(key: string) {
  try { return window.sessionStorage.getItem(key) === "true"; } catch { return false; }
}

export function BookmarkPrompt({ county, autoShow }: { county?: CountySite; autoShow: boolean }) {
  const editionPath = county ? `/${county.state.slug}/${county.slug}` : "/";
  const storageKey = `county-post:bookmark-dismissed:${editionPath}`;
  const headingId = useId();
  const instructionsId = useId();
  const [visible, setVisible] = useState(false);
  const [instructions, setInstructions] = useState<"bookmark" | "ios" | "android" | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState("");
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);

  useEffect(() => {
    setVisible(autoShow && !wasDismissed(storageKey) && !isStandalone());
    setInstructions(null);
    setStatus("");
  }, [autoShow, storageKey]);

  // This component stays mounted in the shell, so the one-use browser prompt
  // survives navigation between national, state, and county editions.
  useEffect(() => {
    const onPrompt = (event: Event) => {
      if (!("prompt" in event) || typeof event.prompt !== "function") return;
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setInstructions(null);
      setStatus("The County Post web app has been added.");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try { window.sessionStorage.setItem(storageKey, "true"); } catch { /* Closing still works when storage is blocked. */ }
    setVisible(false);
  }

  async function addWebApp() {
    setStatus("");
    if (!isAndroid || !installPrompt) {
      setInstructions(isIOS ? "ios" : "android");
      return;
    }
    const prompt = installPrompt;
    setInstallPrompt(null);
    setInstalling(true);
    try {
      const result = await prompt.prompt();
      if (result.outcome === "accepted") {
        setInstalled(true);
        setInstructions(null);
        setStatus("Installation requested. Look for County Post on your Home Screen or in your apps.");
      } else {
        setStatus("Installation canceled. You can add the app later from your browser menu.");
      }
    } catch {
      setInstructions(isIOS ? "ios" : "android");
      setStatus("Use your browser menu to add the web app.");
    } finally {
      setInstalling(false);
    }
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
          <h2 id={headingId}>{county ? `Bookmark ${county.displayName}` : "Bookmark The County Post"}</h2>
          <p>{county ? "Save your county for quick access to local news, weather, and updates." : "Save the nationwide homepage for news from across America."}</p>
          <div className="bookmark-toast-actions">
            <button type="button" aria-controls={instructionsId} onClick={() => {
              setStatus("");
              setInstructions("bookmark");
            }}>{county ? "Bookmark this county" : "Bookmark nationwide homepage"}</button>
            <button type="button" className="bookmark-toast-later" onClick={dismiss}>Not now</button>
          </div>
          {!installed ? (
            <div className="bookmark-install">
              <h3>Add Our Web App To Your Phone</h3>
              <div className="bookmark-toast-actions">
                {!isAndroid ? (
                  <button type="button" aria-controls={instructionsId} onClick={() => {
                    setStatus("");
                    setInstructions("ios");
                  }}>Add to iPhone / iPad Home Screen</button>
                ) : null}
                {!isIOS ? (
                  <button type="button" disabled={installing} aria-controls={instructionsId} onClick={addWebApp}>
                    {installing ? "Opening install prompt…" : "Add to Android Home Screen"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : <p className="bookmark-installed">County Post is installed on this device.</p>}
          <div id={instructionsId} className="bookmark-toast-instructions" aria-live="polite">
            {status ? <p role="status">{status}</p> : null}
            {instructions === "bookmark" ? (
              <>
                <p><strong>Desktop:</strong> Press Ctrl+D on Windows/Linux or Cmd+D on Mac.</p>
                <p><strong>iPhone/iPad:</strong> Tap Share, then Add Bookmark. <strong>Android:</strong> Open the browser menu and tap the star or Bookmark.</p>
                <a href={editionPath}>Open {county ? `${county.displayName} homepage` : "the nationwide homepage"} to save it</a>
              </>
            ) : null}
            {instructions === "ios" ? (
              <>
                <p><strong>On your iPhone or iPad:</strong></p>
                <ol>
                  <li>Open The County Post in Safari and tap Share (the square with an upward arrow). You may need to open the More menu first.</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                  <li>Keep <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li>
                </ol>
              </>
            ) : null}
            {instructions === "android" ? (
              <>
                <p><strong>On your Android phone:</strong></p>
                <ol>
                  <li>Open The County Post in Chrome.</li>
                  <li>Tap the three-dot menu, then <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li>
                  <li>Tap <strong>Install</strong> or <strong>Add</strong> to confirm.</li>
                </ol>
              </>
            ) : null}
          </div>
        </aside>
      ) : null}
    </>
  );
}

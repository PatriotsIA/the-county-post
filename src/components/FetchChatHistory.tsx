import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import {
  backupChats,
  deleteChat,
  restoreBackup,
  type ChatSummary,
  type SavedChat,
  type ChatTurn,
} from "../lib/fetch-chats";

export function FetchChatHistory({
  chats,
  openChat,
  reload,
  onDeleted,
}: {
  chats: ChatSummary[];
  openChat: (id: string) => void;
  reload: () => Promise<void>;
  onDeleted: (id: string) => void;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  async function backup() {
    setBusy(true);
    try {
      const content = await backupChats();
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "county-post-fetch-chats-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus("Backup ready. Keep the file somewhere you trust.");
    } catch {
      setStatus("The backup could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function restore(selected: File) {
    setBusy(true);
    try {
      await restoreBackup(selected);
      await reload();
      setStatus("Chats restored. Existing conversations are kept.");
    } catch {
      setStatus("Could not restore this backup. Choose a Fetch backup file and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteChat(id);
      onDeleted(id);
      await reload();
      setConfirm(undefined);
      setStatus("Chat deleted from this browser.");
    } catch {
      setStatus("Could not delete this chat. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="fetch-history">
      <h3 tabIndex={-1}>Past chats</h3>
      <p>Saved in this browser. Anyone using this browser profile can read them.</p>
      {chats.length ? (
        <ul>
          {chats.map((c) => (
            <li key={c.id}>
              <button onClick={() => openChat(c.id)}>{c.title}</button>
              <small>{new Date(c.updated).toLocaleString()}</small>
              {confirm === c.id ? (
                <div className="fetch-actions">
                  <button disabled={busy} onClick={() => void remove(c.id)}>
                    Confirm deletion
                  </button>
                  <button onClick={() => setConfirm(undefined)}>Cancel</button>
                </div>
              ) : (
                <button aria-label={"Delete chat · " + c.title} onClick={() => setConfirm(c.id)}>
                  Delete chat
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No saved chats yet.</p>
      )}
      <p>
        Save a backup to keep your chats when clearing browser data or moving to another device. The file
        contains your conversations.
      </p>
      <div className="fetch-actions">
        <button disabled={busy || !chats.length} onClick={() => void backup()}>
          Save a backup
        </button>
        <button disabled={busy} onClick={() => file.current?.click()}>
          Restore chats
        </button>
      </div>
      <input
        type="file"
        ref={file}
        hidden
        aria-label="Fetch backup file"
        accept=".json,application/json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void restore(f);
        }}
      />
      <p role="status">{status}</p>
    </section>
  );
}
export function FetchSavedTurn({ turn: t, onNavigate }: { turn: ChatTurn; onNavigate: () => void }) {
  return (
    <section>
      <p className="fetch-question">{t.question}</p>
      <small>
        {t.edition} · {new Date(t.at).toLocaleString()}
      </small>
      <p className="fetch-saved-answer">{t.text || "The lookup was still in progress."}</p>
      {!!t.links.length && (
        <ul>
          {t.links.map((l, i) => (
            <li key={i}>
              {l.href.startsWith("/") ? (
                <Link to={l.href} data-fetch-target={l.targetId} onClick={onNavigate}>
                  {l.label}
                </Link>
              ) : (
                <a href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function FetchTranscript({
  chat,
  refresh,
  onNavigate,
}: {
  chat: SavedChat;
  refresh: () => void;
  onNavigate: () => void;
}) {
  return (
    <section className="fetch-history">
      <h3 tabIndex={-1}>{chat.title}</h3>
      {chat.turns.map((t) => (
        <FetchSavedTurn key={t.id} turn={t} onNavigate={onNavigate} />
      ))}
      <div className="fetch-actions">
        <button onClick={refresh}>Check for updates</button>
      </div>
    </section>
  );
}

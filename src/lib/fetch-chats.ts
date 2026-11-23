import { integer, invalid, list, record, safeLink, string, unpackContext } from "./fetch-chat-context";

export type ChatLink = { label: string; href: string; targetId?: string };
export type ChatTurn = {
  id: string;
  at: number;
  question: string;
  edition: string;
  text: string;
  links: ChatLink[];
  context: string;
};
export type SavedChat = { id: string; title: string; updated: number; turns: ChatTurn[] };
export type ChatSummary = Pick<SavedChat, "id" | "title" | "updated">;
// Local phone previews may use HTTP, where randomUUID is unavailable.
export function chatId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
let connection: Promise<IDBDatabase> | undefined;
function database() {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("county-post-fetch-chats", 2);
      req.onupgradeneeded = () => {
        const store = req.result.objectStoreNames.contains("chats")
          ? req.transaction!.objectStore("chats")
          : req.result.createObjectStore("chats", { keyPath: "id" });
        store.createIndex("recent", ["updated", "title", "id"]);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    }).catch((error) => {
      connection = undefined;
      throw error;
    });
  }
  return connection;
}
async function readWrite(work: (store: IDBObjectStore) => void) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("chats", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("Chat storage unavailable"));
    work(tx.objectStore("chats"));
  });
}
async function read<T>(request: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = request(db.transaction("chats").objectStore("chats"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export const getChat = (id: string): Promise<SavedChat | undefined> => read((s) => s.get(id));
const allChats = (): Promise<SavedChat[]> => read((s) => s.getAll());
export async function recentChats(): Promise<ChatSummary[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const rows: ChatSummary[] = [];
    const req = db.transaction("chats").objectStore("chats").index("recent").openKeyCursor(null, "prev");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(rows);
        return;
      }
      const [updated, title, id] = cursor.key as [number, string, string];
      rows.push({ id, title, updated });
      cursor.continue();
    };
  });
}
export class DeletedChatError extends Error {}

export async function saveTurn(id: string, turn: ChatTurn, create: boolean) {
  let deleted = false;
  await readWrite((store) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const chat: SavedChat | undefined =
        req.result ||
        (create ? { id, title: turn.question.slice(0, 100), updated: turn.at, turns: [] } : undefined);
      if (!chat) {
        deleted = true;
        return;
      } // A reader deleted this chat in another tab.
      const i = chat.turns.findIndex((t) => t.id === turn.id);
      if (i < 0) chat.turns.push(turn);
      else chat.turns[i] = turn;
      chat.turns.sort((a, b) => a.at - b.at);
      chat.updated = Math.max(chat.updated, turn.at);
      store.put(chat);
    };
  });
  if (deleted) throw new DeletedChatError();
}
export const deleteChat = (id: string) =>
  readWrite((store) => {
    store.delete(id);
  });
export async function backupChats() {
  return JSON.stringify({ format: "county-post-fetch", version: 1, chats: await allChats() });
}
function id(value: unknown) {
  const s = string(value);
  return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(s) ? s : invalid();
}
function timestamp(v: unknown) {
  const n = integer(v);
  return Number.isFinite(new Date(n).getTime()) ? n : invalid();
}
function decodeChat(v: unknown): SavedChat {
  const c = record(v);
  const turns = list((v) => {
    const t = record(v),
      context = string(t.context);
    unpackContext(context);
    return {
      id: id(t.id),
      at: timestamp(t.at),
      edition: string(t.edition),
      question: string(t.question),
      text: string(t.text),
      links: list((v) => {
        const l = record(v);
        return {
          label: string(l.label),
          href: safeLink(l.href),
          targetId: l.targetId === undefined ? undefined : string(l.targetId),
        };
      })(t.links),
      context,
    };
  })(c.turns);
  if (!turns.length || new Set(turns.map((t) => t.id)).size !== turns.length) return invalid();
  turns.sort((a, b) => a.at - b.at);
  return { id: id(c.id), title: string(c.title), updated: turns[turns.length - 1].at, turns };
}
export async function restoreBackup(file: File) {
  const data = record(JSON.parse(await file.text()));
  if (data.format !== "county-post-fetch" || data.version !== 1) return invalid();
  const chats = list(decodeChat)(data.chats);
  if (new Set(chats.map((c) => c.id)).size !== chats.length) return invalid();
  await readWrite((store) => {
    for (const chat of chats) {
      const req = store.get(chat.id);
      req.onsuccess = () => {
        const current: SavedChat | undefined = req.result;
        if (!current) {
          store.add(chat);
          return;
        }
        const seen = new Set(current.turns.map((t) => t.id));
        for (const turn of chat.turns) if (!seen.has(turn.id)) current.turns.push(turn);
        current.turns.sort((a, b) => a.at - b.at);
        current.updated = Math.max(current.updated, chat.updated);
        store.put(current);
      };
    }
  });
}

// Keep the reader-visible text and source destinations. Never archive executable markup,
// the directory's thousands of picker options, or the contents of third-party frames.
export function captureAnswer(container: HTMLElement) {
  const lines: string[] = [];
  const links: ChatLink[] = [];
  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      lines.push(node.textContent || "");
      return;
    }
    if (
      !(node instanceof HTMLElement) ||
      node.hidden ||
      node.matches(
        "script,style,svg,select,input,.fetch-question,.fetch-state-pickers,.visually-hidden,[aria-hidden=true]",
      )
    )
      return;
    if (node instanceof HTMLAnchorElement) {
      const label = node.textContent?.trim(),
        href = node.getAttribute("href");
      if (label && href) {
        try {
          links.push({ label, href: safeLink(href), targetId: node.dataset.fetchTarget });
        } catch {
          /* Skip unsupported links. */
        }
      }
    }
    if (node.matches("iframe")) {
      lines.push("\nLive provider display · check for updates to reopen it.\n");
      return;
    }
    const block = node.matches("h2,h3,h4,h5,p,li,dt,dd,small,div,section,tr,button,br,label");
    if (block) lines.push("\n");
    if (node.matches("td,th")) lines.push("  ");
    for (const child of node.childNodes) visit(child);
    if (block) lines.push("\n");
    else if (node instanceof HTMLAnchorElement) lines.push(" ");
  }
  for (const child of container.childNodes) visit(child);
  return {
    text: lines
      .join("")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n"),
    links,
  };
}

import { DeckSchema, type Deck } from "./slide-schema";

const DB_NAME = "ppty";
const DB_VERSION = 1;
const STORE_NAME = "deckHandoff";
const PREVIEW_DECK_ID = "generatedDeck";
const SESSION_KEY = "ppty:generatedDeck";

export async function savePreviewDeck(deck: Deck): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const db = await openDeckDb();
    try {
      await putStoredValue(db, PREVIEW_DECK_ID, deck);
    } finally {
      db.close();
    }
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Best-effort cleanup only.
    }
    return;
  } catch {
    // Fall back to the old handoff for environments where IndexedDB is
    // unavailable. Small generated decks still work this way.
  }

  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(deck));
  } catch {
    throw new Error(
      "Browser storage is full or unavailable, so the deck could not be opened for preview.",
    );
  }
}

export async function readPreviewDeck(): Promise<Deck | null> {
  if (typeof window === "undefined") return null;

  try {
    const db = await openDeckDb();
    try {
      const stored = await getStoredValue(db, PREVIEW_DECK_ID);
      const deck = parseStoredDeck(stored);
      if (deck) return deck;
    } finally {
      db.close();
    }
  } catch {
    // Fall through to sessionStorage compatibility path.
  }

  try {
    return parseStoredDeck(window.sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function openDeckDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const indexedDBRef = window.indexedDB;
    if (!indexedDBRef) {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }

    const request = indexedDBRef.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open deck storage."));
  });
}

function putStoredValue(
  db: IDBDatabase,
  key: IDBValidKey,
  value: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("Failed to write deck storage."));
    tx.onabort = () =>
      reject(tx.error ?? new Error("Deck storage write was aborted."));

    try {
      tx.objectStore(STORE_NAME).put(value, key);
    } catch (error) {
      reject(error);
    }
  });
}

function getStoredValue(
  db: IDBDatabase,
  key: IDBValidKey,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to read deck storage."));
    tx.onerror = () =>
      reject(tx.error ?? new Error("Failed to read deck storage."));
  });
}

function parseStoredDeck(value: unknown): Deck | null {
  const raw = typeof value === "string" ? safeJsonParse(value) : value;
  const parsed = DeckSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

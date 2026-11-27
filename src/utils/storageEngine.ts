import {
  CategoryConfig,
  ChecklistItem,
  JournalEntry,
  MoodId,
  SavedImage,
  SavedLink,
} from '../types/journal';
import { STORAGE_KEYS } from './journalUtils';

export interface EntryDraft {
  date: string;
  title: string;
  categoryIds: string[];
  links: SavedLink[];
  images: SavedImage[];
  checklist: ChecklistItem[];
  takeaways: string;
  mood: MoodId;
  isHighlighted: boolean;
  durationMinutes: string;
  updatedAt: string;
}

export interface PersistedSnapshot {
  entries: JournalEntry[];
  trash: JournalEntry[];
  categories: CategoryConfig[];
  savedAt: number;
}

export interface SaveResult {
  ok: boolean;
  usedIndexedDb: boolean;
  usedLocalStorage: boolean;
  quotaTrimmedLocal: boolean;
  savedAt: number;
}

const DB_NAME = 'dayleaf_journal_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const SNAPSHOT_KEY = 'journal_snapshot_v1';
const DRAFT_KEY = 'dayleaf_draft_v1';
const META_SAVED_AT_KEY = 'dayleaf_saved_at_v1';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

async function idbSet<T>(key: string, value: T): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function getLocalSavedAt(): number {
  try {
    const raw = localStorage.getItem(META_SAVED_AT_KEY);
    if (!raw) return 0;
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  } catch {
    return 0;
  }
}

/**
 * Synchronously writes entries/trash/categories to localStorage (with automatic
 * photo-stripped fallback if quota is exceeded) AND writes the full payload
 * (including all photos) to IndexedDB for durable, high-capacity persistence.
 */
export function persistSnapshotSync(
  entries: JournalEntry[],
  trash: JournalEntry[],
  categories: CategoryConfig[]
): Promise<SaveResult> {
  const savedAt = Date.now();
  const snapshot: PersistedSnapshot = {
    entries,
    trash,
    categories,
    savedAt,
  };

  let usedLocalStorage = false;
  let quotaTrimmedLocal = false;

  try {
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
    localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(trash));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    localStorage.setItem(META_SAVED_AT_KEY, String(savedAt));
    usedLocalStorage = true;
  } catch {
    // Quota exceeded (likely due to base64 photos). Store text/links/checklists
    // in localStorage so nothing text-based is ever lost, while IndexedDB keeps full photos!
    try {
      const liteEntries = entries.map((e) => ({ ...e, images: [] }));
      const liteTrash = trash.map((e) => ({ ...e, images: [] }));
      localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(liteEntries));
      localStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(liteTrash));
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      localStorage.setItem(META_SAVED_AT_KEY, String(savedAt));
      usedLocalStorage = true;
      quotaTrimmedLocal = true;
    } catch {
      usedLocalStorage = false;
    }
  }

  return idbSet(SNAPSHOT_KEY, snapshot).then((usedIndexedDb) => ({
    ok: usedLocalStorage || usedIndexedDb,
    usedIndexedDb,
    usedLocalStorage,
    quotaTrimmedLocal,
    savedAt,
  }));
}

export async function loadSnapshotFromIndexedDb(): Promise<PersistedSnapshot | null> {
  return idbGet<PersistedSnapshot>(SNAPSHOT_KEY);
}

export function loadDraftSync(): EntryDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EntryDraft>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      date: typeof parsed.date === 'string' ? parsed.date : '',
      title: typeof parsed.title === 'string' ? parsed.title : '',
      categoryIds: Array.isArray(parsed.categoryIds) ? parsed.categoryIds : [],
      links: Array.isArray(parsed.links) ? parsed.links : [],
      images: Array.isArray(parsed.images) ? parsed.images : [],
      checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
      takeaways: typeof parsed.takeaways === 'string' ? parsed.takeaways : '',
      mood: parsed.mood ?? 'productive',
      isHighlighted: Boolean(parsed.isHighlighted),
      durationMinutes:
        typeof parsed.durationMinutes === 'string' ? parsed.durationMinutes : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return null;
  }
}

export async function loadDraftFromIndexedDb(): Promise<EntryDraft | null> {
  return idbGet<EntryDraft>(DRAFT_KEY);
}

export function persistDraft(draft: EntryDraft | null): void {
  if (!draft) {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    void idbDelete(DRAFT_KEY);
    return;
  }

  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Fallback without photos in localStorage; full draft still goes to IndexedDB
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, images: [] }));
    } catch {
      // ignore
    }
  }
  void idbSet(DRAFT_KEY, draft);
}

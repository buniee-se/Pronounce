import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  AlertTriangle,
  Check,
  Clock,
  Cloud,
  Globe,
  LogIn,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Sun,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ActiveTab,
  CategoryConfig,
  JournalEntry,
  SavedImage,
} from './types/journal';
import {
  getUserAvatarUrl,
  getUserDisplayName,
  signOutSupabase,
  supabase,
} from './lib/supabase';
import {
  cloudDeleteCategory,
  cloudDeleteEntryForever,
  cloudEmptyTrash,
  cloudMoveAllToTrash,
  cloudMoveToTrash,
  cloudReplaceActiveJournal,
  cloudRestoreAllFromTrash,
  cloudRestoreFromTrash,
  cloudToggleChecklist,
  cloudToggleHighlight,
  cloudUpdateCategory,
  cloudUpsertCategory,
  cloudUpsertEntry,
  cloudUpsertJournalSnapshot,
  fetchUserJournal,
  sanitizeCloudId,
  subscribeToSupabaseJournal,
} from './services/supabaseSync';
import { createSampleEntries, DEFAULT_CATEGORIES } from './data/defaults';
import { Language, TRANSLATIONS } from './i18n/translations';
import {
  calculateStats,
  generateId,
  STORAGE_KEYS,
} from './utils/journalUtils';
import {
  getLocalSavedAt,
  loadSnapshotFromIndexedDb,
  persistSnapshotSync,
} from './utils/storageEngine';
import {
  playClick,
  playSave,
  playTrash,
  setSoundEnabled,
} from './utils/soundEffects';
import { AuthModal } from './components/AuthModal';
import { EntryForm } from './components/EntryForm';
import { TimelineView } from './components/TimelineView';
import { CalendarView } from './components/CalendarView';
import { ResourcesView } from './components/ResourcesView';
import { CategoriesView } from './components/CategoriesView';
import { BackupView } from './components/BackupView';
import { TrashView } from './components/TrashView';
import { FocusTimer } from './components/FocusTimer';
import { ImageLightbox } from './components/ImageLightbox';

interface ToastState {
  message: string;
  undoEntryId?: string;
}

interface LightboxState {
  images: SavedImage[];
  index: number;
}

function normalizeEntries(list: unknown[]): JournalEntry[] {
  return list.map((raw) => {
    const e = raw as JournalEntry;
    return {
      ...e,
      images: Array.isArray(e.images) ? e.images : [],
      checklist: Array.isArray(e.checklist) ? e.checklist : [],
      isHighlighted: Boolean(e.isHighlighted),
    };
  });
}

function loadInitialCategories(): CategoryConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback to defaults
  }
  return DEFAULT_CATEGORIES;
}

function loadInitialEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ENTRIES);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizeEntries(parsed);
      }
    }
  } catch {
    // Fallback to sample data
  }
  return createSampleEntries();
}

function loadInitialTrash(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRASH);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizeEntries(parsed);
      }
    }
  } catch {
    // Ignore
  }
  return [];
}

function loadInitialDark(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
  } catch {
    // ignore
  }
  return document.documentElement.classList.contains('dark');
}

function loadInitialLang(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.LANG);
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {
    // ignore
  }
  return 'en';
}

function loadInitialSound(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SOUND);
    if (saved === 'off') return false;
  } catch {
    // ignore
  }
  return true;
}

function formatClockTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function App() {
  const [entries, setEntries] = useState<JournalEntry[]>(loadInitialEntries);
  const [trashEntries, setTrashEntries] = useState<JournalEntry[]>(loadInitialTrash);
  const [categories, setCategories] = useState<CategoryConfig[]>(loadInitialCategories);
  const [isDark, setIsDark] = useState<boolean>(loadInitialDark);
  const [lang, setLang] = useState<Language>(loadInitialLang);
  const [soundOn, setSoundOn] = useState<boolean>(loadInitialSound);
  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline');
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [prefillDuration, setPrefillDuration] = useState<number | null>(null);
  const [mobileComposerOpen, setMobileComposerOpen] = useState<boolean>(false);
  const [timerOpen, setTimerOpen] = useState<boolean>(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [lastSavedAt, setLastSavedAt] = useState<number>(() => getLocalSavedAt() || Date.now());
  const [justSaved, setJustSaved] = useState<boolean>(false);
  const [storageBlocked, setStorageBlocked] = useState<boolean>(false);

  // Supabase Auth & Cloud Sync state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(() => Boolean(supabase));
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [cloudSyncing, setCloudSyncing] = useState<boolean>(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('dayleaf_cloud_banner_dismissed') === '1';
    } catch {
      return false;
    }
  });

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const saveFlashTimerRef = useRef<number | null>(null);
  const isHydratingRef = useRef<boolean>(true);
  const mergedLoginUidRef = useRef<string | null>(null);
  const latestStateRef = useRef({ entries, trashEntries, categories });
  latestStateRef.current = { entries, trashEntries, categories };

  const t = TRANSLATIONS[lang];

  const showToast = (message: string, undoEntryId?: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, undoEntryId });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, undoEntryId ? 5500 : 3200);
  };

  // Hydrate from IndexedDB on mount if IndexedDB holds newer data or photos that exceeded localStorage
  useEffect(() => {
    let active = true;
    void loadSnapshotFromIndexedDb().then((snapshot) => {
      if (!active) return;
      if (snapshot && Array.isArray(snapshot.entries)) {
        const localSaved = getLocalSavedAt();
        const localHasPhotos = latestStateRef.current.entries.some(
          (e) => (e.images?.length ?? 0) > 0
        );
        const idbHasPhotos = snapshot.entries.some(
          (e) => (e.images?.length ?? 0) > 0
        );

        if (snapshot.savedAt > localSaved || (idbHasPhotos && !localHasPhotos)) {
          setEntries(normalizeEntries(snapshot.entries));
          if (Array.isArray(snapshot.trash)) {
            setTrashEntries(normalizeEntries(snapshot.trash));
          }
          if (Array.isArray(snapshot.categories) && snapshot.categories.length > 0) {
            setCategories(snapshot.categories);
          }
          setLastSavedAt(snapshot.savedAt);
        }
      }
      isHydratingRef.current = false;
    });

    return () => {
      active = false;
    };
  }, []);

  // Sync sound synthesizer preference
  useEffect(() => {
    setSoundEnabled(soundOn);
    try {
      localStorage.setItem(STORAGE_KEYS.SOUND, soundOn ? 'on' : 'off');
    } catch {
      // ignore
    }
  }, [soundOn]);

  // Auto-save snapshot to BOTH localStorage + IndexedDB whenever entries, trash, or categories change
  useEffect(() => {
    if (isHydratingRef.current) return;
    void persistSnapshotSync(entries, trashEntries, categories).then((res) => {
      if (res.ok) {
        setLastSavedAt(res.savedAt);
        setStorageBlocked(false);
      } else {
        setStorageBlocked(true);
      }
    });
  }, [entries, trashEntries, categories]);

  // Flush snapshot synchronously on pagehide / visibilitychange so leaving the tab never drops data
  useEffect(() => {
    const flushNow = () => {
      const { entries: e, trashEntries: tr, categories: c } = latestStateRef.current;
      void persistSnapshotSync(e, tr, c);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Close account dropdown when clicking outside
  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [accountMenuOpen]);

  // Listen to Supabase Auth state
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setAuthLoading(false);
      if (!nextUser) {
        mergedLoginUidRef.current = null;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch & subscribe to Supabase journal tables when signed in
  useEffect(() => {
    if (!user || !supabase) return;
    let cancelled = false;

    const loadFromSupabase = async (isInitialSync: boolean) => {
      setCloudSyncing(true);
      try {
        const snapshot = await fetchUserJournal(user.id);
        if (cancelled) return;

        if (isInitialSync && mergedLoginUidRef.current !== user.id) {
          mergedLoginUidRef.current = user.id;
          const local = latestStateRef.current;

          if (!snapshot.hasCloudDocs) {
            // First-time sign-in with empty cloud: upload local browser data so nothing is lost
            const seedCats =
              local.categories.length > 0 ? local.categories : DEFAULT_CATEGORIES;
            await cloudUpsertJournalSnapshot(user.id, {
              entries: local.entries,
              trashEntries: local.trashEntries,
              categories: seedCats,
            });
            if (!cancelled) {
              setCloudSyncing(false);
              setLastSavedAt(Date.now());
            }
            return;
          }

          // Existing cloud data: merge any non-sample local entries created before signing in
          const cloudEntryIds = new Set<string>([
            ...snapshot.entries.map((e) => e.id),
            ...snapshot.trashEntries.map((e) => e.id),
          ]);
          const cloudCatIds = new Set<string>(snapshot.categories.map((c) => c.id));

          const missingLocalEntries = local.entries.filter(
            (e) => !e.id.startsWith('sample-') && !cloudEntryIds.has(e.id)
          );
          const missingLocalTrash = local.trashEntries.filter(
            (e) => !e.id.startsWith('sample-') && !cloudEntryIds.has(e.id)
          );
          const missingLocalCats = local.categories.filter(
            (c) => !cloudCatIds.has(c.id)
          );

          if (
            missingLocalEntries.length > 0 ||
            missingLocalTrash.length > 0 ||
            missingLocalCats.length > 0
          ) {
            await cloudUpsertJournalSnapshot(user.id, {
              entries: missingLocalEntries,
              trashEntries: missingLocalTrash,
              categories: missingLocalCats,
            });
            const mergedSnapshot = await fetchUserJournal(user.id);
            if (cancelled) return;
            const mergedCats =
              mergedSnapshot.categories.length > 0
                ? mergedSnapshot.categories
                : DEFAULT_CATEGORIES;
            setEntries(mergedSnapshot.entries);
            setTrashEntries(mergedSnapshot.trashEntries);
            setCategories(mergedCats);
            setCloudSyncing(false);
            setLastSavedAt(Date.now());
            void persistSnapshotSync(
              mergedSnapshot.entries,
              mergedSnapshot.trashEntries,
              mergedCats
            );
            return;
          }
        }

        const nextCats =
          snapshot.categories.length > 0 ? snapshot.categories : DEFAULT_CATEGORIES;
        setEntries(snapshot.entries);
        setTrashEntries(snapshot.trashEntries);
        setCategories(nextCats);
        setCloudSyncing(false);
        setLastSavedAt(Date.now());
        void persistSnapshotSync(snapshot.entries, snapshot.trashEntries, nextCats);
      } catch (err) {
        if (!cancelled) {
          setCloudSyncing(false);
          console.error('Supabase sync error:', err);
          showToast(t.cloud.syncError);
        }
      }
    };

    void loadFromSupabase(true);

    const unsubscribeRealtime = subscribeToSupabaseJournal(user.id, () => {
      if (!cancelled) {
        void loadFromSupabase(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeRealtime();
    };
  }, [user]);

  const runCloudOp = (op: () => Promise<void>) => {
    if (!user || !supabase) return;
    setCloudSyncing(true);
    void op()
      .then(() => {
        setCloudSyncing(false);
        setLastSavedAt(Date.now());
      })
      .catch((err) => {
        setCloudSyncing(false);
        console.error('Supabase write error:', err);
        showToast(t.cloud.syncError);
      });
  };

  const handleOpenAuthModal = () => {
    playClick();
    setAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    playClick();
    setAccountMenuOpen(false);
    try {
      await signOutSupabase();
      showToast(t.cloud.signedOutToast);
    } catch {
      // ignore
    }
  };

  // Manual Save handler (also bound to Ctrl+S / Cmd+S) — flushes local + Supabase Cloud when signed in
  const handleManualSave = () => {
    const { entries: e, trashEntries: tr, categories: c } = latestStateRef.current;
    void persistSnapshotSync(e, tr, c).then(async (res) => {
      if (user && supabase) {
        setCloudSyncing(true);
        try {
          await cloudUpsertJournalSnapshot(user.id, {
            entries: e,
            trashEntries: tr,
            categories: c,
          });
          const now = Date.now();
          playSave();
          setCloudSyncing(false);
          setLastSavedAt(now);
          setStorageBlocked(false);
          setJustSaved(true);
          if (saveFlashTimerRef.current) {
            window.clearTimeout(saveFlashTimerRef.current);
          }
          saveFlashTimerRef.current = window.setTimeout(() => {
            setJustSaved(false);
          }, 2200);
          showToast(t.toasts.manualSavedCloud(formatClockTime(now)));
          return;
        } catch (err) {
          setCloudSyncing(false);
          console.error('Supabase manual save error:', err);
          showToast(t.cloud.syncError);
          return;
        }
      }

      if (res.ok) {
        playSave();
        setLastSavedAt(res.savedAt);
        setStorageBlocked(false);
        setJustSaved(true);
        if (saveFlashTimerRef.current) {
          window.clearTimeout(saveFlashTimerRef.current);
        }
        saveFlashTimerRef.current = window.setTimeout(() => {
          setJustSaved(false);
        }, 2000);
        showToast(t.toasts.manualSaved(formatClockTime(res.savedAt)));
      } else {
        setStorageBlocked(true);
        showToast(t.toasts.saveFailed);
      }
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lang, user]);

  // Persist language
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEYS.LANG, lang);
    } catch {
      // Ignore
    }
  }, [lang]);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
    } catch {
      // Ignore
    }
  }, [isDark]);

  const stats = useMemo(() => calculateStats(entries), [entries]);

  const commitState = (
    nextEntries: JournalEntry[],
    nextTrash: JournalEntry[],
    nextCategories: CategoryConfig[]
  ) => {
    setEntries(nextEntries);
    setTrashEntries(nextTrash);
    setCategories(nextCategories);
    void persistSnapshotSync(nextEntries, nextTrash, nextCategories).then((res) => {
      if (res.ok) {
        setLastSavedAt(res.savedAt);
        setStorageBlocked(false);
      } else {
        setStorageBlocked(true);
      }
    });
  };

  const handleSaveEntry = (
    entryData: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>,
    editingId?: string
  ) => {
    const now = new Date().toISOString();
    playSave();
    if (editingId) {
      const previous = entries.find((item) => item.id === editingId);
      const updatedEntry: JournalEntry = previous
        ? { ...previous, ...entryData, updatedAt: now }
        : { ...entryData, id: editingId, createdAt: now, updatedAt: now };

      const nextEntries = entries.map((item) =>
        item.id === editingId ? updatedEntry : item
      );
      commitState(nextEntries, trashEntries, categories);
      if (user) {
        runCloudOp(() =>
          cloudUpsertEntry(user.id, updatedEntry, previous?.images ?? [])
        );
      }
      setEditingEntry(null);
      setMobileComposerOpen(false);
      showToast(t.toasts.updated);
    } else {
      const created: JournalEntry = {
        ...entryData,
        id: generateId('entry'),
        createdAt: now,
        updatedAt: now,
      };
      const nextEntries = [created, ...entries];
      commitState(nextEntries, trashEntries, categories);
      if (user) {
        runCloudOp(() => cloudUpsertEntry(user.id, created, []));
      }
      setMobileComposerOpen(false);
      showToast(t.toasts.logged);
    }
  };

  const handleEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setActiveTab('timeline');
    setMobileComposerOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 150);
  };

  const handleMoveToTrash = (entryId: string) => {
    const target = entries.find((e) => e.id === entryId);
    if (!target) return;
    const deletedAtIso = new Date().toISOString();
    const trashed: JournalEntry = {
      ...target,
      deletedAt: deletedAtIso,
    };
    const nextEntries = entries.filter((e) => e.id !== entryId);
    const nextTrash = [trashed, ...trashEntries.filter((e) => e.id !== entryId)];
    commitState(nextEntries, nextTrash, categories);
    if (user) {
      runCloudOp(() => cloudMoveToTrash(user.id, entryId, deletedAtIso));
    }
    if (editingEntry?.id === entryId) {
      setEditingEntry(null);
    }
    showToast(t.toasts.movedToTrash, entryId);
  };

  const handleRestoreFromTrash = (entryId: string) => {
    const target = trashEntries.find((e) => e.id === entryId);
    if (!target) return;
    const { deletedAt: _omit, ...restored } = target;
    void _omit;
    const nextTrash = trashEntries.filter((e) => e.id !== entryId);
    const nextEntries = [restored, ...entries.filter((e) => e.id !== entryId)];
    commitState(nextEntries, nextTrash, categories);
    if (user) {
      runCloudOp(() => cloudRestoreFromTrash(user.id, entryId));
    }
    showToast(t.toasts.restored);
  };

  const handleRestoreAllFromTrash = () => {
    if (trashEntries.length === 0) return;
    const idsToRestore = trashEntries.map((e) => e.id);
    const restoredList = trashEntries.map(({ deletedAt: _omit, ...rest }) => {
      void _omit;
      return rest;
    });
    const map = new Map(entries.map((e) => [e.id, e]));
    for (const item of restoredList) {
      map.set(item.id, item);
    }
    const nextEntries = Array.from(map.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    commitState(nextEntries, [], categories);
    if (user) {
      runCloudOp(() => cloudRestoreAllFromTrash(user.id, idsToRestore));
    }
    showToast(t.toasts.restoredAll);
  };

  const handleDeleteForever = (entryId: string) => {
    const nextTrash = trashEntries.filter((e) => e.id !== entryId);
    commitState(entries, nextTrash, categories);
    if (user) {
      runCloudOp(() => cloudDeleteEntryForever(user.id, entryId));
    }
    showToast(t.toasts.deletedForever);
  };

  const handleEmptyTrash = () => {
    const hadTrash = trashEntries.length > 0;
    commitState(entries, [], categories);
    if (user && hadTrash) {
      runCloudOp(() => cloudEmptyTrash(user.id));
    }
    showToast(t.toasts.trashEmptied);
  };

  const handleUndoMoveToTrash = () => {
    if (!toast?.undoEntryId) return;
    playSave();
    handleRestoreFromTrash(toast.undoEntryId);
    setToast(null);
  };

  const handleToggleHighlight = (entryId: string) => {
    let nextState = false;
    const nextEntries = entries.map((entry) => {
      if (entry.id === entryId) {
        nextState = !entry.isHighlighted;
        return {
          ...entry,
          isHighlighted: nextState,
          updatedAt: new Date().toISOString(),
        };
      }
      return entry;
    });
    commitState(nextEntries, trashEntries, categories);
    if (user) {
      runCloudOp(() => cloudToggleHighlight(user.id, entryId, nextState));
    }
    showToast(nextState ? t.toasts.highlighted : t.toasts.unhighlighted);
  };

  const handleToggleChecklistItem = (entryId: string, itemId: string) => {
    let updatedChecklist: JournalEntry['checklist'] | null = null;
    const nextEntries = entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      const nextList = (entry.checklist ?? []).map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      );
      updatedChecklist = nextList;
      return {
        ...entry,
        checklist: nextList,
        updatedAt: new Date().toISOString(),
      };
    });
    commitState(nextEntries, trashEntries, categories);
    if (user && updatedChecklist) {
      const checklistToSync = updatedChecklist;
      runCloudOp(() => cloudToggleChecklist(user.id, entryId, checklistToSync));
    }
  };

  const handleFocusNewEntry = (dateIso?: string) => {
    playClick();
    setEditingEntry(null);
    if (dateIso) setPrefillDate(dateIso);
    setActiveTab('timeline');
    setMobileComposerOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 120);
  };

  const handleLogDurationFromTimer = (minutes: number) => {
    setPrefillDuration(minutes);
    setActiveTab('timeline');
    setMobileComposerOpen(true);
    showToast(t.toasts.timerLogged(minutes));
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 120);
  };

  const handleAddCategory = (name: string, color: string): CategoryConfig => {
    playClick();
    const newCat: CategoryConfig = {
      id: generateId('cat'),
      name: name.trim(),
      color,
    };
    const nextCategories = [...categories, newCat];
    commitState(entries, trashEntries, nextCategories);
    if (user) {
      runCloudOp(() =>
        cloudUpsertCategory(user.id, newCat, nextCategories.length - 1)
      );
    }
    showToast(t.toasts.tagAdded(newCat.name));
    return newCat;
  };

  const handleUpdateCategory = (
    id: string,
    updates: Partial<Pick<CategoryConfig, 'name' | 'color'>>
  ) => {
    const nextCategories = categories.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    );
    commitState(entries, trashEntries, nextCategories);
    if (user) {
      runCloudOp(() => cloudUpdateCategory(user.id, id, updates));
    }
  };

  const handleDeleteCategory = (id: string) => {
    if (categories.length <= 1) return;
    playTrash();
    const affectedEntries = [...entries, ...trashEntries].filter((e) =>
      e.categoryIds.includes(id)
    );
    const nextCategories = categories.filter((c) => c.id !== id);
    const nextEntries = entries.map((e) => ({
      ...e,
      categoryIds: e.categoryIds.filter((catId) => catId !== id),
    }));
    const nextTrash = trashEntries.map((e) => ({
      ...e,
      categoryIds: e.categoryIds.filter((catId) => catId !== id),
    }));
    commitState(nextEntries, nextTrash, nextCategories);
    if (user) {
      runCloudOp(() => cloudDeleteCategory(user.id, id, affectedEntries));
    }
    showToast(t.toasts.tagRemoved);
  };

  const handleImportData = (
    data: { entries: JournalEntry[]; categories: CategoryConfig[] },
    mode: 'merge' | 'replace'
  ) => {
    playSave();
    const sanitizedIncomingEntries = data.entries.map((e) => ({
      ...e,
      id: sanitizeCloudId(e.id, 'entry'),
    }));
    const sanitizedIncomingCats = data.categories.map((c) => ({
      ...c,
      id: sanitizeCloudId(c.id, 'cat'),
    }));

    if (mode === 'replace') {
      const nextCats =
        sanitizedIncomingCats.length > 0 ? sanitizedIncomingCats : categories;
      commitState(sanitizedIncomingEntries, trashEntries, nextCats);
      if (user) {
        runCloudOp(() =>
          cloudReplaceActiveJournal(user.id, {
            nextEntries: sanitizedIncomingEntries,
            nextCategories: nextCats,
          })
        );
      }
      setEditingEntry(null);
      return;
    }

    const existingIds = new Set(categories.map((c) => c.id));
    const additions = sanitizedIncomingCats.filter((c) => !existingIds.has(c.id));
    const nextCats = [...categories, ...additions];

    const map = new Map(entries.map((e) => [e.id, e]));
    for (const incoming of sanitizedIncomingEntries) {
      map.set(incoming.id, incoming);
    }
    const nextEntries = Array.from(map.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    commitState(nextEntries, trashEntries, nextCats);
    if (user) {
      runCloudOp(() =>
        cloudUpsertJournalSnapshot(user.id, {
          entries: sanitizedIncomingEntries,
          trashEntries: [],
          categories: additions,
        })
      );
    }
  };

  const handleResetSampleData = () => {
    playSave();
    const sampleEntries = createSampleEntries();
    commitState(sampleEntries, trashEntries, DEFAULT_CATEGORIES);
    if (user) {
      runCloudOp(() =>
        cloudReplaceActiveJournal(user.id, {
          nextEntries: sampleEntries,
          nextCategories: DEFAULT_CATEGORIES,
        })
      );
    }
    setEditingEntry(null);
    showToast(t.toasts.sampleRestored);
  };

  const handleMoveAllToTrash = () => {
    if (entries.length === 0) return;
    playTrash();
    const now = new Date().toISOString();
    const idsToMove = entries.map((e) => e.id);
    const moved = entries.map((e) => ({ ...e, deletedAt: now }));
    commitState([], [...moved, ...trashEntries], categories);
    if (user) {
      runCloudOp(() => cloudMoveAllToTrash(user.id, idsToMove, now));
    }
    setEditingEntry(null);
    showToast(t.toasts.cleared);
  };

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'timeline', label: t.nav.timeline },
    { id: 'calendar', label: t.nav.calendar },
    { id: 'resources', label: t.nav.resources },
    { id: 'categories', label: t.nav.categories },
    { id: 'backup', label: t.nav.backup },
  ];

  const switchTab = (nextTab: ActiveTab) => {
    if (nextTab !== activeTab) {
      playClick();
      setActiveTab(nextTab);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#FAF8F4] text-[#22201C] transition-colors dark:bg-[#141311] dark:text-[#EFECE6]">
        {/* Clean 3-Zone Top Bar */}
        <header className="border-b border-[#E8E2D7] bg-[#FAF8F4]/95 backdrop-blur-sm dark:border-[#26231E] dark:bg-[#141311]/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-6 sm:px-6">
            {/* Zone 1: Single-line Brand Wordmark */}
            <button
              type="button"
              onClick={() => switchTab('timeline')}
              className="font-display text-xl font-bold tracking-tight text-[#1E1C18] whitespace-nowrap shrink-0 dark:text-[#F5F2EB]"
            >
              Dayleaf
            </button>

            {/* Zone 2: 5 Concise Single-Line Nav Links with sliding active indicator */}
            <nav
              aria-label="Primary navigation"
              className="hidden items-center gap-6 md:flex"
            >
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchTab(item.id)}
                    className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'text-[#1E1C18] dark:text-[#F5F2EB]'
                        : 'text-[#6D665B] hover:text-[#1E1C18] dark:text-[#9A9388] dark:hover:text-[#F5F2EB]'
                    }`}
                  >
                    {item.label}
                    {active && (
                      <motion.span
                        layoutId="activeNavUnderline"
                        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                        className="absolute inset-x-0 -bottom-[15px] h-[2px] bg-[#3D6B52] dark:bg-[#7EB093]"
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Zone 3: Quick Utilities (Manual Save, Language, Sound, Timer, Trash, Theme, Account) + Primary CTA */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Manual Save / Cloud Sync button */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={handleManualSave}
                title={
                  user
                    ? `${t.cloud.syncedAt(formatClockTime(lastSavedAt))} (Ctrl+S)`
                    : `${t.actions.savedAt(formatClockTime(lastSavedAt))} (Ctrl+S)`
                }
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  justSaved
                    ? 'border-[#3D6B52] bg-[#3D6B52]/12 text-[#264E38] dark:border-[#7EB093] dark:bg-[#7EB093]/18 dark:text-[#A5D3B8]'
                    : 'border-[#E4DDD2] bg-white text-[#4B463E] hover:bg-[#F3EFE7] hover:text-[#1F1D19] dark:border-[#2E2B26] dark:bg-[#1D1B18] dark:text-[#D1CBC0] dark:hover:bg-[#27241F] dark:hover:text-[#F5F2EB]'
                }`}
              >
                {cloudSyncing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#3D6B52] dark:text-[#7EB093]" />
                ) : justSaved ? (
                  <Check className="h-3.5 w-3.5 text-[#3D6B52] dark:text-[#7EB093]" />
                ) : user ? (
                  <Cloud className="h-3.5 w-3.5 text-[#3D6B52] dark:text-[#7EB093]" />
                ) : (
                  <Save className="h-3.5 w-3.5 text-[#3D6B52] dark:text-[#7EB093]" />
                )}
                <span className="hidden sm:inline">
                  {cloudSyncing
                    ? t.cloud.syncing
                    : justSaved
                    ? t.actions.savedAt(formatClockTime(lastSavedAt))
                    : t.actions.saveNow}
                </span>
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  playClick();
                  setLang((prev) => (prev === 'en' ? 'vi' : 'en'));
                }}
                aria-label={t.actions.switchLang}
                title={t.actions.switchLang}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#E4DDD2] bg-white px-2.5 text-xs font-semibold text-[#4B463E] transition-colors hover:bg-[#F3EFE7] hover:text-[#1F1D19] whitespace-nowrap shrink-0 dark:border-[#2E2B26] dark:bg-[#1D1B18] dark:text-[#D1CBC0] dark:hover:bg-[#27241F] dark:hover:text-[#F5F2EB]"
              >
                <Globe className="h-3.5 w-3.5 text-[#3D6B52] dark:text-[#7EB093]" />
                <span>{lang === 'en' ? 'EN' : 'VI'}</span>
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  const next = !soundOn;
                  setSoundEnabled(next);
                  setSoundOn(next);
                  if (next) playClick();
                }}
                aria-label={soundOn ? t.actions.soundOn : t.actions.soundOff}
                title={soundOn ? t.actions.soundOn : t.actions.soundOff}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors shrink-0 ${
                  soundOn
                    ? 'border-[#E4DDD2] bg-white text-[#3D6B52] hover:bg-[#F3EFE7] dark:border-[#2E2B26] dark:bg-[#1D1B18] dark:text-[#7EB093] dark:hover:bg-[#27241F]'
                    : 'border-[#E4DDD2] bg-white text-[#9A9388] hover:bg-[#F3EFE7] dark:border-[#2E2B26] dark:bg-[#1D1B18] dark:text-[#6B655B] dark:hover:bg-[#27241F]'
                }`}
              >
                {soundOn ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  playClick();
                  setTimerOpen((prev) => !prev);
                }}
                aria-label={t.actions.focusTimer}
                title={t.actions.focusTimer}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors shrink-0 ${
                  timerOpen
                    ? 'border-[#3D6B52] bg-[#3D6B52]/10 text-[#2B503B] dark:border-[#7EB093] dark:bg-[#7EB093]/15 dark:text-[#9AC9AE]'
                    : 'border-[#E4DDD2] bg-white text-[#534D44] hover:bg-[#F3EFE7] hover:text-[#1F1D19] dark:border-[#2E2B26] dark:bg-[#1D1B18] dark:text-[#C5BFB4] dark:hover:bg-[#27241F] dark:hover:text-[#F5F2EB]'
                }`}
              >
                <Clock className="h-4 w-4" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => switchTab('trash')}
                aria-label={t.actions.openTrash}
                title={t.nav.trash}
                className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors shrink-0 ${
                  activeTab === 'trash'
                    ? 'border-[#3D6B52] bg-[#3D6B52]/10 text-[#2B503B] dark:border-[#7EB093] dark:bg-[#7EB093]/15 dark:text-[#9AC9AE]'
                    : 'border-[#E4DDD2] bg-white text-[#534D44] hover:bg-[#F3EFE7] hover:text-[#1F1D19] dark:border-[#2E2B26] dark:bg-[#1D1B18] dark:text-[#C5BFB4] dark:hover:bg-[#27241F] dark:hover:text-[#F5F2EB]'
                }`}
              >
                <Trash2 className="h-4 w-4" />
                {trashEntries.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#B8413E] px-1 font-mono text-[10px] font-semibold tabular-nums text-white">
                    {trashEntries.length > 99 ? '99+' : trashEntries.length}
                  </span>
                )}
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  playClick();
                  setIsDark((prev) => !prev);
                }}
                aria-label={isDark ? t.actions.lightMode : t.actions.darkMode}
                title={isDark ? t.actions.lightMode : t.actions.darkMode}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E4DDD2] bg-white text-[#534D44] transition-colors hover:bg-[#F3EFE7] hover:text-[#1F1D19] shrink-0 dark:border-[#2E2B26] dark:bg-[#1D1B18] dark:text-[#C5BFB4] dark:hover:bg-[#27241F] dark:hover:text-[#F5F2EB]"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </motion.button>

              {/* Supabase Account Button / Popover */}
              {!authLoading && (
                <div className="relative shrink-0" ref={accountMenuRef}>
                  {user ? (
                    <>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() => {
                          playClick();
                          setAccountMenuOpen((prev) => !prev);
                        }}
                        aria-label={t.cloud.accountMenuLabel}
                        title={user.email || getUserDisplayName(user) || t.cloud.synced}
                        className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-[#3D6B52]/40 bg-white transition-colors hover:border-[#3D6B52] dark:border-[#7EB093]/40 dark:bg-[#1D1B18] dark:hover:border-[#7EB093]"
                      >
                        {getUserAvatarUrl(user) ? (
                          <img
                            src={getUserAvatarUrl(user)}
                            alt={getUserDisplayName(user)}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-[#3D6B52] dark:text-[#7EB093]">
                            {getUserDisplayName(user).charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span
                          aria-hidden="true"
                          className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#3D6B52] dark:border-[#1D1B18] dark:bg-[#7EB093]"
                        />
                      </motion.button>

                      <AnimatePresence>
                        {accountMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.97 }}
                            transition={{ duration: 0.14 }}
                            className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-[#E6E0D5] bg-white p-3.5 shadow-lg dark:border-[#2E2B26] dark:bg-[#1D1B18]"
                          >
                            <div className="flex items-center gap-2.5 border-b border-[#EFEAE0] pb-3 dark:border-[#2B2823]">
                              {getUserAvatarUrl(user) ? (
                                <img
                                  src={getUserAvatarUrl(user)}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="h-9 w-9 rounded-xl object-cover"
                                />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3D6B52]/12 text-xs font-bold text-[#3D6B52] dark:bg-[#7EB093]/20 dark:text-[#9AC9AE]">
                                  {getUserDisplayName(user).charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
                                  {getUserDisplayName(user)}
                                </p>
                                <p className="truncate text-[11px] text-[#756E63] dark:text-[#9A9388]">
                                  {user.email}
                                </p>
                              </div>
                            </div>

                            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-[#3D6B52] dark:text-[#7EB093]">
                              <Cloud className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {cloudSyncing
                                  ? t.cloud.syncing
                                  : t.cloud.syncedAt(formatClockTime(lastSavedAt))}
                              </span>
                            </div>

                            <div className="mt-3 flex flex-col gap-1.5">
                              <button
                                type="button"
                                disabled={cloudSyncing}
                                onClick={() => {
                                  setAccountMenuOpen(false);
                                  handleManualSave();
                                }}
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#3D6B52] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#315843] disabled:opacity-60 dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
                              >
                                <RefreshCw
                                  className={`h-3.5 w-3.5 ${cloudSyncing ? 'animate-spin' : ''}`}
                                />
                                <span>{t.cloud.syncNow}</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleSignOut}
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] px-3 py-2 text-xs font-medium text-[#4B463E] transition-colors hover:bg-[#EFEAE0] dark:border-[#34302A] dark:bg-[#161512] dark:text-[#D1CBC0] dark:hover:bg-[#27241F]"
                              >
                                <LogOut className="h-3.5 w-3.5" />
                                <span>{t.cloud.signOut}</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={handleOpenAuthModal}
                      title={t.cloud.signIn}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#3D6B52]/35 bg-[#3D6B52]/8 px-2.5 text-xs font-semibold text-[#2A503B] transition-colors hover:bg-[#3D6B52]/15 whitespace-nowrap shrink-0 dark:border-[#7EB093]/40 dark:bg-[#7EB093]/12 dark:text-[#A5D3B8] dark:hover:bg-[#7EB093]/20"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{t.cloud.signIn}</span>
                    </motion.button>
                  )}
                </div>
              )}

              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => handleFocusNewEntry()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#3D6B52] px-3 sm:px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#315843] whitespace-nowrap shrink-0 dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">{t.actions.newEntry}</span>
              </motion.button>
            </div>
          </div>

          {/* Mobile Nav Row */}
          <nav
            aria-label="Mobile navigation"
            className="flex items-center gap-1 overflow-x-auto border-t border-[#ECE6DC] px-4 py-2 md:hidden dark:border-[#24211C]"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchTab(item.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#22201C] text-[#FAF8F4] dark:bg-[#EFECE6] dark:text-[#141311]'
                      : 'text-[#6D665B] hover:bg-[#EFEAE0] dark:text-[#9A9388] dark:hover:bg-[#24211C]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        {/* Main Content Container */}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {/* Soft Dismissible Supabase Cloud Sync Prompt (when not signed in yet) */}
          <AnimatePresence>
            {!authLoading && !user && !bannerDismissed && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D7E2DA] bg-[#F5F8F6] px-4 py-3 dark:border-[#2B3B31] dark:bg-[#18201B]"
              >
                <div className="flex items-start gap-2.5 sm:items-center">
                  <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-[#3D6B52] sm:mt-0 dark:text-[#7EB093]" />
                  <div className="text-xs leading-relaxed">
                    <span className="font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
                      {t.cloud.bannerTitle}
                    </span>
                    <span className="mx-1.5 hidden text-[#9A9388] sm:inline">·</span>
                    <span className="block text-[#5F594F] sm:inline dark:text-[#A9A296]">
                      {t.cloud.bannerDesc}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenAuthModal}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#3D6B52] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#315843] dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>{t.cloud.signIn}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={t.actions.close}
                    onClick={() => {
                      playClick();
                      setBannerDismissed(true);
                      try {
                        sessionStorage.setItem('dayleaf_cloud_banner_dismissed', '1');
                      } catch {
                        // ignore
                      }
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#756E63] hover:bg-[#E6EFE9] hover:text-[#1F1D19] dark:text-[#9A9388] dark:hover:bg-[#243129] dark:hover:text-[#F4F1EA]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Storage Restricted Warning Banner (only shown if browser blocks localStorage + IndexedDB and not signed in) */}
          {storageBlocked && !user && (
            <div
              role="alert"
              className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6C5B8] bg-[#FDF4F0] px-4 py-3 text-xs text-[#8C3723] dark:border-[#4D2E25] dark:bg-[#271B17] dark:text-[#F0B4A4]"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{t.toasts.saveFailed}</span>
              </div>
              <button
                type="button"
                onClick={handleOpenAuthModal}
                className="rounded-lg bg-[#8C3723] px-3 py-1.5 font-semibold text-white hover:bg-[#732B1A] dark:bg-[#D9826C] dark:text-[#1B110E]"
              >
                {t.cloud.signIn}
              </button>
            </div>
          )}

          {/* Optional Collapsible Study Focus Timer */}
          <AnimatePresence>
            {timerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                <FocusTimer
                  lang={lang}
                  onLogDuration={handleLogDurationFromTimer}
                  onClose={() => setTimerOpen(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'timeline' && (
                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[410px_1fr]">
                  {/* Left Column: Daily Entry Form */}
                  <div className="lg:sticky lg:top-6">
                    <div className="mb-3 flex items-center justify-between lg:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setMobileComposerOpen((prev) => !prev);
                        }}
                        className="inline-flex w-full items-center justify-between rounded-xl border border-[#E6E0D5] bg-white px-4 py-3 text-sm font-semibold text-[#1F1D19] dark:border-[#2C2924] dark:bg-[#1D1B18] dark:text-[#F4F1EA]"
                      >
                        <span className="truncate pr-2">
                          {editingEntry
                            ? t.form.mobileEditing(editingEntry.title)
                            : mobileComposerOpen
                            ? t.form.mobileToggleHide
                            : t.form.mobileToggleOpen}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-[#3D6B52] dark:text-[#7EB093]">
                          {mobileComposerOpen ? t.actions.close : t.actions.open}
                        </span>
                      </button>
                    </div>

                    <div className={mobileComposerOpen ? 'block' : 'hidden lg:block'}>
                      <EntryForm
                        lang={lang}
                        categories={categories}
                        editingEntry={editingEntry}
                        prefillDate={prefillDate}
                        prefillDuration={prefillDuration}
                        onConsumePrefill={() => {
                          setPrefillDate(null);
                          setPrefillDuration(null);
                        }}
                        onSave={handleSaveEntry}
                        onCancelEdit={() => {
                          setEditingEntry(null);
                          setMobileComposerOpen(false);
                        }}
                        onUpdateCategoryColor={(catId, color) => {
                          playClick();
                          handleUpdateCategory(catId, { color });
                        }}
                        onQuickAddCategory={handleAddCategory}
                        onOpenLightbox={(images, index) => {
                          playClick();
                          setLightbox({ images, index });
                        }}
                        titleInputRef={titleInputRef}
                      />
                    </div>
                  </div>

                  {/* Right Column: Motivation Stats + Search/Filters + Timeline */}
                  <TimelineView
                    lang={lang}
                    entries={entries}
                    categories={categories}
                    stats={stats}
                    editingEntryId={editingEntry?.id ?? null}
                    onEdit={handleEditEntry}
                    onDelete={handleMoveToTrash}
                    onToggleHighlight={handleToggleHighlight}
                    onToggleChecklistItem={handleToggleChecklistItem}
                    onChecklistCompleteAll={() => showToast(t.toasts.checklistComplete)}
                    onFocusComposer={() => handleFocusNewEntry()}
                    onOpenLightbox={(images, index) => {
                      playClick();
                      setLightbox({ images, index });
                    }}
                  />
                </div>
              )}

              {activeTab === 'calendar' && (
                <CalendarView
                  lang={lang}
                  entries={entries}
                  categories={categories}
                  onEdit={handleEditEntry}
                  onDelete={handleMoveToTrash}
                  onToggleHighlight={handleToggleHighlight}
                  onToggleChecklistItem={handleToggleChecklistItem}
                  onChecklistCompleteAll={() => showToast(t.toasts.checklistComplete)}
                  onAddEntryForDate={(dateIso) => handleFocusNewEntry(dateIso)}
                  onOpenLightbox={(images, index) => {
                    playClick();
                    setLightbox({ images, index });
                  }}
                />
              )}

              {activeTab === 'resources' && (
                <ResourcesView
                  lang={lang}
                  entries={entries}
                  categories={categories}
                  onGoToTimeline={() => switchTab('timeline')}
                />
              )}

              {activeTab === 'categories' && (
                <CategoriesView
                  lang={lang}
                  categories={categories}
                  entries={entries}
                  onAddCategory={handleAddCategory}
                  onUpdateCategory={(id, updates) => {
                    if (updates.color) playClick();
                    handleUpdateCategory(id, updates);
                  }}
                  onDeleteCategory={handleDeleteCategory}
                />
              )}

              {activeTab === 'backup' && (
                <BackupView
                  lang={lang}
                  entries={entries}
                  categories={categories}
                  cloudUser={
                    user
                      ? {
                          displayName: getUserDisplayName(user),
                          email: user.email ?? '',
                          photoURL: getUserAvatarUrl(user),
                        }
                      : null
                  }
                  cloudSyncing={cloudSyncing}
                  onOpenAuthModal={handleOpenAuthModal}
                  onSignOut={handleSignOut}
                  onSyncNow={handleManualSave}
                  onImportData={handleImportData}
                  onResetSampleData={handleResetSampleData}
                  onClearAllEntries={handleMoveAllToTrash}
                />
              )}

              {activeTab === 'trash' && (
                <TrashView
                  lang={lang}
                  trashedEntries={trashEntries}
                  categories={categories}
                  onRestore={handleRestoreFromTrash}
                  onRestoreAll={handleRestoreAllFromTrash}
                  onDeleteForever={handleDeleteForever}
                  onEmptyTrash={handleEmptyTrash}
                  onGoToTimeline={() => switchTab('timeline')}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Quiet Footer */}
        <footer className="mx-auto mt-10 max-w-6xl border-t border-[#EAE4D9] px-4 py-6 text-xs text-[#877F73] sm:px-6 dark:border-[#24211C] dark:text-[#787166]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t.footer.left}</span>
            <span>
              {user
                ? `${t.cloud.footerSynced} · ${formatClockTime(lastSavedAt)}`
                : `${t.actions.autoSaved} · ${formatClockTime(lastSavedAt)} · ${t.footer.right}`}
            </span>
          </div>
        </footer>

        {/* Supabase Email/Password + Google Auth Modal */}
        <AuthModal
          open={authModalOpen}
          lang={lang}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={(label) => showToast(t.cloud.signedInToast(label))}
        />

        {/* Image Lightbox Modal */}
        {lightbox && (
          <ImageLightbox
            images={lightbox.images}
            activeIndex={lightbox.index}
            onClose={() => {
              playClick();
              setLightbox(null);
            }}
            onNavigate={(nextIndex) => {
              playClick();
              setLightbox((prev) => (prev ? { ...prev, index: nextIndex } : null));
            }}
          />
        )}

        {/* Animated Toast Notification with Optional Undo */}
        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-[#2F2C27] bg-[#1F1D19] px-4 py-2.5 text-xs font-medium text-[#F5F2EB] shadow-lg dark:border-[#E2DBD0] dark:bg-[#EFECE6] dark:text-[#141311]"
            >
              <span>{toast.message}</span>
              {toast.undoEntryId && (
                <button
                  type="button"
                  onClick={handleUndoMoveToTrash}
                  className="inline-flex items-center gap-1 rounded-md bg-[#3D6B52] px-2 py-1 text-xs font-semibold text-white hover:bg-[#315843] dark:bg-[#2E5440] dark:text-white"
                >
                  <Undo2 className="h-3 w-3" />
                  <span>{t.actions.undo}</span>
                </button>
              )}
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => {
                  playClick();
                  setToast(null);
                }}
                className="opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

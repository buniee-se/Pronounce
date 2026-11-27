import { supabase } from '../lib/supabase';
import {
  CategoryConfig,
  ChecklistItem,
  JournalEntry,
  MoodId,
  SavedImage,
  SavedLink,
} from '../types/journal';
import { generateId, getTodayIso, normalizeUrl } from '../utils/journalUtils';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const VALID_HEX_REGEX = /^#[0-9a-fA-F]{6}$/;
const VALID_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_MOODS = new Set<MoodId>(['productive', 'good', 'overwhelmed', 'lazy']);
const MAX_PHOTO_DATA_URL_LENGTH = 580000;

export function sanitizeCloudId(raw: string | undefined, prefix: string): string {
  if (raw && VALID_ID_REGEX.test(raw)) {
    return raw;
  }
  const cleaned = (raw ?? '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  if (cleaned && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return generateId(prefix);
}

function sanitizeLinks(links: SavedLink[]): SavedLink[] {
  return (links ?? [])
    .slice(0, 30)
    .map((l) => {
      const safeUrl = normalizeUrl(l.url);
      if (!safeUrl) return null;
      return {
        id: sanitizeCloudId(l.id, 'link'),
        label: (l.label || '').trim().slice(0, 200),
        url: safeUrl.slice(0, 2000),
      };
    })
    .filter((item): item is SavedLink => item !== null);
}

function sanitizeChecklist(checklist: ChecklistItem[]): ChecklistItem[] {
  return (checklist ?? [])
    .slice(0, 50)
    .map((item) => {
      const text = (item.text || '').trim().slice(0, 200);
      if (!text) return null;
      return {
        id: sanitizeCloudId(item.id, 'chk'),
        text,
        done: Boolean(item.done),
      };
    })
    .filter((item): item is ChecklistItem => item !== null);
}

function sanitizeCategoryIds(ids: string[]): string[] {
  return (ids ?? [])
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map((id) => sanitizeCloudId(id, 'cat'))
    .slice(0, 20);
}

function sanitizePhoto(img: SavedImage): SavedImage | null {
  if (
    typeof img.dataUrl !== 'string' ||
    img.dataUrl.length < 32 ||
    img.dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH ||
    !/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(img.dataUrl.slice(0, 32))
  ) {
    return null;
  }
  return {
    id: sanitizeCloudId(img.id, 'img'),
    dataUrl: img.dataUrl,
    caption: (img.caption ?? '').trim().slice(0, 160),
  };
}

interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
}

interface EntryRow {
  id: string;
  user_id: string;
  date: string;
  title: string;
  category_ids: string[];
  links: SavedLink[];
  checklist: ChecklistItem[];
  takeaways: string;
  mood: MoodId;
  is_highlighted: boolean;
  duration_minutes: number;
  is_trashed: boolean;
  deleted_at: string | null;
  created_at?: string;
  updated_at?: string;
}

interface PhotoRow {
  id: string;
  user_id: string;
  entry_id: string;
  data_url: string;
  caption: string;
}

function toEntryRow(userId: string, entry: JournalEntry, isTrashed: boolean): EntryRow {
  const safeId = sanitizeCloudId(entry.id, 'entry');
  const safeDate = VALID_DATE_REGEX.test(entry.date) ? entry.date : getTodayIso();
  const safeTitle = (entry.title || 'Untitled').trim().slice(0, 240) || 'Untitled';
  const safeDuration =
    typeof entry.durationMinutes === 'number' &&
    Number.isFinite(entry.durationMinutes) &&
    entry.durationMinutes > 0
      ? Math.min(1440, Math.round(entry.durationMinutes))
      : 0;

  return {
    id: safeId,
    user_id: userId,
    date: safeDate,
    title: safeTitle,
    category_ids: sanitizeCategoryIds(entry.categoryIds),
    links: sanitizeLinks(entry.links),
    checklist: sanitizeChecklist(entry.checklist),
    takeaways: (entry.takeaways ?? '').slice(0, 25000),
    mood: VALID_MOODS.has(entry.mood) ? entry.mood : 'good',
    is_highlighted: Boolean(entry.isHighlighted),
    duration_minutes: safeDuration,
    is_trashed: isTrashed,
    deleted_at: isTrashed ? entry.deletedAt || new Date().toISOString() : null,
  };
}

export interface CloudSnapshotPayload {
  entries: JournalEntry[];
  trashEntries: JournalEntry[];
  categories: CategoryConfig[];
  hasCloudDocs: boolean;
}

export async function fetchUserJournal(userId: string): Promise<CloudSnapshotPayload> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const [catRes, entryRes, photoRes] = await Promise.all([
    supabase
      .from('journal_categories')
      .select('id, name, color, sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('journal_entries')
      .select(
        'id, date, title, category_ids, links, checklist, takeaways, mood, is_highlighted, duration_minutes, is_trashed, deleted_at, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('date', { ascending: false }),
    supabase
      .from('journal_photos')
      .select('id, entry_id, data_url, caption')
      .eq('user_id', userId),
  ]);

  if (catRes.error) throw new Error(catRes.error.message);
  if (entryRes.error) throw new Error(entryRes.error.message);
  if (photoRes.error) throw new Error(photoRes.error.message);

  const photosByEntry = new Map<string, SavedImage[]>();
  for (const row of (photoRes.data ?? []) as Array<{
    id: string;
    entry_id: string;
    data_url: string;
    caption: string;
  }>) {
    const list = photosByEntry.get(row.entry_id) ?? [];
    list.push({
      id: row.id,
      dataUrl: row.data_url,
      caption: row.caption || '',
    });
    photosByEntry.set(row.entry_id, list);
  }

  const categories: CategoryConfig[] = ((catRes.data ?? []) as Array<{
    id: string;
    name: string;
    color: string;
  }>).map((c) => ({
    id: c.id,
    name: c.name || 'Tag',
    color: VALID_HEX_REGEX.test(c.color) ? c.color : '#3D6B52',
  }));

  const entries: JournalEntry[] = [];
  const trashEntries: JournalEntry[] = [];

  for (const row of (entryRes.data ?? []) as EntryRow[]) {
    const entry: JournalEntry = {
      id: row.id,
      date: row.date || getTodayIso(),
      title: row.title || 'Untitled',
      categoryIds: Array.isArray(row.category_ids) ? row.category_ids : [],
      links: Array.isArray(row.links) ? row.links : [],
      images: photosByEntry.get(row.id) ?? [],
      checklist: Array.isArray(row.checklist) ? row.checklist : [],
      takeaways: typeof row.takeaways === 'string' ? row.takeaways : '',
      mood: VALID_MOODS.has(row.mood) ? row.mood : 'good',
      isHighlighted: Boolean(row.is_highlighted),
      durationMinutes: row.duration_minutes > 0 ? row.duration_minutes : undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      ...(row.is_trashed && row.deleted_at ? { deletedAt: row.deleted_at } : {}),
    };
    if (row.is_trashed) {
      trashEntries.push(entry);
    } else {
      entries.push(entry);
    }
  }

  entries.sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return b.createdAt.localeCompare(a.createdAt);
  });

  trashEntries.sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));

  const hasCloudDocs =
    categories.length > 0 || entries.length > 0 || trashEntries.length > 0;

  return { entries, trashEntries, categories, hasCloudDocs };
}

/**
 * Subscribes to Supabase Realtime changes for the current user's journal tables.
 * Debounces rapid bursts into a clean re-fetch so entries, photos, and categories stay consistent.
 */
export function subscribeToSupabaseJournal(
  userId: string,
  onChange: () => void
): () => void {
  if (!supabase) return () => {};
  const client = supabase;

  let timer: number | null = null;
  const trigger = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      onChange();
    }, 350);
  };

  const channel = client
    .channel(`dayleaf-sync-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'journal_entries',
        filter: `user_id=eq.${userId}`,
      },
      trigger
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'journal_categories',
        filter: `user_id=eq.${userId}`,
      },
      trigger
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'journal_photos',
        filter: `user_id=eq.${userId}`,
      },
      trigger
    )
    .subscribe();

  return () => {
    if (timer) window.clearTimeout(timer);
    void client.removeChannel(channel);
  };
}

export async function cloudUpsertEntry(
  userId: string,
  entry: JournalEntry,
  previousImages: SavedImage[] = []
): Promise<void> {
  if (!supabase) return;
  const row = toEntryRow(userId, entry, false);

  const { error: entryErr } = await supabase
    .from('journal_entries')
    .upsert(row, { onConflict: 'user_id,id' });
  if (entryErr) throw new Error(entryErr.message);

  const nextPhotos = (entry.images ?? [])
    .map(sanitizePhoto)
    .filter((p): p is SavedImage => p !== null);

  if (nextPhotos.length > 0) {
    const photoRows: PhotoRow[] = nextPhotos.map((img) => ({
      id: img.id,
      user_id: userId,
      entry_id: row.id,
      data_url: img.dataUrl,
      caption: img.caption ?? '',
    }));
    const { error: photoErr } = await supabase
      .from('journal_photos')
      .upsert(photoRows, { onConflict: 'user_id,id' });
    if (photoErr) throw new Error(photoErr.message);
  }

  const nextIds = new Set(nextPhotos.map((p) => p.id));
  const removedIds = previousImages
    .map((img) => sanitizeCloudId(img.id, 'img'))
    .filter((id) => !nextIds.has(id));

  if (removedIds.length > 0) {
    const { error: delErr } = await supabase
      .from('journal_photos')
      .delete()
      .eq('user_id', userId)
      .in('id', removedIds);
    if (delErr) throw new Error(delErr.message);
  }
}

export async function cloudToggleHighlight(
  userId: string,
  entryId: string,
  isHighlighted: boolean
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('journal_entries')
    .update({ is_highlighted: Boolean(isHighlighted) })
    .eq('user_id', userId)
    .eq('id', sanitizeCloudId(entryId, 'entry'));
  if (error) throw new Error(error.message);
}

export async function cloudToggleChecklist(
  userId: string,
  entryId: string,
  checklist: ChecklistItem[]
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('journal_entries')
    .update({ checklist: sanitizeChecklist(checklist) })
    .eq('user_id', userId)
    .eq('id', sanitizeCloudId(entryId, 'entry'));
  if (error) throw new Error(error.message);
}

export async function cloudMoveToTrash(
  userId: string,
  entryId: string,
  deletedAtIso: string
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('journal_entries')
    .update({ is_trashed: true, deleted_at: deletedAtIso })
    .eq('user_id', userId)
    .eq('id', sanitizeCloudId(entryId, 'entry'));
  if (error) throw new Error(error.message);
}

export async function cloudMoveAllToTrash(
  userId: string,
  entryIds: string[],
  deletedAtIso: string
): Promise<void> {
  if (!supabase || entryIds.length === 0) return;
  const safeIds = entryIds.map((id) => sanitizeCloudId(id, 'entry'));
  const { error } = await supabase
    .from('journal_entries')
    .update({ is_trashed: true, deleted_at: deletedAtIso })
    .eq('user_id', userId)
    .in('id', safeIds);
  if (error) throw new Error(error.message);
}

export async function cloudRestoreFromTrash(
  userId: string,
  entryId: string
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('journal_entries')
    .update({ is_trashed: false, deleted_at: null })
    .eq('user_id', userId)
    .eq('id', sanitizeCloudId(entryId, 'entry'));
  if (error) throw new Error(error.message);
}

export async function cloudRestoreAllFromTrash(
  userId: string,
  entryIds: string[]
): Promise<void> {
  if (!supabase || entryIds.length === 0) return;
  const safeIds = entryIds.map((id) => sanitizeCloudId(id, 'entry'));
  const { error } = await supabase
    .from('journal_entries')
    .update({ is_trashed: false, deleted_at: null })
    .eq('user_id', userId)
    .in('id', safeIds);
  if (error) throw new Error(error.message);
}

export async function cloudDeleteEntryForever(
  userId: string,
  entryId: string
): Promise<void> {
  if (!supabase) return;
  // journal_photos rows cascade automatically via foreign key
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('user_id', userId)
    .eq('id', sanitizeCloudId(entryId, 'entry'));
  if (error) throw new Error(error.message);
}

export async function cloudEmptyTrash(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('user_id', userId)
    .eq('is_trashed', true);
  if (error) throw new Error(error.message);
}

export async function cloudUpsertCategory(
  userId: string,
  cat: CategoryConfig,
  sortOrder: number
): Promise<void> {
  if (!supabase) return;
  const row: CategoryRow = {
    id: sanitizeCloudId(cat.id, 'cat'),
    user_id: userId,
    name: cat.name.trim().slice(0, 60) || 'Tag',
    color: VALID_HEX_REGEX.test(cat.color) ? cat.color : '#3D6B52',
    sort_order: Math.max(0, Math.min(1000, Math.round(sortOrder))),
  };
  const { error } = await supabase
    .from('journal_categories')
    .upsert(row, { onConflict: 'user_id,id' });
  if (error) throw new Error(error.message);
}

export async function cloudUpdateCategory(
  userId: string,
  catId: string,
  updates: Partial<Pick<CategoryConfig, 'name' | 'color'>>
): Promise<void> {
  if (!supabase) return;
  const payload: Record<string, string> = {};
  if (typeof updates.name === 'string' && updates.name.trim()) {
    payload.name = updates.name.trim().slice(0, 60);
  }
  if (typeof updates.color === 'string' && VALID_HEX_REGEX.test(updates.color)) {
    payload.color = updates.color;
  }
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from('journal_categories')
    .update(payload)
    .eq('user_id', userId)
    .eq('id', sanitizeCloudId(catId, 'cat'));
  if (error) throw new Error(error.message);
}

export async function cloudDeleteCategory(
  userId: string,
  catId: string,
  affectedEntries: JournalEntry[]
): Promise<void> {
  if (!supabase) return;
  const client = supabase;

  if (affectedEntries.length > 0) {
    await Promise.all(
      affectedEntries.map(async (entry) => {
        const nextCatIds = sanitizeCategoryIds(
          entry.categoryIds.filter((id) => id !== catId)
        );
        const { error } = await client
          .from('journal_entries')
          .update({ category_ids: nextCatIds })
          .eq('user_id', userId)
          .eq('id', sanitizeCloudId(entry.id, 'entry'));
        if (error) throw new Error(error.message);
      })
    );
  }

  const { error } = await client
    .from('journal_categories')
    .delete()
    .eq('user_id', userId)
    .eq('id', sanitizeCloudId(catId, 'cat'));
  if (error) throw new Error(error.message);
}

export async function cloudUpsertJournalSnapshot(
  userId: string,
  params: {
    entries: JournalEntry[];
    trashEntries: JournalEntry[];
    categories: CategoryConfig[];
  }
): Promise<void> {
  if (!supabase) return;

  if (params.categories.length > 0) {
    const catRows: CategoryRow[] = params.categories.map((cat, idx) => ({
      id: sanitizeCloudId(cat.id, 'cat'),
      user_id: userId,
      name: cat.name.trim().slice(0, 60) || 'Tag',
      color: VALID_HEX_REGEX.test(cat.color) ? cat.color : '#3D6B52',
      sort_order: idx,
    }));
    const { error } = await supabase
      .from('journal_categories')
      .upsert(catRows, { onConflict: 'user_id,id' });
    if (error) throw new Error(error.message);
  }

  const allEntryRows: EntryRow[] = [
    ...params.entries.map((entry) => toEntryRow(userId, entry, false)),
    ...params.trashEntries.map((entry) => toEntryRow(userId, entry, true)),
  ];

  if (allEntryRows.length > 0) {
    const { error } = await supabase
      .from('journal_entries')
      .upsert(allEntryRows, { onConflict: 'user_id,id' });
    if (error) throw new Error(error.message);
  }

  const photoRows: PhotoRow[] = [];
  for (const entry of [...params.entries, ...params.trashEntries]) {
    const safeEntryId = sanitizeCloudId(entry.id, 'entry');
    for (const img of entry.images ?? []) {
      const safe = sanitizePhoto(img);
      if (!safe) continue;
      photoRows.push({
        id: safe.id,
        user_id: userId,
        entry_id: safeEntryId,
        data_url: safe.dataUrl,
        caption: safe.caption ?? '',
      });
    }
  }

  if (photoRows.length > 0) {
    const CHUNK = 20;
    for (let i = 0; i < photoRows.length; i += CHUNK) {
      const { error } = await supabase
        .from('journal_photos')
        .upsert(photoRows.slice(i, i + CHUNK), { onConflict: 'user_id,id' });
      if (error) throw new Error(error.message);
    }
  }
}

export async function cloudReplaceActiveJournal(
  userId: string,
  params: {
    nextEntries: JournalEntry[];
    nextCategories: CategoryConfig[];
  }
): Promise<void> {
  if (!supabase) return;

  const { error: delEntriesErr } = await supabase
    .from('journal_entries')
    .delete()
    .eq('user_id', userId)
    .eq('is_trashed', false);
  if (delEntriesErr) throw new Error(delEntriesErr.message);

  const { error: delCatsErr } = await supabase
    .from('journal_categories')
    .delete()
    .eq('user_id', userId);
  if (delCatsErr) throw new Error(delCatsErr.message);

  await cloudUpsertJournalSnapshot(userId, {
    entries: params.nextEntries,
    trashEntries: [],
    categories: params.nextCategories,
  });
}

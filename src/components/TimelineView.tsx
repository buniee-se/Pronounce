import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar,
  Clock,
  ExternalLink,
  Link2,
  Pencil,
  Search,
  Shuffle,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  CategoryConfig,
  JournalEntry,
  JournalStats,
  MoodId,
  SavedImage,
} from '../types/journal';
import { MOOD_OPTIONS } from '../data/defaults';
import { Language, TRANSLATIONS } from '../i18n/translations';
import {
  extractHostname,
  formatDateHeading,
  getMoodMeta,
} from '../utils/journalUtils';
import { RichTakeaways } from './RichTakeaways';
import { InteractiveChecklist } from './InteractiveChecklist';
import { playClick, playHighlight, playTrash } from '../utils/soundEffects';

interface TimelineViewProps {
  lang: Language;
  entries: JournalEntry[];
  categories: CategoryConfig[];
  stats: JournalStats;
  editingEntryId: string | null;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entryId: string) => void;
  onToggleHighlight: (entryId: string) => void;
  onToggleChecklistItem: (entryId: string, itemId: string) => void;
  onChecklistCompleteAll: () => void;
  onFocusComposer: () => void;
  onOpenLightbox: (images: SavedImage[], startIndex: number) => void;
}

const WEEKLY_GOAL_DAYS = 5;

export const TimelineView: React.FC<TimelineViewProps> = ({
  lang,
  entries,
  categories,
  stats,
  editingEntryId,
  onEdit,
  onDelete,
  onToggleHighlight,
  onToggleChecklistItem,
  onChecklistCompleteAll,
  onFocusComposer,
  onOpenLightbox,
}) => {
  const t = TRANSLATIONS[lang];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedMood, setSelectedMood] = useState<MoodId | 'all'>('all');
  const [highlightsOnly, setHighlightsOnly] = useState<boolean>(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [flashbackEntryId, setFlashbackEntryId] = useState<string | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategoryId !== 'all' ||
    selectedDate !== '' ||
    selectedMood !== 'all' ||
    highlightsOnly;

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return entries
      .filter((entry) => {
        if (highlightsOnly && !entry.isHighlighted) {
          return false;
        }
        if (selectedCategoryId !== 'all' && !entry.categoryIds.includes(selectedCategoryId)) {
          return false;
        }
        if (selectedDate && entry.date !== selectedDate) {
          return false;
        }
        if (selectedMood !== 'all' && entry.mood !== selectedMood) {
          return false;
        }
        if (q) {
          const inTitle = entry.title.toLowerCase().includes(q);
          const inTakeaways = entry.takeaways.toLowerCase().includes(q);
          const inChecklist = (entry.checklist ?? []).some((item) =>
            item.text.toLowerCase().includes(q)
          );
          const inLinks = entry.links.some(
            (l) => l.label.toLowerCase().includes(q) || l.url.toLowerCase().includes(q)
          );
          const inCats = entry.categoryIds.some((id) =>
            (categoryMap.get(id)?.name ?? '').toLowerCase().includes(q)
          );
          if (!inTitle && !inTakeaways && !inChecklist && !inLinks && !inCats) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [
    entries,
    searchQuery,
    selectedCategoryId,
    selectedDate,
    selectedMood,
    highlightsOnly,
    categoryMap,
  ]);

  const groupedByDate = useMemo(() => {
    const groups: { date: string; entries: JournalEntry[] }[] = [];
    for (const entry of filteredEntries) {
      const existing = groups[groups.length - 1];
      if (existing && existing.date === entry.date) {
        existing.entries.push(entry);
      } else {
        groups.push({ date: entry.date, entries: [entry] });
      }
    }
    return groups;
  }, [filteredEntries]);

  const flashbackEntry = useMemo(
    () => entries.find((e) => e.id === flashbackEntryId) ?? null,
    [entries, flashbackEntryId]
  );

  const pickRandomFlashback = () => {
    const pool = entries.filter((e) => e.takeaways.trim().length > 0);
    if (pool.length === 0) return;

    // Prioritize highlighted entries slightly if available, avoiding immediate repeat
    const candidates =
      pool.length > 1 ? pool.filter((e) => e.id !== flashbackEntryId) : pool;
    const highlightedPool = candidates.filter((e) => e.isHighlighted);
    const chosenPool =
      highlightedPool.length > 0 && Math.random() < 0.6
        ? highlightedPool
        : candidates;
    const picked = chosenPool[Math.floor(Math.random() * chosenPool.length)];
    if (picked) setFlashbackEntryId(picked.id);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategoryId('all');
    setSelectedDate('');
    setSelectedMood('all');
    setHighlightsOnly(false);
  };

  return (
    <div className="space-y-6">
      {/* Motivation Stats Strip — Unified flat surface with hairline dividers */}
      <section
        aria-label="Study motivation stats"
        className="grid grid-cols-2 divide-y divide-[#EAE4D9] rounded-2xl border border-[#E6E0D5] bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-[#2C2924] dark:border-[#2C2924] dark:bg-[#1D1B18]"
      >
        <div className="px-4 py-4 sm:px-5">
          <p className="text-xs font-medium text-[#756E63] dark:text-[#9A9388]">
            {t.stats.totalStudyDays}
          </p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold tabular-nums text-[#1F1D19] dark:text-[#F4F1EA]">
              {stats.totalStudyDays}
            </span>
            <span className="truncate text-[11px] text-[#888074] dark:text-[#867F74]">
              {t.stats.entriesCount(stats.totalEntries)}
            </span>
          </div>
        </div>

        <div className="border-l border-[#EAE4D9] px-4 py-4 sm:border-l-0 sm:px-5 dark:border-[#2C2924]">
          <p className="text-xs font-medium text-[#756E63] dark:text-[#9A9388]">
            {t.stats.currentStreak}
          </p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold tabular-nums text-[#3D6B52] dark:text-[#7EB093]">
              {stats.currentStreak}
            </span>
            <span className="truncate text-[11px] text-[#888074] dark:text-[#867F74]">
              {t.stats.daysLabel(stats.currentStreak)} · {t.stats.bestLabel(stats.longestStreak)}
            </span>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-5">
          <p className="text-xs font-medium text-[#756E63] dark:text-[#9A9388]">
            {t.stats.totalLinks}
          </p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold tabular-nums text-[#1F1D19] dark:text-[#F4F1EA]">
              {stats.totalLinksSaved}
            </span>
            <span className="truncate text-[11px] text-[#888074] dark:text-[#867F74]">
              {t.stats.reusableResources}
            </span>
          </div>
        </div>

        <div className="border-l border-[#EAE4D9] px-4 py-4 sm:border-l-0 sm:px-5 dark:border-[#2C2924]">
          <p className="text-xs font-medium text-[#756E63] dark:text-[#9A9388]">
            {t.stats.studyTime}
          </p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold tabular-nums text-[#1F1D19] dark:text-[#F4F1EA]">
              {t.stats.minsShort(stats.totalMinutes)}
            </span>
            <span className="truncate text-[11px] text-[#888074] dark:text-[#867F74]">
              {t.stats.thisWeek(stats.thisWeekStudyDays, WEEKLY_GOAL_DAYS)}
            </span>
          </div>
        </div>
      </section>

      {/* Random Flashback Review Card (when toggled) */}
      {flashbackEntry && (
        <section
          aria-label={t.timeline.flashbackTitle}
          className="rounded-2xl border border-[#E5D7B8] bg-[#FDF9EE] p-5 dark:border-[#3D3422] dark:bg-[#221E15]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8A6218] dark:text-[#E6BF6B]">
              <Shuffle className="h-3.5 w-3.5" />
              <span>{t.timeline.flashbackTitle}</span>
              <span className="font-normal text-[#9A8458] dark:text-[#A3916A]">
                · {formatDateHeading(flashbackEntry.date, lang).formatted}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={pickRandomFlashback}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#7A5511] transition-colors hover:bg-[#F3E7C6] dark:text-[#E6BF6B] dark:hover:bg-[#312A1C]"
              >
                {t.timeline.flashbackAnother}
              </button>
              <button
                type="button"
                onClick={() => setFlashbackEntryId(null)}
                aria-label={t.actions.close}
                className="rounded-lg p-1 text-[#8A7650] hover:bg-[#F3E7C6] dark:hover:bg-[#312A1C]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <h3 className="mt-2 font-display text-base font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
            {flashbackEntry.title}
          </h3>
          <div className="mt-2">
            <RichTakeaways text={flashbackEntry.takeaways} />
          </div>
        </section>
      )}

      {/* Search & Smart Filters */}
      <section aria-label="Search and filters" className="space-y-3">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888074] dark:text-[#867F74]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.timeline.searchPlaceholder}
              className="w-full rounded-xl border border-[#E6E0D5] bg-white py-2.5 pl-10 pr-9 text-sm text-[#1F1D19] placeholder-[#968F84] transition-colors focus:border-[#3D6B52] focus:outline-none dark:border-[#2C2924] dark:bg-[#1D1B18] dark:text-[#F4F1EA] dark:placeholder-[#6B655B] dark:focus:border-[#7EB093]"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#888074] hover:text-[#1F1D19] dark:hover:text-[#F4F1EA]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="relative sm:w-44">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888074] dark:text-[#867F74]" />
            <input
              type="date"
              aria-label={t.form.dateLabel}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-[#E6E0D5] bg-white py-2.5 pl-9 pr-3 font-mono text-xs text-[#1F1D19] transition-colors focus:border-[#3D6B52] focus:outline-none dark:border-[#2C2924] dark:bg-[#1D1B18] dark:text-[#F4F1EA] dark:focus:border-[#7EB093]"
            />
          </div>

          <select
            aria-label={t.form.moodLabel}
            value={selectedMood}
            onChange={(e) => setSelectedMood(e.target.value as MoodId | 'all')}
            className="rounded-xl border border-[#E6E0D5] bg-white px-3 py-2.5 text-xs font-medium text-[#3F3B34] transition-colors focus:border-[#3D6B52] focus:outline-none sm:w-36 dark:border-[#2C2924] dark:bg-[#1D1B18] dark:text-[#D9D3C8] dark:focus:border-[#7EB093]"
          >
            <option value="all">{t.timeline.allVibes}</option>
            {MOOD_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.emoji} {t.moods[m.id]}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter Buttons + Highlights Toggle + Random Review */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              playClick();
              setSelectedCategoryId('all');
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedCategoryId === 'all'
                ? 'bg-[#22201C] text-[#FAF8F4] dark:bg-[#EFECE6] dark:text-[#141311]'
                : 'bg-[#F1ECE2] text-[#5C564C] hover:bg-[#E7E0D3] dark:bg-[#23201C] dark:text-[#ACA59A] dark:hover:bg-[#2D2A25]'
            }`}
          >
            {t.timeline.allCategories}
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              setHighlightsOnly((prev) => !prev);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              highlightsOnly
                ? 'bg-[#C99635] text-white dark:bg-[#DFB054] dark:text-[#1A1407]'
                : 'bg-[#F1ECE2] text-[#5C564C] hover:bg-[#E7E0D3] dark:bg-[#23201C] dark:text-[#ACA59A] dark:hover:bg-[#2D2A25]'
            }`}
          >
            <Star
              className={`h-3.5 w-3.5 ${
                highlightsOnly
                  ? 'fill-current'
                  : 'text-[#B47B2B] dark:text-[#DFB054]'
              }`}
            />
            <span>{t.timeline.highlightsOnly}</span>
            {stats.highlightedCount > 0 && (
              <span className="font-mono text-[11px] tabular-nums opacity-80">
                {stats.highlightedCount}
              </span>
            )}
          </button>

          {categories.map((cat) => {
            const active = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  playClick();
                  setSelectedCategoryId((prev) => (prev === cat.id ? 'all' : cat.id));
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#22201C] text-[#FAF8F4] dark:bg-[#EFECE6] dark:text-[#141311]'
                    : 'bg-[#F1ECE2] text-[#5C564C] hover:bg-[#E7E0D3] dark:bg-[#23201C] dark:text-[#ACA59A] dark:hover:bg-[#2D2A25]'
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden="true"
                />
                <span>{cat.name}</span>
              </button>
            );
          })}

          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                playClick();
                pickRandomFlashback();
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#3D6B52] transition-colors hover:bg-[#EAF1EC] whitespace-nowrap shrink-0 dark:text-[#7EB093] dark:hover:bg-[#222F28]"
            >
              <Shuffle className="h-3.5 w-3.5" />
              <span>{t.actions.randomReview}</span>
            </button>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                playClick();
                clearAllFilters();
              }}
              className="text-xs font-medium text-[#6B6459] hover:text-[#1F1D19] hover:underline whitespace-nowrap shrink-0 dark:text-[#A39C90] dark:hover:text-[#F4F1EA]"
            >
              {t.actions.resetFilters}
            </button>
          )}
        </div>
      </section>

      {/* Timeline Content */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-[#E6E0D5] bg-white px-6 py-14 text-center dark:border-[#2C2924] dark:bg-[#1D1B18]">
          <h3 className="font-display text-lg font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
            {t.timeline.emptyTitle}
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#726B60] dark:text-[#9A9388]">
            {t.timeline.emptyDesc}
          </p>
          <button
            type="button"
            onClick={onFocusComposer}
            className="mt-5 rounded-xl bg-[#3D6B52] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#315843] dark:bg-[#7EB093] dark:text-[#121915]"
          >
            {t.timeline.emptyCta}
          </button>
        </div>
      ) : groupedByDate.length === 0 ? (
        <div className="rounded-2xl border border-[#E6E0D5] bg-white px-6 py-12 text-center dark:border-[#2C2924] dark:bg-[#1D1B18]">
          <h3 className="font-display text-base font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
            {t.timeline.noMatchTitle}
          </h3>
          <p className="mt-1 text-sm text-[#726B60] dark:text-[#9A9388]">
            {t.timeline.noMatchDesc}
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-4 rounded-xl border border-[#DDD6C9] bg-[#FAF8F4] px-4 py-2 text-xs font-semibold text-[#2E2A24] transition-colors hover:bg-[#EFEAE0] dark:border-[#34302A] dark:bg-[#161512] dark:text-[#EAE5DC] dark:hover:bg-[#26231F]"
          >
            {t.actions.clearAllFilters}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByDate.map((group) => {
            const { relative, formatted } = formatDateHeading(group.date, lang);
            return (
              <div key={group.date} className="space-y-3.5">
                {/* Date Group Header */}
                <div className="flex items-baseline justify-between gap-3 border-b border-[#EAE4D9] pb-2 dark:border-[#282520]">
                  <div className="flex items-baseline gap-2">
                    {relative && (
                      <h3 className="font-display text-base font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
                        {relative}
                      </h3>
                    )}
                    <span
                      className={
                        relative
                          ? 'text-xs font-medium text-[#7E766B] dark:text-[#918A7F]'
                          : 'font-display text-base font-semibold text-[#1F1D19] dark:text-[#F4F1EA]'
                      }
                    >
                      {formatted}
                    </span>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-[#8D8579] dark:text-[#7E776C]">
                    {t.timeline.sessionsCount(group.entries.length)}
                  </span>
                </div>

                {/* Entries for this date */}
                <div className="space-y-3.5">
                  <AnimatePresence initial={false}>
                    {group.entries.map((entry) => {
                      const moodMeta = getMoodMeta(entry.mood, lang);
                      const isEditing = editingEntryId === entry.id;
                      const isConfirmingDelete = pendingDeleteId === entry.id;
                      const entryCats = entry.categoryIds
                        .map((id) => categoryMap.get(id))
                        .filter((c): c is CategoryConfig => Boolean(c));

                      return (
                        <motion.article
                          key={entry.id}
                          layout="position"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className={`rounded-2xl border p-5 transition-colors sm:p-6 ${
                            isEditing
                              ? 'border-[#3D6B52] bg-white ring-1 ring-[#3D6B52]/20 dark:border-[#7EB093] dark:bg-[#1D1B18] dark:ring-[#7EB093]/20'
                              : entry.isHighlighted
                              ? 'border-[#E6D4AC] bg-[#FFFDF8] dark:border-[#3F3523] dark:bg-[#201D17]'
                              : 'border-[#E6E0D5] bg-white dark:border-[#2C2924] dark:bg-[#1D1B18]'
                          }`}
                        >
                          {/* Quiet unboxed metadata line + actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6B6459] dark:text-[#A39C90]">
                              {entryCats.length > 0 ? (
                                entryCats.map((cat, idx) => (
                                  <React.Fragment key={cat.id}>
                                    {idx > 0 && (
                                      <span
                                        className="text-[#C7BFAF] dark:text-[#4C463E]"
                                        aria-hidden="true"
                                      >
                                        ·
                                      </span>
                                    )}
                                    <span className="inline-flex items-center gap-1.5 font-medium text-[#3F3A33] dark:text-[#DCD6CB]">
                                      <span
                                        className="h-2 w-2 shrink-0 rounded-[2px]"
                                        style={{ backgroundColor: cat.color }}
                                        aria-hidden="true"
                                      />
                                      <span>{cat.name}</span>
                                    </span>
                                  </React.Fragment>
                                ))
                              ) : (
                                <span>{t.timeline.uncategorized}</span>
                              )}
                              <span
                                className="text-[#C7BFAF] dark:text-[#4C463E]"
                                aria-hidden="true"
                              >
                                ·
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span aria-hidden="true">{moodMeta.emoji}</span>
                                <span>{moodMeta.label}</span>
                              </span>
                              {entry.durationMinutes && (
                                <>
                                  <span
                                    className="text-[#C7BFAF] dark:text-[#4C463E]"
                                    aria-hidden="true"
                                  >
                                    ·
                                  </span>
                                  <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#756E63] dark:text-[#9A9388]">
                                    <Clock className="h-3 w-3 opacity-70" />
                                    {t.stats.minsShort(entry.durationMinutes)}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Highlight + Edit + Delete Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.85 }}
                                onClick={() => {
                                  if (!entry.isHighlighted) playHighlight();
                                  else playClick();
                                  onToggleHighlight(entry.id);
                                }}
                                aria-label={t.form.highlightEntry}
                                title={t.form.highlightEntry}
                                className={`inline-flex items-center justify-center rounded-lg p-1.5 transition-colors ${
                                  entry.isHighlighted
                                    ? 'text-[#C99635] hover:bg-[#FAF1DC] dark:text-[#DFB054] dark:hover:bg-[#312817]'
                                    : 'text-[#8D8579] hover:bg-[#F3EFE7] hover:text-[#1F1D19] dark:text-[#8E877C] dark:hover:bg-[#292621] dark:hover:text-[#F4F1EA]'
                                }`}
                              >
                                <Star
                                  className={`h-3.5 w-3.5 ${
                                    entry.isHighlighted ? 'fill-current' : ''
                                  }`}
                                />
                              </motion.button>

                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-[#888074] dark:text-[#9A9388]">
                                    {t.timeline.deleteConfirm}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      playTrash();
                                      onDelete(entry.id);
                                      setPendingDeleteId(null);
                                    }}
                                    className="rounded-lg bg-[#B8413E] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#9D3431]"
                                  >
                                    {t.actions.confirm}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      playClick();
                                      setPendingDeleteId(null);
                                    }}
                                    className="rounded-lg px-2 py-1 text-xs font-medium text-[#6B6459] hover:bg-[#F3EFE7] dark:text-[#A39C90] dark:hover:bg-[#2A2722]"
                                  >
                                    {t.actions.cancel}
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      playClick();
                                      onEdit(entry);
                                    }}
                                    aria-label={`${t.actions.edit} ${entry.title}`}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#6E675C] transition-colors hover:bg-[#F3EFE7] hover:text-[#1F1D19] dark:text-[#9C9589] dark:hover:bg-[#292621] dark:hover:text-[#F4F1EA]"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{t.actions.edit}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      playClick();
                                      setPendingDeleteId(entry.id);
                                    }}
                                    aria-label={`${t.actions.delete} ${entry.title}`}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#6E675C] transition-colors hover:bg-[#FCEEEE] hover:text-[#B8413E] dark:text-[#9C9589] dark:hover:bg-[#332020] dark:hover:text-[#E57B78]"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{t.actions.delete}</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Activity Title */}
                          <h4 className="mt-2 font-display text-lg font-semibold leading-snug text-[#1E1C18] dark:text-[#F5F2EB]">
                            {entry.title}
                          </h4>

                          {/* Satisfying Interactive Checklist */}
                          {entry.checklist && entry.checklist.length > 0 && (
                            <InteractiveChecklist
                              items={entry.checklist}
                              lang={lang}
                              onToggleItem={(itemId) =>
                                onToggleChecklistItem(entry.id, itemId)
                              }
                              onCompleteAll={onChecklistCompleteAll}
                            />
                          )}

                          {/* Key Takeaways */}
                          {entry.takeaways.trim() && (
                            <div className="mt-3">
                              <RichTakeaways text={entry.takeaways} />
                            </div>
                          )}

                        {/* Attached Photos */}
                        {entry.images && entry.images.length > 0 && (
                          <div className="mt-4">
                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                              {entry.images.map((img, idx) => (
                                <button
                                  key={img.id}
                                  type="button"
                                  onClick={() => onOpenLightbox(entry.images, idx)}
                                  className="group relative aspect-4/3 overflow-hidden rounded-xl border border-[#E6E0D5] bg-[#FAF8F4] text-left dark:border-[#2E2B26] dark:bg-[#161512]"
                                >
                                  <img
                                    src={img.dataUrl}
                                    alt={img.caption || entry.title}
                                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                  />
                                  {img.caption && (
                                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 via-black/40 to-transparent px-2.5 pb-1.5 pt-5 text-[11px] font-medium text-white">
                                      {img.caption}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Saved Links / Resources */}
                        {entry.links.length > 0 && (
                          <div className="mt-4 border-t border-[#EFEAE1] pt-3.5 dark:border-[#2A2722]">
                            <p className="mb-2 text-xs font-medium text-[#7E766B] dark:text-[#8E877C]">
                              {t.timeline.savedResources}
                            </p>
                            <ul className="space-y-1.5">
                              {entry.links.map((link) => (
                                <li key={link.id}>
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group inline-flex max-w-full items-center gap-2 rounded-lg py-0.5 text-sm text-[#2F5E46] transition-colors hover:text-[#1F4431] dark:text-[#88BC9E] dark:hover:text-[#A7D3B9]"
                                  >
                                    <Link2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                    <span className="truncate font-medium group-hover:underline">
                                      {link.label}
                                    </span>
                                    <span className="hidden truncate font-mono text-[11px] text-[#8D8579] sm:inline dark:text-[#7E776C]">
                                      {extractHostname(link.url)}
                                    </span>
                                    <ExternalLink className="h-3 w-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </motion.article>
                    );
                  })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

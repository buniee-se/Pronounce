import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { CategoryConfig, JournalEntry, SavedImage } from '../types/journal';
import { Language, TRANSLATIONS } from '../i18n/translations';
import {
  extractHostname,
  formatDateHeading,
  formatMonthYear,
  getMoodMeta,
  getTodayIso,
} from '../utils/journalUtils';
import { RichTakeaways } from './RichTakeaways';
import { InteractiveChecklist } from './InteractiveChecklist';
import { playClick, playHighlight, playTrash } from '../utils/soundEffects';

interface CalendarViewProps {
  entries: JournalEntry[];
  categories: CategoryConfig[];
  lang: Language;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entryId: string) => void;
  onToggleHighlight: (entryId: string) => void;
  onToggleChecklistItem: (entryId: string, itemId: string) => void;
  onChecklistCompleteAll: () => void;
  onAddEntryForDate: (dateIso: string) => void;
  onOpenLightbox: (images: SavedImage[], startIndex: number) => void;
}

interface CalendarCell {
  dateIso: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

function buildMonthGrid(year: number, monthIndex: number): CalendarCell[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  // Monday = 0 ... Sunday = 6
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

  const cells: CalendarCell[] = [];

  // Previous month trailing days
  for (let i = startWeekday - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const d = new Date(year, monthIndex - 1, dayNum);
    cells.push({
      dateIso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`,
      dayNumber: dayNum,
      inCurrentMonth: false,
    });
  }

  // Current month days
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    cells.push({
      dateIso: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(
        dayNum
      ).padStart(2, '0')}`,
      dayNumber: dayNum,
      inCurrentMonth: true,
    });
  }

  // Next month leading days to fill 35 or 42 cells cleanly
  const totalCells = cells.length <= 35 ? 35 : 42;
  let nextDay = 1;
  while (cells.length < totalCells) {
    const d = new Date(year, monthIndex + 1, nextDay);
    cells.push({
      dateIso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`,
      dayNumber: nextDay,
      inCurrentMonth: false,
    });
    nextDay++;
  }

  return cells;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  entries,
  categories,
  lang,
  onEdit,
  onDelete,
  onToggleHighlight,
  onToggleChecklistItem,
  onChecklistCompleteAll,
  onAddEntryForDate,
  onOpenLightbox,
}) => {
  const t = TRANSLATIONS[lang];
  const todayIso = getTodayIso();
  const [todayYear, todayMonth] = todayIso.split('-').map(Number);

  const [viewYear, setViewYear] = useState<number>(todayYear);
  const [viewMonth, setViewMonth] = useState<number>(todayMonth - 1); // 0-indexed
  const [slideDir, setSlideDir] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [highlightsOnly, setHighlightsOnly] = useState<boolean>(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  // Map dateIso -> entries[]
  const entriesByDate = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const entry of entries) {
      if (highlightsOnly && !entry.isHighlighted) continue;
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return map;
  }, [entries, highlightsOnly]);

  const monthCells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const monthSummary = useMemo(() => {
    const daySet = new Set<string>();
    let sessions = 0;
    let highlights = 0;
    let minutes = 0;

    for (const entry of entries) {
      if (entry.date.startsWith(monthPrefix)) {
        daySet.add(entry.date);
        sessions++;
        if (entry.isHighlighted) highlights++;
        if (entry.durationMinutes) minutes += entry.durationMinutes;
      }
    }
    return {
      daysLogged: daySet.size,
      sessions,
      highlights,
      minutes,
    };
  }, [entries, monthPrefix]);

  const selectedDayEntries = useMemo(() => {
    const list = entriesByDate.get(selectedDate) ?? [];
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [entriesByDate, selectedDate]);

  const goToPrevMonth = () => {
    playClick();
    setSlideDir(-1);
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    playClick();
    setSlideDir(1);
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    playClick();
    setSlideDir(0);
    setViewYear(todayYear);
    setViewMonth(todayMonth - 1);
    setSelectedDate(todayIso);
  };

  // Keyboard Left/Right navigation for flipping months smoothly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') goToPrevMonth();
      if (e.key === 'ArrowRight') goToNextMonth();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMonth, viewYear]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0) goToNextMonth();
      else goToPrevMonth();
    }
  };

  const handleSelectCell = (cell: CalendarCell) => {
    playClick();
    setSelectedDate(cell.dateIso);
    if (!cell.inCurrentMonth) {
      const [y, m] = cell.dateIso.split('-').map(Number);
      setSlideDir(cell.dateIso > `${monthPrefix}-15` ? 1 : -1);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  };

  const { relative: selectedRelative, formatted: selectedFormatted } = formatDateHeading(
    selectedDate,
    lang
  );

  return (
    <div className="space-y-6">
      {/* Header + Month Stats Strip */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#1F1D19] dark:text-[#F4F1EA]">
            {t.calendar.title}
          </h1>
          <p className="mt-1 text-sm text-[#726B60] dark:text-[#9A9388]">
            {t.calendar.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHighlightsOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              highlightsOnly
                ? 'border-[#C99635] bg-[#C99635]/15 text-[#7A5511] dark:border-[#DFB054] dark:bg-[#DFB054]/15 dark:text-[#F4D28A]'
                : 'border-[#E4DDD2] bg-white text-[#5C554B] hover:bg-[#F3EFE7] dark:border-[#2E2B26] dark:bg-[#1D1B18] dark:text-[#ACA59A] dark:hover:bg-[#26231F]'
            }`}
          >
            <Star
              className={`h-3.5 w-3.5 ${highlightsOnly ? 'fill-current' : ''}`}
            />
            <span>{t.timeline.highlightsOnly}</span>
          </button>

          <button
            type="button"
            onClick={goToToday}
            className="rounded-xl border border-[#E4DDD2] bg-white px-3 py-2 text-xs font-medium text-[#3F3A33] transition-colors hover:bg-[#F3EFE7] whitespace-nowrap dark:border-[#2E2B26] dark:bg-[#1D1B18] dark:text-[#DCD6CB] dark:hover:bg-[#26231F]"
          >
            {t.actions.today}
          </button>
        </div>
      </div>

      {/* Main 2-column Calendar + Day Entries List */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* Left: Swipeable Monthly Calendar */}
        <section
          aria-label={t.calendar.title}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="overflow-hidden rounded-2xl border border-[#E6E0D5] bg-white p-4 sm:p-6 dark:border-[#2C2924] dark:bg-[#1D1B18]"
        >
          {/* Month Navigation Header */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label={t.calendar.prevMonth}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E0D5] bg-[#FAF8F4] text-[#46423A] transition-colors hover:bg-[#EFEAE0] dark:border-[#312D27] dark:bg-[#161512] dark:text-[#C8C2B8] dark:hover:bg-[#27241F]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-center">
              <h2 className="font-display text-lg font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
                {formatMonthYear(viewYear, viewMonth, lang)}
              </h2>
              <p className="text-[11px] text-[#8D8579] dark:text-[#867F74]">
                {t.calendar.swipeHint}
              </p>
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              aria-label={t.calendar.nextMonth}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E0D5] bg-[#FAF8F4] text-[#46423A] transition-colors hover:bg-[#EFEAE0] dark:border-[#312D27] dark:bg-[#161512] dark:text-[#C8C2B8] dark:hover:bg-[#27241F]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Month Quick Metrics */}
          <div className="mb-4 grid grid-cols-4 divide-x divide-[#ECE6DC] rounded-xl border border-[#ECE6DC] bg-[#FAF8F4] py-2.5 text-center dark:divide-[#2A2722] dark:border-[#2A2722] dark:bg-[#161512]">
            <div>
              <p className="font-mono text-sm font-semibold tabular-nums text-[#1F1D19] dark:text-[#F4F1EA]">
                {monthSummary.daysLogged}
              </p>
              <p className="text-[11px] text-[#7E766B] dark:text-[#8E877C]">
                {t.calendar.monthDaysLogged}
              </p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold tabular-nums text-[#1F1D19] dark:text-[#F4F1EA]">
                {monthSummary.sessions}
              </p>
              <p className="text-[11px] text-[#7E766B] dark:text-[#8E877C]">
                {t.calendar.monthSessions}
              </p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold tabular-nums text-[#B47B2B] dark:text-[#DFB054]">
                {monthSummary.highlights}
              </p>
              <p className="text-[11px] text-[#7E766B] dark:text-[#8E877C]">
                {t.calendar.monthHighlights}
              </p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold tabular-nums text-[#3D6B52] dark:text-[#7EB093]">
                {t.stats.minsShort(monthSummary.minutes)}
              </p>
              <p className="text-[11px] text-[#7E766B] dark:text-[#8E877C]">
                {t.calendar.monthMinutes}
              </p>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="mb-1.5 grid grid-cols-7 gap-1 text-center">
            {t.calendar.weekdays.map((day) => (
              <div
                key={day}
                className="py-1 text-xs font-medium text-[#888074] dark:text-[#867F74]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Animated Month Grid */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={monthPrefix}
              initial={{ opacity: 0, x: slideDir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -slideDir * 24 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-7 gap-1.5"
            >
              {monthCells.map((cell) => {
                const dayEntries = entriesByDate.get(cell.dateIso) ?? [];
                const isSelected = selectedDate === cell.dateIso;
                const isToday = cell.dateIso === todayIso;
                const hasHighlight = dayEntries.some((e) => e.isHighlighted);
                const hasPhotos = dayEntries.some((e) => e.images.length > 0);
                const topMood = dayEntries[0]
                  ? getMoodMeta(dayEntries[0].mood, lang).emoji
                  : null;

                // Collect unique category colors for that day (max 3 indicators)
                const colorDots: string[] = [];
                for (const e of dayEntries) {
                  for (const cid of e.categoryIds) {
                    const col = categoryMap.get(cid)?.color;
                    if (col && !colorDots.includes(col) && colorDots.length < 3) {
                      colorDots.push(col);
                    }
                  }
                }

                return (
                  <button
                    key={cell.dateIso}
                    type="button"
                    onClick={() => handleSelectCell(cell)}
                    className={`group relative flex min-h-[64px] flex-col justify-between rounded-xl border p-2 text-left transition-colors sm:min-h-[76px] ${
                      isSelected
                        ? 'border-[#3D6B52] bg-[#3D6B52]/10 dark:border-[#7EB093] dark:bg-[#7EB093]/15'
                        : cell.inCurrentMonth
                        ? dayEntries.length > 0
                          ? 'border-[#E6E0D5] bg-[#FAF8F4] hover:border-[#CFC7B9] dark:border-[#2E2B26] dark:bg-[#171613] dark:hover:border-[#464139]'
                          : 'border-transparent bg-transparent hover:border-[#EAE4D9] hover:bg-[#FAF8F4]/70 dark:hover:border-[#2A2722] dark:hover:bg-[#171613]/60'
                        : 'border-transparent opacity-40 hover:opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-lg font-mono text-xs tabular-nums ${
                          isToday
                            ? 'bg-[#3D6B52] font-semibold text-white dark:bg-[#7EB093] dark:text-[#121915]'
                            : isSelected
                            ? 'font-semibold text-[#1F1D19] dark:text-[#F4F1EA]'
                            : 'text-[#46423A] dark:text-[#C4BEB3]'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {hasHighlight ? (
                        <Star
                          className="h-3.5 w-3.5 shrink-0 fill-[#C99635] text-[#C99635] dark:fill-[#DFB054] dark:text-[#DFB054]"
                          aria-label={t.calendar.legendHighlight}
                        />
                      ) : topMood ? (
                        <span className="text-xs leading-none" aria-hidden="true">
                          {topMood}
                        </span>
                      ) : null}
                    </div>

                    {/* Bottom category color bars + photo indicator */}
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        {colorDots.map((color, idx) => (
                          <span
                            key={idx}
                            className="h-1.5 w-3 rounded-full"
                            style={{ backgroundColor: color }}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                      {hasPhotos && (
                        <ImageIcon
                          className="h-3 w-3 shrink-0 text-[#888074] dark:text-[#867F74]"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Right: Selected Day Entries List */}
        <section
          aria-label="Selected day entries"
          className="rounded-2xl border border-[#E6E0D5] bg-white p-5 sm:p-6 dark:border-[#2C2924] dark:bg-[#1D1B18]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ECE6DC] pb-4 dark:border-[#2A2722]">
            <div>
              <div className="flex items-baseline gap-2">
                {selectedRelative && (
                  <h2 className="font-display text-lg font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
                    {selectedRelative}
                  </h2>
                )}
                <span
                  className={
                    selectedRelative
                      ? 'text-xs font-medium text-[#7E766B] dark:text-[#918A7F]'
                      : 'font-display text-lg font-semibold text-[#1F1D19] dark:text-[#F4F1EA]'
                  }
                >
                  {selectedFormatted}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-[#888074] dark:text-[#867F74]">
                {t.timeline.sessionsCount(selectedDayEntries.length)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onAddEntryForDate(selectedDate)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3D6B52] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#315843] whitespace-nowrap shrink-0 dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.actions.logForDate}</span>
            </button>
          </div>

          {selectedDayEntries.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-display text-base font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
                {t.calendar.noEntriesOnDay}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[#756E63] dark:text-[#9A9388]">
                {t.calendar.noEntriesHint}
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#EFEAE1] dark:divide-[#2A2722]">
              {selectedDayEntries.map((entry) => {
                const moodMeta = getMoodMeta(entry.mood, lang);
                const isConfirming = pendingDeleteId === entry.id;
                const entryCats = entry.categoryIds
                  .map((id) => categoryMap.get(id))
                  .filter((c): c is CategoryConfig => Boolean(c));

                return (
                  <article key={entry.id} className="py-4 first:pt-1 last:pb-0">
                    {/* Metadata + controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6B6459] dark:text-[#A39C90]">
                        {entryCats.length > 0 ? (
                          entryCats.map((cat, idx) => (
                            <React.Fragment key={cat.id}>
                              {idx > 0 && <span aria-hidden="true">·</span>}
                              <span className="inline-flex items-center gap-1.5 font-medium text-[#3F3A33] dark:text-[#DCD6CB]">
                                <span
                                  className="h-2 w-2 rounded-[2px]"
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
                        <span aria-hidden="true">·</span>
                        <span>
                          {moodMeta.emoji} {moodMeta.label}
                        </span>
                        {entry.durationMinutes && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <Clock className="h-3 w-3 opacity-70" />
                              {t.stats.minsShort(entry.durationMinutes)}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (!entry.isHighlighted) playHighlight();
                            else playClick();
                            onToggleHighlight(entry.id);
                          }}
                          aria-label={t.form.highlightEntry}
                          className={`rounded-lg p-1.5 transition-colors ${
                            entry.isHighlighted
                              ? 'text-[#C99635] hover:bg-[#FAF3E2] dark:text-[#DFB054] dark:hover:bg-[#2F2719]'
                              : 'text-[#8D8579] hover:bg-[#F3EFE7] hover:text-[#1F1D19] dark:hover:bg-[#292621] dark:hover:text-[#F4F1EA]'
                          }`}
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${
                              entry.isHighlighted ? 'fill-current' : ''
                            }`}
                          />
                        </button>

                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                playTrash();
                                onDelete(entry.id);
                                setPendingDeleteId(null);
                              }}
                              className="rounded-lg bg-[#B8413E] px-2 py-1 text-xs font-medium text-white"
                            >
                              {t.actions.confirm}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playClick();
                                setPendingDeleteId(null);
                              }}
                              className="rounded-lg px-2 py-1 text-xs font-medium text-[#6B6459] dark:text-[#A39C90]"
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
                              aria-label={t.actions.edit}
                              className="rounded-lg p-1.5 text-[#756E63] hover:bg-[#F3EFE7] hover:text-[#1F1D19] dark:text-[#9A9388] dark:hover:bg-[#292621] dark:hover:text-[#F4F1EA]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playClick();
                                setPendingDeleteId(entry.id);
                              }}
                              aria-label={t.actions.delete}
                              className="rounded-lg p-1.5 text-[#756E63] hover:bg-[#FCEEEE] hover:text-[#B8413E] dark:text-[#9A9388] dark:hover:bg-[#332020] dark:hover:text-[#E57B78]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-1.5 font-display text-base font-semibold text-[#1E1C18] dark:text-[#F5F2EB]">
                      {entry.title}
                    </h3>

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

                    {entry.takeaways.trim() && (
                      <div className="mt-2.5">
                        <RichTakeaways text={entry.takeaways} />
                      </div>
                    )}

                    {/* Attached Photos */}
                    {entry.images.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {entry.images.map((img, idx) => (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => onOpenLightbox(entry.images, idx)}
                            className="group relative aspect-4/3 overflow-hidden rounded-xl border border-[#E6E0D5] bg-[#FAF8F4] dark:border-[#2E2B26] dark:bg-[#161512]"
                          >
                            <img
                              src={img.dataUrl}
                              alt={img.caption || entry.title}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Links */}
                    {entry.links.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {entry.links.map((link) => (
                          <li key={link.id}>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex max-w-full items-center gap-1.5 text-xs text-[#2F5E46] hover:underline dark:text-[#88BC9E]"
                            >
                              <Link2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                              <span className="truncate font-medium">{link.label}</span>
                              <span className="hidden truncate font-mono text-[10px] text-[#8D8579] sm:inline">
                                ({extractHostname(link.url)})
                              </span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

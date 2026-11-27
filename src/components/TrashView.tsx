import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { CategoryConfig, JournalEntry } from '../types/journal';
import { Language, TRANSLATIONS } from '../i18n/translations';
import { formatDateHeading, getMoodMeta } from '../utils/journalUtils';
import { RichTakeaways } from './RichTakeaways';
import { playClick, playSave, playTrash } from '../utils/soundEffects';

interface TrashViewProps {
  lang: Language;
  trashedEntries: JournalEntry[];
  categories: CategoryConfig[];
  onRestore: (entryId: string) => void;
  onRestoreAll: () => void;
  onDeleteForever: (entryId: string) => void;
  onEmptyTrash: () => void;
  onGoToTimeline: () => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  lang,
  trashedEntries,
  categories,
  onRestore,
  onRestoreAll,
  onDeleteForever,
  onEmptyTrash,
  onGoToTimeline,
}) => {
  const t = TRANSLATIONS[lang];
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const sortedTrash = useMemo(
    () =>
      [...trashedEntries].sort((a, b) =>
        (b.deletedAt ?? b.updatedAt).localeCompare(a.deletedAt ?? a.updatedAt)
      ),
    [trashedEntries]
  );

  const formatDeletedTimestamp = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#1F1D19] dark:text-[#F4F1EA]">
            {t.trash.title}
          </h1>
          <p className="mt-1 text-sm text-[#726B60] dark:text-[#9A9388]">
            {t.trash.subtitle}
          </p>
        </div>

        {sortedTrash.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playSave();
                onRestoreAll();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDD6C9] bg-white px-3.5 py-2 text-xs font-semibold text-[#2E2A24] transition-colors hover:bg-[#F3EFE7] whitespace-nowrap dark:border-[#34302A] dark:bg-[#1D1B18] dark:text-[#EAE5DC] dark:hover:bg-[#27241F]"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#3D6B52] dark:text-[#7EB093]" />
              <span>{t.trash.restoreAll}</span>
            </motion.button>

            {confirmEmpty ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-[#ECD3D2] bg-white px-3 py-1.5 text-xs dark:border-[#492928] dark:bg-[#1D1B18]">
                <span className="text-[#8F2B28] dark:text-[#E57B78]">
                  {t.trash.confirmEmpty(sortedTrash.length)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playTrash();
                    onEmptyTrash();
                    setConfirmEmpty(false);
                  }}
                  className="rounded-lg bg-[#B8413E] px-2.5 py-1 font-medium text-white hover:bg-[#9D3431]"
                >
                  {t.actions.confirm}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setConfirmEmpty(false);
                  }}
                  className="rounded-lg px-2 py-1 font-medium text-[#6B6459] hover:bg-[#F3EFE7] dark:text-[#A39C90] dark:hover:bg-[#2A2722]"
                >
                  {t.actions.cancel}
                </button>
              </div>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  playClick();
                  setConfirmEmpty(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECD3D2] bg-white px-3.5 py-2 text-xs font-semibold text-[#B8413E] transition-colors hover:bg-[#FCEEEE] whitespace-nowrap dark:border-[#492928] dark:bg-[#1D1B18] dark:text-[#E57B78] dark:hover:bg-[#332020]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t.trash.emptyTrash}</span>
              </motion.button>
            )}
          </div>
        )}
      </div>

      {sortedTrash.length === 0 ? (
        <div className="rounded-2xl border border-[#E6E0D5] bg-white px-6 py-16 text-center dark:border-[#2C2924] dark:bg-[#1D1B18]">
          <h2 className="font-display text-lg font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
            {t.trash.emptyTitle}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#726B60] dark:text-[#9A9388]">
            {t.trash.emptyDesc}
          </p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              playClick();
              onGoToTimeline();
            }}
            className="mt-5 rounded-xl bg-[#3D6B52] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#315843] dark:bg-[#7EB093] dark:text-[#121915]"
          >
            {t.trash.backToJournal}
          </motion.button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <p className="font-mono text-xs tabular-nums text-[#7E766B] dark:text-[#8E877C]">
            {t.trash.count(sortedTrash.length)}
          </p>

          <AnimatePresence initial={false}>
            {sortedTrash.map((entry) => {
              const moodMeta = getMoodMeta(entry.mood, lang);
              const { formatted } = formatDateHeading(entry.date, lang);
              const entryCats = entry.categoryIds
                .map((id) => categoryMap.get(id))
                .filter((c): c is CategoryConfig => Boolean(c));
              const isConfirming = confirmId === entry.id;

              return (
                <motion.article
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-2xl border border-[#E6E0D5] bg-white p-5 sm:p-6 dark:border-[#2C2924] dark:bg-[#1D1B18]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#756E63] dark:text-[#9A9388]">
                      <span className="font-mono tabular-nums">{formatted}</span>
                      <span aria-hidden="true">·</span>
                      {entryCats.length > 0 ? (
                        entryCats.map((cat, idx) => (
                          <React.Fragment key={cat.id}>
                            {idx > 0 && <span aria-hidden="true">·</span>}
                            <span className="inline-flex items-center gap-1.5 font-medium text-[#4A443C] dark:text-[#CFC9BE]">
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
                      {entry.deletedAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#968E82] dark:text-[#7D766B]">
                            {t.trash.deletedOn(formatDeletedTimestamp(entry.deletedAt))}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          playSave();
                          onRestore(entry.id);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#3D6B52] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#315843] whitespace-nowrap dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{t.trash.restore}</span>
                      </motion.button>

                      {isConfirming ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              playTrash();
                              onDeleteForever(entry.id);
                              setConfirmId(null);
                            }}
                            className="rounded-lg bg-[#B8413E] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#9D3431]"
                          >
                            {t.trash.confirmForever}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              setConfirmId(null);
                            }}
                            className="rounded-lg px-2 py-1.5 text-xs font-medium text-[#6B6459] hover:bg-[#F3EFE7] dark:text-[#A39C90] dark:hover:bg-[#2A2722]"
                          >
                            {t.actions.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            setConfirmId(entry.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#ECD3D2] px-2.5 py-1.5 text-xs font-medium text-[#B8413E] transition-colors hover:bg-[#FCEEEE] whitespace-nowrap dark:border-[#492928] dark:text-[#E57B78] dark:hover:bg-[#332020]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{t.trash.deleteForever}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="mt-2 font-display text-lg font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
                    {entry.title}
                  </h3>

                  {entry.takeaways.trim() && (
                    <div className="mt-2.5 opacity-85">
                      <RichTakeaways text={entry.takeaways} />
                    </div>
                  )}
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

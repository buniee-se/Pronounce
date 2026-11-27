import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { ChecklistItem } from '../types/journal';
import { Language, TRANSLATIONS } from '../i18n/translations';
import { playCheck, playCompleteAll, playUncheck } from '../utils/soundEffects';

interface InteractiveChecklistProps {
  items: ChecklistItem[];
  lang: Language;
  onToggleItem: (itemId: string) => void;
  onCompleteAll?: () => void;
}

const BURST_ANGLES = [0, 60, 120, 180, 240, 300];

export const InteractiveChecklist: React.FC<InteractiveChecklistProps> = ({
  items,
  lang,
  onToggleItem,
  onCompleteAll,
}) => {
  const t = TRANSLATIONS[lang];
  const [burstItemId, setBurstItemId] = useState<string | null>(null);

  if (!items || items.length === 0) return null;

  const doneCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const isAllDone = doneCount === totalCount && totalCount > 0;
  const progressRatio = totalCount > 0 ? doneCount / totalCount : 0;

  const handleToggle = (item: ChecklistItem) => {
    const willBeDone = !item.done;
    const nextDoneCount = doneCount + (willBeDone ? 1 : -1);

    if (willBeDone) {
      setBurstItemId(item.id);
      window.setTimeout(() => {
        setBurstItemId((curr) => (curr === item.id ? null : curr));
      }, 450);

      if (nextDoneCount === totalCount) {
        playCompleteAll();
        onCompleteAll?.();
      } else {
        playCheck();
      }
    } else {
      playUncheck();
    }

    onToggleItem(item.id);
  };

  return (
    <div className="mt-3.5 rounded-xl border border-[#ECE6DC] bg-[#FAF8F4]/75 p-3.5 dark:border-[#2A2722] dark:bg-[#161512]/80">
      {/* Header & animated progress bar */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#6B6459] dark:text-[#9C9589]">
          {t.form.checklistLabel}
        </span>
        <span
          className={`inline-flex items-center gap-1 font-mono text-[11px] font-medium tabular-nums transition-colors ${
            isAllDone
              ? 'text-[#3D6B52] dark:text-[#7EB093]'
              : 'text-[#877F73] dark:text-[#867F74]'
          }`}
        >
          {isAllDone && <CheckCircle2 className="h-3.5 w-3.5" />}
          <span>
            {isAllDone
              ? t.form.checklistAllDone
              : t.form.checklistProgress(doneCount, totalCount)}
          </span>
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[#EAE4D9] dark:bg-[#27241F]">
        <motion.div
          className="h-full origin-left rounded-full bg-[#3D6B52] dark:bg-[#7EB093]"
          initial={false}
          animate={{ scaleX: progressRatio }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Interactive tasks */}
      <ul className="space-y-1.5">
        {items.map((item) => {
          const isBursting = burstItemId === item.id;
          return (
            <li key={item.id}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => handleToggle(item)}
                className="group flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-[#F2EDE4]/80 dark:hover:bg-[#23201C]"
              >
                {/* Animated tactile checkbox + micro burst */}
                <span className="relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                  <motion.span
                    animate={
                      item.done
                        ? { scale: [1, 1.22, 0.96, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors ${
                      item.done
                        ? 'border-[#3D6B52] bg-[#3D6B52] text-white dark:border-[#7EB093] dark:bg-[#7EB093] dark:text-[#121915]'
                        : 'border-[#CFC7B9] bg-white group-hover:border-[#3D6B52] dark:border-[#423D36] dark:bg-[#1D1B18] dark:group-hover:border-[#7EB093]'
                    }`}
                  >
                    <svg
                      viewBox="0 0 12 10"
                      fill="none"
                      className="h-2.5 w-3"
                      aria-hidden="true"
                    >
                      <motion.path
                        d="M1.5 5.2L4.5 8.2L10.5 1.8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={false}
                        animate={{
                          pathLength: item.done ? 1 : 0,
                          opacity: item.done ? 1 : 0,
                        }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </svg>
                  </motion.span>

                  {/* Tiny celebratory radial sparkles when checked */}
                  {isBursting &&
                    BURST_ANGLES.map((deg) => {
                      const rad = (deg * Math.PI) / 180;
                      const tx = Math.cos(rad) * 14;
                      const ty = Math.sin(rad) * 14;
                      return (
                        <motion.span
                          key={deg}
                          initial={{ opacity: 1, x: 0, y: 0, scale: 0.6 }}
                          animate={{ opacity: 0, x: tx, y: ty, scale: 1.1 }}
                          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-[#3D6B52] dark:bg-[#7EB093]"
                          aria-hidden="true"
                        />
                      );
                    })}
                </span>

                <span
                  className={`text-[13.5px] leading-snug transition-colors ${
                    item.done
                      ? 'text-[#968E82] line-through decoration-[#3D6B52]/50 dark:text-[#756E64] dark:decoration-[#7EB093]/50'
                      : 'text-[#2B2823] dark:text-[#E5E0D6]'
                  }`}
                >
                  {item.text}
                </span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

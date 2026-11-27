import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Pause, Play, PlusCircle, RotateCcw, X } from 'lucide-react';
import { Language, TRANSLATIONS } from '../i18n/translations';
import { playClick, playCompleteAll, playSave } from '../utils/soundEffects';

interface FocusTimerProps {
  lang: Language;
  onLogDuration: (minutes: number) => void;
  onClose: () => void;
}

const PRESETS = [
  { id: 'focus15', mode: 'focus' as const, minutes: 15 },
  { id: 'focus25', mode: 'focus' as const, minutes: 25 },
  { id: 'focus45', mode: 'focus' as const, minutes: 45 },
  { id: 'break5', mode: 'break' as const, minutes: 5 },
];

export const FocusTimer: React.FC<FocusTimerProps> = ({
  lang,
  onLogDuration,
  onClose,
}) => {
  const t = TRANSLATIONS[lang];
  const [selectedMinutes, setSelectedMinutes] = useState<number>(25);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          setCompleted(true);
          playCompleteAll();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning]);

  const handleSelectPreset = (minutes: number, nextMode: 'focus' | 'break') => {
    playClick();
    setIsRunning(false);
    setCompleted(false);
    setSelectedMinutes(minutes);
    setMode(nextMode);
    setSecondsLeft(minutes * 60);
  };

  const handleReset = () => {
    playClick();
    setIsRunning(false);
    setCompleted(false);
    setSecondsLeft(selectedMinutes * 60);
  };

  const elapsedMinutes = Math.max(
    1,
    Math.round((selectedMinutes * 60 - secondsLeft) / 60)
  );
  const displayMins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const displaySecs = String(secondsLeft % 60).padStart(2, '0');
  const progressPct = Math.min(
    100,
    Math.max(0, ((selectedMinutes * 60 - secondsLeft) / (selectedMinutes * 60)) * 100)
  );

  return (
    <div className="mb-6 rounded-2xl border border-[#E6E0D5] bg-white p-4 sm:px-5 sm:py-4 dark:border-[#2C2924] dark:bg-[#1D1B18]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Timer readout & mode presets */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-[#3D6B52] dark:text-[#7EB093]" />
            <span className="font-mono text-2xl font-semibold tabular-nums text-[#1F1D19] dark:text-[#F4F1EA]">
              {displayMins}:{displaySecs}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#F4F0E8] p-1 dark:bg-[#151411]">
            {PRESETS.map((p) => {
              const active = selectedMinutes === p.minutes && mode === p.mode;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.minutes, p.mode)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white text-[#1F1D19] shadow-xs dark:bg-[#292621] dark:text-[#F4F1EA]'
                      : 'text-[#6D665B] hover:text-[#1F1D19] dark:text-[#9A9388] dark:hover:text-[#F4F1EA]'
                  }`}
                >
                  {p.mode === 'break'
                    ? `${t.timer.shortBreak} ${p.minutes}m`
                    : `${p.minutes}m`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              playClick();
              if (secondsLeft === 0) {
                setSecondsLeft(selectedMinutes * 60);
                setCompleted(false);
              }
              setIsRunning((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#3D6B52] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#315843] whitespace-nowrap dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
          >
            {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isRunning ? t.timer.pause : t.timer.start}</span>
          </motion.button>

          <button
            type="button"
            onClick={handleReset}
            aria-label={t.timer.reset}
            className="inline-flex items-center justify-center rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] p-2 text-[#5E584E] transition-colors hover:bg-[#EFEAE0] dark:border-[#312D27] dark:bg-[#161512] dark:text-[#A39C90] dark:hover:bg-[#26231F]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {mode === 'focus' && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playSave();
                onLogDuration(completed ? selectedMinutes : elapsedMinutes);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8D0C2] bg-white px-3 py-2 text-xs font-medium text-[#2E2A24] transition-colors hover:bg-[#F3EFE7] whitespace-nowrap dark:border-[#34302A] dark:bg-[#24211D] dark:text-[#EAE5DC] dark:hover:bg-[#2E2B26]"
            >
              <PlusCircle className="h-3.5 w-3.5 text-[#3D6B52] dark:text-[#7EB093]" />
              <span>
                {t.timer.logTime(completed ? selectedMinutes : elapsedMinutes)}
              </span>
            </motion.button>
          )}

          <button
            type="button"
            onClick={() => {
              playClick();
              onClose();
            }}
            aria-label={t.actions.close}
            className="ml-auto rounded-lg p-1.5 text-[#888074] hover:bg-[#F3EFE7] hover:text-[#1F1D19] sm:ml-0 dark:hover:bg-[#292621] dark:hover:text-[#F4F1EA]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Subtle progress bar */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[#EFEAE1] dark:bg-[#282520]">
        <div
          className="h-full rounded-full bg-[#3D6B52] transition-all duration-300 dark:bg-[#7EB093]"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {completed && (
        <p className="mt-2 text-xs font-medium text-[#3D6B52] dark:text-[#7EB093]">
          {t.timer.completed}
        </p>
      )}
    </div>
  );
};

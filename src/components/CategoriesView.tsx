import React, { useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { CategoryConfig, JournalEntry } from '../types/journal';
import { COLOR_SWATCHES } from '../data/defaults';
import { Language, TRANSLATIONS } from '../i18n/translations';

interface CategoriesViewProps {
  lang: Language;
  categories: CategoryConfig[];
  entries: JournalEntry[];
  onAddCategory: (name: string, color: string) => void;
  onUpdateCategory: (
    id: string,
    updates: Partial<Pick<CategoryConfig, 'name' | 'color'>>
  ) => void;
  onDeleteCategory: (id: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  lang,
  categories,
  entries,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const t = TRANSLATIONS[lang];
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_SWATCHES[0].hex);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const usageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const catId of entry.categoryIds) {
        counts.set(catId, (counts.get(catId) ?? 0) + 1);
      }
    }
    return counts;
  }, [entries]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = newName.trim();
    if (!trimmed) {
      setError(t.categories.errEmpty);
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(t.categories.errDuplicate);
      return;
    }
    onAddCategory(trimmed, newColor);
    setNewName('');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#1F1D19] dark:text-[#F4F1EA]">
          {t.categories.title}
        </h1>
        <p className="mt-1 text-sm text-[#726B60] dark:text-[#9A9388]">
          {t.categories.subtitle}
        </p>
      </div>

      {/* Add new category form */}
      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-[#E6E0D5] bg-white p-5 dark:border-[#2C2924] dark:bg-[#1D1B18]"
      >
        <h2 className="font-display text-sm font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
          {t.categories.addTitle}
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (error) setError('');
            }}
            placeholder={t.categories.addPlaceholder}
            maxLength={32}
            className="flex-1 rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#1F1D19] placeholder-[#9A9388] focus:border-[#3D6B52] focus:bg-white focus:outline-none dark:border-[#312D27] dark:bg-[#161512] dark:text-[#F4F1EA] dark:placeholder-[#6B655B] dark:focus:border-[#7EB093] dark:focus:bg-[#1D1B18]"
          />
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] px-3 py-2 text-xs font-medium text-[#5A544A] dark:border-[#312D27] dark:bg-[#161512] dark:text-[#B5AEA2]">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="font-mono uppercase">{newColor}</span>
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3D6B52] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#315843] whitespace-nowrap shrink-0 dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
            >
              <Plus className="h-4 w-4" />
              <span>{t.categories.addBtn}</span>
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#888074] dark:text-[#867F74]">
            {t.categories.presets}
          </span>
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.hex}
              type="button"
              title={swatch.name}
              aria-label={swatch.name}
              onClick={() => setNewColor(swatch.hex)}
              className="flex h-5 w-5 items-center justify-center rounded-md transition-transform hover:scale-110"
              style={{ backgroundColor: swatch.hex }}
            >
              {newColor.toLowerCase() === swatch.hex.toLowerCase() && (
                <Check className="h-3 w-3 text-white" />
              )}
            </button>
          ))}
        </div>
        {error && (
          <p className="mt-2 text-xs font-medium text-[#B8413E] dark:text-[#E57B78]">{error}</p>
        )}
      </form>

      {/* Existing Categories List */}
      <div className="divide-y divide-[#ECE6DC] rounded-2xl border border-[#E6E0D5] bg-white dark:divide-[#2A2722] dark:border-[#2C2924] dark:bg-[#1D1B18]">
        {categories.map((cat) => {
          const count = usageCounts.get(cat.id) ?? 0;
          const isConfirming = pendingDeleteId === cat.id;

          return (
            <div key={cat.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className="h-4 w-4 shrink-0 rounded-[4px]"
                    style={{ backgroundColor: cat.color }}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label={cat.name}
                    value={cat.name}
                    onChange={(e) => onUpdateCategory(cat.id, { name: e.target.value })}
                    maxLength={32}
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-[#1F1D19] transition-colors hover:border-[#E4DDD2] focus:border-[#3D6B52] focus:bg-[#FAF8F4] focus:outline-none dark:text-[#F4F1EA] dark:hover:border-[#312D27] dark:focus:border-[#7EB093] dark:focus:bg-[#161512]"
                  />
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-xs tabular-nums text-[#888074] dark:text-[#867F74]">
                    {t.categories.entriesUsage(count)}
                  </span>

                  {categories.length > 1 && (
                    <>
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteCategory(cat.id);
                              setPendingDeleteId(null);
                            }}
                            className="rounded-lg bg-[#B8413E] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#9D3431]"
                          >
                            {t.actions.delete}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-[#6B6459] hover:bg-[#F3EFE7] dark:text-[#A39C90] dark:hover:bg-[#2A2722]"
                          >
                            {t.actions.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(cat.id)}
                          aria-label={`${t.actions.delete} ${cat.name}`}
                          className="rounded-lg p-1.5 text-[#888074] transition-colors hover:bg-[#FCEEEE] hover:text-[#B8413E] dark:hover:bg-[#332020] dark:hover:text-[#E57B78]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pl-7">
                {COLOR_SWATCHES.map((swatch) => {
                  const active = cat.color.toLowerCase() === swatch.hex.toLowerCase();
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      title={swatch.name}
                      aria-label={swatch.name}
                      onClick={() => onUpdateCategory(cat.id, { color: swatch.hex })}
                      className="flex h-6 w-6 items-center justify-center rounded-md transition-transform hover:scale-105"
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {active && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  );
                })}
                <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#E4DDD2] bg-[#FAF8F4] px-2 py-1 text-[11px] font-medium text-[#5A544A] dark:border-[#312D27] dark:bg-[#161512] dark:text-[#B5AEA2]">
                  <input
                    type="color"
                    value={cat.color}
                    onChange={(e) => onUpdateCategory(cat.id, { color: e.target.value })}
                    className="h-3.5 w-3.5 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="font-mono uppercase">{cat.color}</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

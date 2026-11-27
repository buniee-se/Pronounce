import React, { useMemo, useState } from 'react';
import { ExternalLink, Link2, Search, X } from 'lucide-react';
import { CategoryConfig, JournalEntry } from '../types/journal';
import { Language, TRANSLATIONS } from '../i18n/translations';
import { extractHostname, formatDateHeading } from '../utils/journalUtils';

interface ResourcesViewProps {
  lang: Language;
  entries: JournalEntry[];
  categories: CategoryConfig[];
  onGoToTimeline: () => void;
}

interface FlattenedResource {
  id: string;
  label: string;
  url: string;
  hostname: string;
  date: string;
  entryTitle: string;
  categoryIds: string[];
}

export const ResourcesView: React.FC<ResourcesViewProps> = ({
  lang,
  entries,
  categories,
  onGoToTimeline,
}) => {
  const t = TRANSLATIONS[lang];
  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const allResources = useMemo<FlattenedResource[]>(() => {
    const items: FlattenedResource[] = [];
    const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    for (const entry of sortedEntries) {
      for (const link of entry.links) {
        items.push({
          id: `${entry.id}-${link.id}`,
          label: link.label,
          url: link.url,
          hostname: extractHostname(link.url),
          date: entry.date,
          entryTitle: entry.title,
          categoryIds: entry.categoryIds,
        });
      }
    }
    return items;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allResources.filter((item) => {
      if (selectedCategoryId !== 'all' && !item.categoryIds.includes(selectedCategoryId)) {
        return false;
      }
      if (q) {
        const matchesLabel = item.label.toLowerCase().includes(q);
        const matchesUrl = item.url.toLowerCase().includes(q);
        const matchesEntry = item.entryTitle.toLowerCase().includes(q);
        if (!matchesLabel && !matchesUrl && !matchesEntry) return false;
      }
      return true;
    });
  }, [allResources, query, selectedCategoryId]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#1F1D19] dark:text-[#F4F1EA]">
            {t.resources.title}
          </h1>
          <p className="mt-1 text-sm text-[#726B60] dark:text-[#9A9388]">
            {t.resources.subtitle}
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-[#7E766B] dark:text-[#8E877C]">
          {t.resources.count(filtered.length, allResources.length)}
        </span>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888074]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.resources.searchPlaceholder}
            className="w-full rounded-xl border border-[#E6E0D5] bg-white py-2.5 pl-10 pr-9 text-sm text-[#1F1D19] placeholder-[#968F84] focus:border-[#3D6B52] focus:outline-none dark:border-[#2C2924] dark:bg-[#1D1B18] dark:text-[#F4F1EA] dark:placeholder-[#6B655B] dark:focus:border-[#7EB093]"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear resource search"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#888074] hover:text-[#1F1D19] dark:hover:text-[#F4F1EA]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedCategoryId === 'all'
                ? 'bg-[#22201C] text-[#FAF8F4] dark:bg-[#EFECE6] dark:text-[#141311]'
                : 'bg-[#F1ECE2] text-[#5C564C] hover:bg-[#E7E0D3] dark:bg-[#23201C] dark:text-[#ACA59A] dark:hover:bg-[#2D2A25]'
            }`}
          >
            {t.timeline.allCategories}
          </button>
          {categories.map((cat) => {
            const active = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  setSelectedCategoryId((prev) => (prev === cat.id ? 'all' : cat.id))
                }
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
        </div>
      </div>

      {/* Resource List */}
      {allResources.length === 0 ? (
        <div className="rounded-2xl border border-[#E6E0D5] bg-white px-6 py-14 text-center dark:border-[#2C2924] dark:bg-[#1D1B18]">
          <h2 className="font-display text-lg font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
            {t.resources.emptyTitle}
          </h2>
          <p className="mt-1 text-sm text-[#726B60] dark:text-[#9A9388]">
            {t.resources.emptyDesc}
          </p>
          <button
            type="button"
            onClick={onGoToTimeline}
            className="mt-5 rounded-xl bg-[#3D6B52] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#315843] dark:bg-[#7EB093] dark:text-[#121915]"
          >
            {t.resources.goToJournal}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E6E0D5] bg-white px-6 py-12 text-center dark:border-[#2C2924] dark:bg-[#1D1B18]">
          <p className="text-sm text-[#726B60] dark:text-[#9A9388]">
            {t.resources.noMatch}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSelectedCategoryId('all');
            }}
            className="mt-4 rounded-xl border border-[#DDD6C9] bg-[#FAF8F4] px-4 py-2 text-xs font-semibold text-[#2E2A24] hover:bg-[#EFEAE0] dark:border-[#34302A] dark:bg-[#161512] dark:text-[#EAE5DC]"
          >
            {t.actions.resetFilters}
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#ECE6DC] rounded-2xl border border-[#E6E0D5] bg-white dark:divide-[#2A2722] dark:border-[#2C2924] dark:bg-[#1D1B18]">
          {filtered.map((item) => {
            const { formatted } = formatDateHeading(item.date, lang);
            const cats = item.categoryIds
              .map((id) => categoryMap.get(id))
              .filter((c): c is CategoryConfig => Boolean(c));

            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-1.5 px-5 py-4 transition-colors hover:bg-[#FAF8F4] sm:flex-row sm:items-center sm:justify-between dark:hover:bg-[#23201C]"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 shrink-0 text-[#3D6B52] dark:text-[#7EB093]" />
                    <span className="truncate text-sm font-semibold text-[#1F1D19] group-hover:text-[#2F5E46] group-hover:underline dark:text-[#F4F1EA] dark:group-hover:text-[#96C5AA]">
                      {item.label}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#9A9388] opacity-60 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-6 text-xs text-[#787166] dark:text-[#948D82]">
                    <span className="font-mono text-[11px]">{item.hostname}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">
                      {t.resources.fromEntry} {item.entryTitle}
                    </span>
                    {cats.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-[2px]"
                            style={{ backgroundColor: cats[0].color }}
                            aria-hidden="true"
                          />
                          <span>{cats[0].name}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span className="shrink-0 pl-6 font-mono text-xs tabular-nums text-[#8D8579] sm:pl-0 dark:text-[#7E776C]">
                  {formatted}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

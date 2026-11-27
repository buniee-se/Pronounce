import {
  CategoryConfig,
  ChecklistItem,
  JournalEntry,
  JournalExportPayload,
  JournalStats,
  MoodId,
  SavedImage,
} from '../types/journal';
import { MOOD_OPTIONS } from '../data/defaults';
import { Language, TRANSLATIONS } from '../i18n/translations';

export const STORAGE_KEYS = {
  ENTRIES: 'dayleaf_entries_v1',
  TRASH: 'dayleaf_trash_v1',
  CATEGORIES: 'dayleaf_categories_v1',
  THEME: 'dayleaf_theme',
  LANG: 'dayleaf_lang',
  SOUND: 'dayleaf_sound',
} as const;

export function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatDateHeading(
  dateIso: string,
  lang: Language = 'en'
): {
  relative: string | null;
  formatted: string;
} {
  const today = getTodayIso();
  const yesterday = getYesterdayIso();
  const t = TRANSLATIONS[lang];

  let relative: string | null = null;
  if (dateIso === today) relative = t.actions.today;
  else if (dateIso === yesterday) relative = t.actions.yesterday;

  const parts = dateIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return { relative, formatted: dateIso };
  }

  const localDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const formatted = localDate.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return { relative, formatted };
}

export function formatMonthYear(year: number, monthIndex: number, lang: Language): string {
  const date = new Date(year, monthIndex, 1);
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const label = date.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractHostname(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function isoToDayNumber(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function getStartOfWeekIso(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon
  const diffToMonday = day === 0 ? 6 : day - 1;
  now.setDate(now.getDate() - diffToMonday);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calculateStats(entries: JournalEntry[]): JournalStats {
  const uniqueDateSet = new Set<string>();
  const thisWeekDateSet = new Set<string>();
  const startOfWeekIso = getStartOfWeekIso();
  const todayIso = getTodayIso();

  let totalLinksSaved = 0;
  let totalMinutes = 0;
  let highlightedCount = 0;

  for (const entry of entries) {
    if (entry.date) {
      uniqueDateSet.add(entry.date);
      if (entry.date >= startOfWeekIso && entry.date <= todayIso) {
        thisWeekDateSet.add(entry.date);
      }
    }
    totalLinksSaved += entry.links.length;
    if (typeof entry.durationMinutes === 'number' && entry.durationMinutes > 0) {
      totalMinutes += entry.durationMinutes;
    }
    if (entry.isHighlighted) {
      highlightedCount++;
    }
  }

  const sortedDates = Array.from(uniqueDateSet).sort((a, b) => b.localeCompare(a));
  const totalStudyDays = sortedDates.length;

  if (totalStudyDays === 0) {
    return {
      totalStudyDays: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalLinksSaved,
      totalEntries: entries.length,
      totalMinutes,
      thisWeekStudyDays: 0,
      highlightedCount,
    };
  }

  const todayNum = isoToDayNumber(todayIso);
  const dayNums = sortedDates.map(isoToDayNumber);

  let currentStreak = 0;
  const firstDiffFromToday = todayNum - dayNums[0];
  if (firstDiffFromToday <= 1 && firstDiffFromToday >= -1) {
    currentStreak = 1;
    for (let i = 1; i < dayNums.length; i++) {
      if (dayNums[i - 1] - dayNums[i] === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let longestStreak = 1;
  let running = 1;
  for (let i = 1; i < dayNums.length; i++) {
    if (dayNums[i - 1] - dayNums[i] === 1) {
      running++;
      if (running > longestStreak) longestStreak = running;
    } else {
      running = 1;
    }
  }

  return {
    totalStudyDays,
    currentStreak,
    longestStreak,
    totalLinksSaved,
    totalEntries: entries.length,
    totalMinutes,
    thisWeekStudyDays: thisWeekDateSet.size,
    highlightedCount,
  };
}

export function getMoodMeta(moodId: MoodId, lang: Language = 'en') {
  const base = MOOD_OPTIONS.find((m) => m.id === moodId) ?? MOOD_OPTIONS[1];
  return {
    ...base,
    label: TRANSLATIONS[lang].moods[base.id],
  };
}

/**
 * Compresses an uploaded/pasted image file via HTML5 Canvas so it stays
 * crisp while keeping localStorage usage lightweight (~60-150KB per photo).
 */
export function compressImageFile(
  file: File,
  maxDimension = 960,
  quality = 0.76
): Promise<SavedImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Not an image file'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const renderAt = (dim: number, q: number): string => {
          let { width, height } = img;
          if (width > dim || height > dim) {
            if (width >= height) {
              height = Math.round((height * dim) / width);
              width = dim;
            } else {
              width = Math.round((width * dim) / height);
              height = dim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas context unavailable');
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', q);
        };

        try {
          const MAX_DATA_URL_CHARS = 340000;
          let dataUrl = renderAt(maxDimension, quality);
          if (dataUrl.length > MAX_DATA_URL_CHARS) {
            dataUrl = renderAt(800, 0.65);
          }
          if (dataUrl.length > MAX_DATA_URL_CHARS) {
            dataUrl = renderAt(640, 0.54);
          }
          if (dataUrl.length > MAX_DATA_URL_CHARS) {
            dataUrl = renderAt(520, 0.45);
          }

          resolve({
            id: generateId('img'),
            dataUrl,
            caption: '',
          });
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Image compression failed'));
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function generateMarkdownExport(
  entries: JournalEntry[],
  categories: CategoryConfig[],
  lang: Language = 'en'
): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const stats = calculateStats(entries);

  const grouped = new Map<string, JournalEntry[]>();
  const sorted = [...entries].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return b.createdAt.localeCompare(a.createdAt);
  });

  for (const entry of sorted) {
    const list = grouped.get(entry.date) ?? [];
    list.push(entry);
    grouped.set(entry.date, list);
  }

  const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const lines: string[] = [
    lang === 'vi'
      ? '# Dayleaf — Nhật ký Học tập & Hoạt động'
      : '# Dayleaf — Daily Learning & Activity Journal',
    '',
    `> ${new Date().toLocaleDateString(locale, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })} · ${stats.totalStudyDays} ${lang === 'vi' ? 'Ngày học' : 'Study Days'} · ${
      stats.currentStreak
    } ${lang === 'vi' ? 'Chuỗi ngày' : 'Day Streak'} · ${stats.totalLinksSaved} ${
      lang === 'vi' ? 'Link đã lưu' : 'Links Saved'
    }`,
    '',
    '---',
    '',
  ];

  for (const [dateIso, dayEntries] of grouped.entries()) {
    const { formatted } = formatDateHeading(dateIso, lang);
    lines.push(`## ${formatted} (${dateIso})`);
    lines.push('');

    for (const entry of dayEntries) {
      const mood = getMoodMeta(entry.mood, lang);
      const catNames = entry.categoryIds
        .map((id) => catMap.get(id))
        .filter(Boolean)
        .join(', ');
      const starPrefix = entry.isHighlighted ? '★ ' : '';
      const durationStr = entry.durationMinutes ? ` · ${entry.durationMinutes} min` : '';

      lines.push(`### ${starPrefix}${entry.title}`);
      lines.push(
        `*${catNames || (lang === 'vi' ? 'Chưa phân loại' : 'Uncategorized')} · ${mood.emoji} ${mood.label}${durationStr}*`
      );
      lines.push('');

      if (entry.checklist && entry.checklist.length > 0) {
        lines.push(lang === 'vi' ? '**Checklist mục tiêu**' : '**Study Checklist**');
        for (const item of entry.checklist) {
          lines.push(`- [${item.done ? 'x' : ' '}] ${item.text}`);
        }
        lines.push('');
      }

      if (entry.takeaways.trim()) {
        lines.push(lang === 'vi' ? '**Kiến thức rút ra**' : '**Key Takeaways**');
        lines.push(entry.takeaways.trim());
        lines.push('');
      }

      if (entry.links.length > 0) {
        lines.push(lang === 'vi' ? '**Tài liệu đã lưu**' : '**Saved Resources**');
        for (const link of entry.links) {
          lines.push(`- [${link.label || extractHostname(link.url)}](${link.url})`);
        }
        lines.push('');
      }

      if (entry.images.length > 0) {
        lines.push(
          lang === 'vi'
            ? `*Đính kèm ${entry.images.length} hình ảnh (xem trong bản sao lưu JSON)*`
            : `*${entry.images.length} attached photo(s) included in JSON backup*`
        );
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

export function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function validateImportPayload(raw: unknown): {
  valid: boolean;
  error?: string;
  data?: { entries: JournalEntry[]; categories: CategoryConfig[] };
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'File must contain a valid JSON object or array of entries.' };
  }

  const validMoods = new Set<string>(['productive', 'good', 'overwhelmed', 'lazy']);

  let rawEntries: unknown[] = [];
  let rawCategories: unknown[] = [];

  if (Array.isArray(raw)) {
    rawEntries = raw;
  } else {
    const obj = raw as Partial<JournalExportPayload>;
    if (!Array.isArray(obj.entries)) {
      return { valid: false, error: 'Missing "entries" array in JSON backup file.' };
    }
    rawEntries = obj.entries;
    if (Array.isArray(obj.categories)) {
      rawCategories = obj.categories;
    }
  }

  const parsedCategories: CategoryConfig[] = [];
  for (const item of rawCategories) {
    if (item && typeof item === 'object') {
      const c = item as Partial<CategoryConfig>;
      if (typeof c.id === 'string' && typeof c.name === 'string' && c.name.trim()) {
        parsedCategories.push({
          id: c.id,
          name: c.name.trim().slice(0, 40),
          color: typeof c.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : '#3D6B52',
        });
      }
    }
  }

  const parsedEntries: JournalEntry[] = [];
  for (const item of rawEntries) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Partial<JournalEntry>;
    if (typeof e.title !== 'string' || !e.title.trim()) continue;
    const dateStr =
      typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
        ? e.date
        : getTodayIso();

    const safeLinks = Array.isArray(e.links)
      ? e.links
          .map((l) => {
            if (!l || typeof l !== 'object') return null;
            const linkObj = l as { id?: string; label?: string; url?: string };
            if (typeof linkObj.url !== 'string') return null;
            const safeUrl = normalizeUrl(linkObj.url);
            if (!safeUrl) return null;
            return {
              id: typeof linkObj.id === 'string' ? linkObj.id : generateId('link'),
              label:
                typeof linkObj.label === 'string' && linkObj.label.trim()
                  ? linkObj.label.trim()
                  : extractHostname(safeUrl),
              url: safeUrl,
            };
          })
          .filter((x): x is { id: string; label: string; url: string } => x !== null)
      : [];

    const safeImages: SavedImage[] = Array.isArray(e.images)
      ? e.images
          .map((img): SavedImage | null => {
            if (!img || typeof img !== 'object') return null;
            const imgObj = img as Partial<SavedImage>;
            if (
              typeof imgObj.dataUrl !== 'string' ||
              !/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(imgObj.dataUrl)
            ) {
              return null;
            }
            return {
              id: typeof imgObj.id === 'string' ? imgObj.id : generateId('img'),
              dataUrl: imgObj.dataUrl,
              caption: typeof imgObj.caption === 'string' ? imgObj.caption.slice(0, 120) : '',
            };
          })
          .filter((x): x is SavedImage => x !== null)
      : [];

    const safeChecklist: ChecklistItem[] = Array.isArray(e.checklist)
      ? e.checklist
          .map((item): ChecklistItem | null => {
            if (!item || typeof item !== 'object') return null;
            const c = item as Partial<ChecklistItem>;
            if (typeof c.text !== 'string' || !c.text.trim()) return null;
            return {
              id: typeof c.id === 'string' && c.id.trim() ? c.id : generateId('chk'),
              text: c.text.trim().slice(0, 160),
              done: Boolean(c.done),
            };
          })
          .filter((x): x is ChecklistItem => x !== null)
      : [];

    const nowIso = new Date().toISOString();
    parsedEntries.push({
      id: typeof e.id === 'string' && e.id.trim() ? e.id : generateId('entry'),
      date: dateStr,
      title: e.title.trim(),
      categoryIds: Array.isArray(e.categoryIds)
        ? e.categoryIds.filter((id): id is string => typeof id === 'string')
        : [],
      links: safeLinks,
      images: safeImages,
      checklist: safeChecklist,
      takeaways: typeof e.takeaways === 'string' ? e.takeaways : '',
      mood: typeof e.mood === 'string' && validMoods.has(e.mood) ? (e.mood as MoodId) : 'good',
      isHighlighted: Boolean(e.isHighlighted),
      durationMinutes:
        typeof e.durationMinutes === 'number' && e.durationMinutes > 0 && e.durationMinutes <= 1440
          ? Math.round(e.durationMinutes)
          : undefined,
      createdAt: typeof e.createdAt === 'string' ? e.createdAt : nowIso,
      updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : nowIso,
    });
  }

  if (parsedEntries.length === 0) {
    return { valid: false, error: 'No valid journal entries were found in this file.' };
  }

  return {
    valid: true,
    data: {
      entries: parsedEntries,
      categories: parsedCategories,
    },
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(61, 107, 82, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(61, 107, 82, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

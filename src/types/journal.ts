export type MoodId = 'productive' | 'good' | 'overwhelmed' | 'lazy';

export interface MoodOption {
  id: MoodId;
  emoji: string;
  label: string;
}

export interface SavedLink {
  id: string;
  label: string;
  url: string;
}

export interface SavedImage {
  id: string;
  dataUrl: string;
  caption?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CategoryConfig {
  id: string;
  name: string;
  color: string; // Hex color string e.g. "#3D6B52"
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  categoryIds: string[];
  links: SavedLink[];
  images: SavedImage[];
  checklist: ChecklistItem[];
  takeaways: string;
  mood: MoodId;
  isHighlighted: boolean;
  durationMinutes?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface JournalStats {
  totalStudyDays: number;
  currentStreak: number;
  longestStreak: number;
  totalLinksSaved: number;
  totalEntries: number;
  totalMinutes: number;
  thisWeekStudyDays: number;
  highlightedCount: number;
}

export interface JournalExportPayload {
  version: number;
  exportedAt: string;
  categories: CategoryConfig[];
  entries: JournalEntry[];
  trash?: JournalEntry[];
}

export type ActiveTab =
  | 'timeline'
  | 'calendar'
  | 'resources'
  | 'categories'
  | 'backup'
  | 'trash';

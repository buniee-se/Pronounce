import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bold,
  Calendar,
  Check,
  Clock,
  Code,
  ExternalLink,
  Highlighter,
  ImagePlus,
  Link2,
  List,
  Palette,
  Plus,
  Save,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import {
  CategoryConfig,
  ChecklistItem,
  JournalEntry,
  MoodId,
  SavedImage,
  SavedLink,
} from '../types/journal';
import { COLOR_SWATCHES, MOOD_OPTIONS } from '../data/defaults';
import { Language, TRANSLATIONS } from '../i18n/translations';
import {
  compressImageFile,
  extractHostname,
  generateId,
  getTodayIso,
  hexToRgba,
  normalizeUrl,
} from '../utils/journalUtils';
import {
  loadDraftFromIndexedDb,
  loadDraftSync,
  persistDraft,
} from '../utils/storageEngine';
import {
  playCheck,
  playClick,
  playHighlight,
  playUncheck,
} from '../utils/soundEffects';

interface EntryFormProps {
  lang: Language;
  categories: CategoryConfig[];
  editingEntry: JournalEntry | null;
  prefillDate?: string | null;
  prefillDuration?: number | null;
  onConsumePrefill?: () => void;
  onSave: (
    entryData: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>,
    editingId?: string
  ) => void;
  onCancelEdit: () => void;
  onUpdateCategoryColor: (categoryId: string, color: string) => void;
  onQuickAddCategory: (name: string, color: string) => CategoryConfig;
  onOpenLightbox: (images: SavedImage[], startIndex: number) => void;
  titleInputRef?: React.RefObject<HTMLInputElement | null>;
}

const DURATION_PRESETS = [15, 30, 45, 60];
const MAX_IMAGES_PER_ENTRY = 6;

export const EntryForm: React.FC<EntryFormProps> = ({
  lang,
  categories,
  editingEntry,
  prefillDate,
  prefillDuration,
  onConsumePrefill,
  onSave,
  onCancelEdit,
  onUpdateCategoryColor,
  onQuickAddCategory,
  onOpenLightbox,
  titleInputRef,
}) => {
  const t = TRANSLATIONS[lang];

  const initialDraft = editingEntry ? null : loadDraftSync();

  const [date, setDate] = useState<string>(initialDraft?.date || getTodayIso());
  const [title, setTitle] = useState<string>(initialDraft?.title || '');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    initialDraft?.categoryIds?.length
      ? initialDraft.categoryIds
      : categories[0]
      ? [categories[0].id]
      : []
  );
  const [links, setLinks] = useState<SavedLink[]>(initialDraft?.links ?? []);
  const [linkLabel, setLinkLabel] = useState<string>('');
  const [linkUrl, setLinkUrl] = useState<string>('');
  const [linkError, setLinkError] = useState<string>('');
  const [images, setImages] = useState<SavedImage[]>(initialDraft?.images ?? []);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    initialDraft?.checklist ?? []
  );
  const [checklistInput, setChecklistInput] = useState<string>('');
  const [isUploadingImg, setIsUploadingImg] = useState<boolean>(false);
  const [photoError, setPhotoError] = useState<string>('');
  const [isDraggingPhoto, setIsDraggingPhoto] = useState<boolean>(false);
  const [takeaways, setTakeaways] = useState<string>(initialDraft?.takeaways || '');
  const [mood, setMood] = useState<MoodId>(initialDraft?.mood ?? 'productive');
  const [isHighlighted, setIsHighlighted] = useState<boolean>(
    Boolean(initialDraft?.isHighlighted)
  );
  const [durationMinutes, setDurationMinutes] = useState<string>(
    initialDraft?.durationMinutes || ''
  );
  const [formError, setFormError] = useState<string>('');

  // Quick category color customizer state
  const [colorPickerCatId, setColorPickerCatId] = useState<string | null>(null);
  const [showAddCat, setShowAddCat] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatColor, setNewCatColor] = useState<string>(COLOR_SWATCHES[0].hex);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const hydratedDraftRef = useRef<boolean>(false);

  // Hydrate photo-rich draft from IndexedDB on first mount if not editing
  useEffect(() => {
    if (editingEntry || hydratedDraftRef.current) return;
    hydratedDraftRef.current = true;
    void loadDraftFromIndexedDb().then((idbDraft) => {
      if (!idbDraft) return;
      const localDraft = loadDraftSync();
      const idbNewer =
        !localDraft ||
        (idbDraft.updatedAt && idbDraft.updatedAt > (localDraft.updatedAt || '')) ||
        (idbDraft.images.length > (localDraft.images?.length ?? 0));
      if (idbNewer) {
        if (idbDraft.date) setDate(idbDraft.date);
        setTitle(idbDraft.title);
        if (idbDraft.categoryIds.length > 0) setSelectedCategoryIds(idbDraft.categoryIds);
        setLinks(idbDraft.links);
        setImages(idbDraft.images);
        setChecklist(idbDraft.checklist);
        setTakeaways(idbDraft.takeaways);
        setMood(idbDraft.mood);
        setIsHighlighted(idbDraft.isHighlighted);
        setDurationMinutes(idbDraft.durationMinutes);
      }
    });
  }, []);

  useEffect(() => {
    if (editingEntry) {
      setDate(editingEntry.date);
      setTitle(editingEntry.title);
      setSelectedCategoryIds(editingEntry.categoryIds);
      setLinks(editingEntry.links);
      setImages(editingEntry.images ?? []);
      setChecklist(editingEntry.checklist ?? []);
      setChecklistInput('');
      setTakeaways(editingEntry.takeaways);
      setMood(editingEntry.mood);
      setIsHighlighted(Boolean(editingEntry.isHighlighted));
      setDurationMinutes(
        editingEntry.durationMinutes ? String(editingEntry.durationMinutes) : ''
      );
      setLinkLabel('');
      setLinkUrl('');
      setLinkError('');
      setPhotoError('');
      setFormError('');
    } else {
      const savedDraft = loadDraftSync();
      if (savedDraft) {
        setDate(prefillDate || savedDraft.date || getTodayIso());
        setTitle(savedDraft.title);
        setSelectedCategoryIds(
          savedDraft.categoryIds.length
            ? savedDraft.categoryIds
            : categories[0]
            ? [categories[0].id]
            : []
        );
        setLinks(savedDraft.links);
        setImages(savedDraft.images);
        setChecklist(savedDraft.checklist);
        setTakeaways(savedDraft.takeaways);
        setMood(savedDraft.mood);
        setIsHighlighted(savedDraft.isHighlighted);
        setDurationMinutes(
          prefillDuration ? String(prefillDuration) : savedDraft.durationMinutes
        );
      } else {
        setDate(prefillDate || getTodayIso());
        setTitle('');
        setSelectedCategoryIds(categories[0] ? [categories[0].id] : []);
        setLinks([]);
        setImages([]);
        setChecklist([]);
        setTakeaways('');
        setMood('productive');
        setIsHighlighted(false);
        setDurationMinutes(prefillDuration ? String(prefillDuration) : '');
      }
      setChecklistInput('');
      setLinkLabel('');
      setLinkUrl('');
      setLinkError('');
      setPhotoError('');
      setFormError('');
    }
  }, [editingEntry]);

  const hasDraftContent =
    !editingEntry &&
    (title.trim().length > 0 ||
      takeaways.trim().length > 0 ||
      links.length > 0 ||
      images.length > 0 ||
      checklist.length > 0 ||
      durationMinutes.trim().length > 0);

  // Continuously auto-save draft to localStorage + IndexedDB so switching tabs or reloading never loses work
  useEffect(() => {
    if (editingEntry) return;
    if (hasDraftContent) {
      persistDraft({
        date,
        title,
        categoryIds: selectedCategoryIds,
        links,
        images,
        checklist,
        takeaways,
        mood,
        isHighlighted,
        durationMinutes,
        updatedAt: new Date().toISOString(),
      });
    } else {
      persistDraft(null);
    }
  }, [
    editingEntry,
    hasDraftContent,
    date,
    title,
    selectedCategoryIds,
    links,
    images,
    checklist,
    takeaways,
    mood,
    isHighlighted,
    durationMinutes,
  ]);

  const handleClearDraft = () => {
    playClick();
    persistDraft(null);
    setDate(getTodayIso());
    setTitle('');
    setSelectedCategoryIds(categories[0] ? [categories[0].id] : []);
    setLinks([]);
    setImages([]);
    setChecklist([]);
    setChecklistInput('');
    setLinkLabel('');
    setLinkUrl('');
    setTakeaways('');
    setMood('productive');
    setIsHighlighted(false);
    setDurationMinutes('');
    setFormError('');
    setLinkError('');
    setPhotoError('');
  };

  // Apply prefilled date from Calendar or prefilled duration from Focus Timer
  useEffect(() => {
    if (!editingEntry && prefillDate) {
      setDate(prefillDate);
      onConsumePrefill?.();
    }
  }, [prefillDate, editingEntry]);

  useEffect(() => {
    if (prefillDuration && prefillDuration > 0) {
      setDurationMinutes(String(prefillDuration));
      onConsumePrefill?.();
    }
  }, [prefillDuration]);

  // Keep selectedCategoryIds synced if a category is deleted externally
  useEffect(() => {
    const validIds = new Set(categories.map((c) => c.id));
    setSelectedCategoryIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [categories]);

  const toggleCategory = (catId: string) => {
    playClick();
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleAddChecklistItem = () => {
    const trimmed = checklistInput.trim();
    if (!trimmed) return;
    playClick();
    setChecklist((prev) => [
      ...prev,
      { id: generateId('chk'), text: trimmed.slice(0, 160), done: false },
    ]);
    setChecklistInput('');
  };

  const handleToggleChecklistItem = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          if (!item.done) playCheck();
          else playUncheck();
          return { ...item, done: !item.done };
        }
        return item;
      })
    );
  };

  const handleRemoveChecklistItem = (itemId: string) => {
    playClick();
    setChecklist((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleAddLink = () => {
    setLinkError('');
    if (!linkUrl.trim()) {
      setLinkError(t.form.linkMissingUrl);
      return;
    }
    const normalized = normalizeUrl(linkUrl);
    if (!normalized) {
      setLinkError(t.form.linkInvalidUrl);
      return;
    }
    playClick();
    const newLink: SavedLink = {
      id: generateId('link'),
      label: linkLabel.trim() || extractHostname(normalized),
      url: normalized,
    };
    setLinks((prev) => [...prev, newLink]);
    setLinkLabel('');
    setLinkUrl('');
  };

  const handleRemoveLink = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const processImageFiles = async (files: FileList | File[]) => {
    setPhotoError('');
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    const remainingSlots = MAX_IMAGES_PER_ENTRY - images.length;
    if (remainingSlots <= 0) {
      setPhotoError(t.form.photoLimitWarning);
      return;
    }

    const toProcess = fileArray.slice(0, remainingSlots);
    if (fileArray.length > remainingSlots) {
      setPhotoError(t.form.photoLimitWarning);
    }

    setIsUploadingImg(true);
    try {
      const compressed = await Promise.all(
        toProcess.map((file) => compressImageFile(file))
      );
      setImages((prev) => [...prev, ...compressed]);
    } catch {
      setPhotoError(t.form.photoError);
    } finally {
      setIsUploadingImg(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      void processImageFiles(imageFiles);
    }
  };

  const handleUpdateImageCaption = (imgId: string, caption: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === imgId ? { ...img, caption } : img))
    );
  };

  const handleRemoveImage = (imgId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imgId));
  };

  const insertFormatting = (
    type: 'bullet' | 'bold' | 'highlight' | 'phrase' | 'template'
  ) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = takeaways.slice(start, end);

    let nextText = takeaways;
    let nextCursorStart = start;
    let nextCursorEnd = end;

    if (type === 'bullet') {
      const prefix = start === 0 || takeaways[start - 1] === '\n' ? '- ' : '\n- ';
      nextText = takeaways.slice(0, start) + prefix + selected + takeaways.slice(end);
      nextCursorStart = start + prefix.length;
      nextCursorEnd = nextCursorStart + selected.length;
    } else if (type === 'bold') {
      const inner = selected || (lang === 'vi' ? 'ý chính' : 'key rule');
      nextText = takeaways.slice(0, start) + `**${inner}**` + takeaways.slice(end);
      nextCursorStart = start + 2;
      nextCursorEnd = nextCursorStart + inner.length;
    } else if (type === 'highlight') {
      const inner = selected || (lang === 'vi' ? 'cần nhớ' : 'important');
      nextText = takeaways.slice(0, start) + `==${inner}==` + takeaways.slice(end);
      nextCursorStart = start + 2;
      nextCursorEnd = nextCursorStart + inner.length;
    } else if (type === 'phrase') {
      const inner = selected || (lang === 'vi' ? 'cụm từ mới' : 'new phrase');
      nextText = takeaways.slice(0, start) + '`' + inner + '`' + takeaways.slice(end);
      nextCursorStart = start + 1;
      nextCursorEnd = nextCursorStart + inner.length;
    } else if (type === 'template') {
      const snippet =
        (takeaways.trim().length > 0 ? '\n' : '') + t.form.templateSnippet;
      nextText = takeaways + snippet;
      nextCursorStart = nextText.length;
      nextCursorEnd = nextText.length;
    }

    setTakeaways(nextText);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextCursorStart, nextCursorEnd);
    });
  };

  const handleTakeawaysKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const el = e.currentTarget;
      const start = el.selectionStart;
      const lineStart = takeaways.lastIndexOf('\n', start - 1) + 1;
      const currentLine = takeaways.slice(lineStart, start);

      if (/^\s*[-•*]\s+.+/.test(currentLine)) {
        e.preventDefault();
        const nextText =
          takeaways.slice(0, start) + '\n- ' + takeaways.slice(el.selectionEnd);
        setTakeaways(nextText);
        requestAnimationFrame(() => {
          el.setSelectionRange(start + 3, start + 3);
        });
      } else if (/^\s*[-•*]\s*$/.test(currentLine)) {
        e.preventDefault();
        const nextText = takeaways.slice(0, lineStart) + takeaways.slice(el.selectionEnd);
        setTakeaways(nextText);
        requestAnimationFrame(() => {
          el.setSelectionRange(lineStart, lineStart);
        });
      }
    }
  };

  const handleCreateQuickCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const created = onQuickAddCategory(trimmed, newCatColor);
    setSelectedCategoryIds((prev) => [...prev, created.id]);
    setNewCatName('');
    setShowAddCat(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setLinkError('');

    if (!title.trim()) {
      setFormError(t.form.titleError);
      titleInputRef?.current?.focus();
      return;
    }

    let finalLinks = [...links];
    if (linkUrl.trim()) {
      const normalized = normalizeUrl(linkUrl);
      if (!normalized) {
        setLinkError(t.form.linkFixBeforeSave);
        return;
      }
      finalLinks = [
        ...finalLinks,
        {
          id: generateId('link'),
          label: linkLabel.trim() || extractHostname(normalized),
          url: normalized,
        },
      ];
    }

    let finalChecklist = [...checklist];
    if (checklistInput.trim()) {
      finalChecklist = [
        ...finalChecklist,
        {
          id: generateId('chk'),
          text: checklistInput.trim().slice(0, 160),
          done: false,
        },
      ];
    }

    const parsedDuration = parseInt(durationMinutes, 10);
    const validDuration =
      !Number.isNaN(parsedDuration) && parsedDuration > 0 && parsedDuration <= 1440
        ? parsedDuration
        : undefined;

    onSave(
      {
        date: date || getTodayIso(),
        title: title.trim(),
        categoryIds:
          selectedCategoryIds.length > 0
            ? selectedCategoryIds
            : categories[categories.length - 1]
            ? [categories[categories.length - 1].id]
            : [],
        links: finalLinks,
        images,
        checklist: finalChecklist,
        takeaways: takeaways.trim(),
        mood,
        isHighlighted,
        durationMinutes: validDuration,
      },
      editingEntry?.id
    );

    if (!editingEntry) {
      persistDraft(null);
      setTitle('');
      setLinks([]);
      setImages([]);
      setChecklist([]);
      setChecklistInput('');
      setLinkLabel('');
      setLinkUrl('');
      setTakeaways('');
      setMood('productive');
      setIsHighlighted(false);
      setDurationMinutes('');
    }
  };

  const activeColorCategory = categories.find((c) => c.id === colorPickerCatId) ?? null;

  return (
    <section
      aria-label={editingEntry ? t.form.editTitle : t.form.logTitle}
      onPaste={handlePaste}
      className="rounded-2xl border border-[#E6E0D5] bg-white p-5 sm:p-6 dark:border-[#2C2924] dark:bg-[#1D1B18]"
    >
      <div className="mb-5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight text-[#1F1D19] dark:text-[#F4F1EA]">
            {editingEntry ? t.form.editTitle : t.form.logTitle}
          </h2>
          {hasDraftContent ? (
            <div className="mt-0.5 flex items-center gap-2 text-xs">
              <span className="font-medium text-[#3D6B52] dark:text-[#7EB093]">
                {t.actions.draftSaved}
              </span>
              <span className="text-[#C7BFAF] dark:text-[#4C463E]" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                onClick={handleClearDraft}
                className="text-[#877F73] underline-offset-2 hover:text-[#B8413E] hover:underline dark:hover:text-[#E57B78]"
              >
                {t.actions.clearDraft}
              </button>
            </div>
          ) : (
            <p className="mt-0.5 text-xs text-[#726B60] dark:text-[#9A9388]">
              {editingEntry ? t.form.editSubtitle : t.form.logSubtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={() => {
              const next = !isHighlighted;
              if (next) playHighlight();
              else playClick();
              setIsHighlighted(next);
            }}
            title={t.form.highlightEntry}
            aria-pressed={isHighlighted}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-medium transition-colors ${
              isHighlighted
                ? 'border-[#C99635] bg-[#C99635]/15 text-[#7A5511] dark:border-[#DFB054] dark:bg-[#DFB054]/15 dark:text-[#F4D28A]'
                : 'border-[#E6E0D5] bg-[#FAF8F4] text-[#6B6459] hover:border-[#CFC7B9] dark:border-[#2E2B26] dark:bg-[#161512] dark:text-[#A39C90]'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${isHighlighted ? 'fill-current' : ''}`} />
          </motion.button>

          <motion.button
            type="submit"
            form="dayleaf-entry-form"
            whileTap={{ scale: 0.95 }}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#3D6B52] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#315843] whitespace-nowrap dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{editingEntry ? t.actions.saveChanges : t.actions.saveNow}</span>
          </motion.button>

          {editingEntry && (
            <button
              type="button"
              onClick={() => {
                playClick();
                onCancelEdit();
              }}
              aria-label={t.actions.cancel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[#6B6459] transition-colors hover:bg-[#F3EFE7] hover:text-[#1F1D19] dark:text-[#A39C90] dark:hover:bg-[#2A2722] dark:hover:text-[#F4F1EA]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <form id="dayleaf-entry-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Date & Title */}
        <div className="space-y-3.5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="entry-date"
                className="text-xs font-medium text-[#5A544A] dark:text-[#ACA59A]"
              >
                {t.form.dateLabel}
              </label>
              {date !== getTodayIso() && (
                <button
                  type="button"
                  onClick={() => setDate(getTodayIso())}
                  className="text-xs font-medium text-[#3D6B52] hover:underline dark:text-[#7EB093]"
                >
                  {t.form.jumpToday}
                </button>
              )}
            </div>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#857E73] dark:text-[#8E877C]" />
              <input
                id="entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] py-2.5 pl-9 pr-3 font-mono text-sm text-[#1F1D19] transition-colors focus:border-[#3D6B52] focus:bg-white focus:outline-none dark:border-[#312D27] dark:bg-[#161512] dark:text-[#F2EFE9] dark:focus:border-[#7EB093] dark:focus:bg-[#1D1B18]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="entry-title"
              className="mb-1.5 block text-xs font-medium text-[#5A544A] dark:text-[#ACA59A]"
            >
              {t.form.whatIDidLabel}
            </label>
            <input
              ref={titleInputRef}
              id="entry-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError('');
              }}
              placeholder={t.form.whatIDidPlaceholder}
              className="w-full rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#1F1D19] placeholder-[#9A9388] transition-colors focus:border-[#3D6B52] focus:bg-white focus:outline-none dark:border-[#312D27] dark:bg-[#161512] dark:text-[#F2EFE9] dark:placeholder-[#6B655B] dark:focus:border-[#7EB093] dark:focus:bg-[#1D1B18]"
            />
            {formError && (
              <p className="mt-1.5 text-xs font-medium text-[#B8413E] dark:text-[#E57B78]">
                {formError}
              </p>
            )}
          </div>
        </div>

        {/* Category Tags + Inline Color Customizer */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#5A544A] dark:text-[#ACA59A]">
              {t.form.categoriesLabel}
            </span>
            <button
              type="button"
              onClick={() => {
                setShowAddCat((prev) => !prev);
                setColorPickerCatId(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#3D6B52] transition-colors hover:text-[#2D523E] dark:text-[#7EB093] dark:hover:text-[#9BC7AE]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.form.newTag}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const isSelected = selectedCategoryIds.includes(cat.id);
              return (
                <div key={cat.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    style={{
                      backgroundColor: isSelected ? hexToRgba(cat.color, 0.14) : undefined,
                      borderColor: isSelected ? hexToRgba(cat.color, 0.45) : undefined,
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-l-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'text-[#1F1D19] dark:text-[#F4F1EA]'
                        : 'border-[#E6E0D5] bg-[#FAF8F4] text-[#5E584E] hover:border-[#CFC7B9] dark:border-[#2E2B26] dark:bg-[#161512] dark:text-[#A39C90] dark:hover:border-[#433E37]'
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: cat.color }}
                      aria-hidden="true"
                    />
                    <span>{cat.name}</span>
                  </button>
                  <button
                    type="button"
                    title={t.form.colorFor(cat.name)}
                    aria-label={t.form.colorFor(cat.name)}
                    onClick={() => {
                      setColorPickerCatId((prev) => (prev === cat.id ? null : cat.id));
                      setShowAddCat(false);
                    }}
                    style={{
                      backgroundColor: isSelected ? hexToRgba(cat.color, 0.14) : undefined,
                      borderColor: isSelected ? hexToRgba(cat.color, 0.45) : undefined,
                    }}
                    className={`inline-flex items-center justify-center rounded-r-lg border border-l-0 px-1.5 py-1.5 text-[#877F73] transition-colors hover:text-[#1F1D19] dark:text-[#867F74] dark:hover:text-[#F4F1EA] ${
                      isSelected
                        ? ''
                        : 'border-[#E6E0D5] bg-[#FAF8F4] dark:border-[#2E2B26] dark:bg-[#161512]'
                    }`}
                  >
                    <Palette className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {activeColorCategory && (
            <div className="mt-2.5 rounded-xl border border-[#E6E0D5] bg-[#FAF8F4] p-3 dark:border-[#2F2C27] dark:bg-[#161512]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-[#4B463E] dark:text-[#C4BEB3]">
                  {t.form.colorFor(activeColorCategory.name)}
                </span>
                <button
                  type="button"
                  onClick={() => setColorPickerCatId(null)}
                  className="text-xs text-[#7D766B] hover:text-[#1F1D19] dark:hover:text-[#F4F1EA]"
                >
                  {t.actions.done}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_SWATCHES.map((swatch) => {
                  const active =
                    activeColorCategory.color.toLowerCase() === swatch.hex.toLowerCase();
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      title={swatch.name}
                      aria-label={swatch.name}
                      onClick={() => onUpdateCategoryColor(activeColorCategory.id, swatch.hex)}
                      className="flex h-6 w-6 items-center justify-center rounded-md transition-transform hover:scale-105"
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {active && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  );
                })}
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#DED7CB] bg-white px-2 py-1 text-[11px] font-medium text-[#5A544A] dark:border-[#34302A] dark:bg-[#1D1B18] dark:text-[#C4BEB3]">
                  <span>{t.form.customColor}</span>
                  <input
                    type="color"
                    value={activeColorCategory.color}
                    onChange={(e) =>
                      onUpdateCategoryColor(activeColorCategory.id, e.target.value)
                    }
                    className="h-3.5 w-3.5 cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
              </div>
            </div>
          )}

          {showAddCat && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-[#E6E0D5] bg-[#FAF8F4] p-2.5 dark:border-[#2F2C27] dark:bg-[#161512]">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateQuickCategory();
                  }
                }}
                placeholder={t.form.tagPlaceholder}
                maxLength={32}
                className="min-w-0 flex-1 rounded-lg border border-[#E2DBD0] bg-white px-2.5 py-1.5 text-xs text-[#1F1D19] placeholder-[#9A9388] focus:border-[#3D6B52] focus:outline-none dark:border-[#34302A] dark:bg-[#1D1B18] dark:text-[#F4F1EA]"
              />
              <input
                type="color"
                aria-label={t.form.customColor}
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-[#E2DBD0] bg-transparent p-0.5 dark:border-[#34302A]"
              />
              <button
                type="button"
                onClick={handleCreateQuickCategory}
                className="rounded-lg bg-[#3D6B52] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#315843] dark:bg-[#5E8F73] dark:text-[#111512]"
              >
                {t.actions.add}
              </button>
            </div>
          )}
        </div>

        {/* Study Duration (Optional) */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-[#5A544A] dark:text-[#ACA59A]">
            {t.form.durationLabel}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {DURATION_PRESETS.map((mins) => {
              const active = durationMinutes === String(mins);
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() =>
                    setDurationMinutes((prev) =>
                      prev === String(mins) ? '' : String(mins)
                    )
                  }
                  className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs tabular-nums transition-colors ${
                    active
                      ? 'border-[#3D6B52] bg-[#3D6B52]/10 font-semibold text-[#1E3B2B] dark:border-[#7EB093] dark:bg-[#7EB093]/15 dark:text-[#E5F2EA]'
                      : 'border-[#E6E0D5] bg-[#FAF8F4] text-[#5E584E] hover:border-[#CFC7B9] dark:border-[#2E2B26] dark:bg-[#161512] dark:text-[#A39C90]'
                  }`}
                >
                  {t.stats.minsShort(mins)}
                </button>
              );
            })}
            <div className="relative w-20">
              <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8D8579]" />
              <input
                type="number"
                min={1}
                max={1440}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder={t.form.customMinPlaceholder}
                className="w-full rounded-lg border border-[#E4DDD2] bg-[#FAF8F4] py-1.5 pl-7 pr-2 font-mono text-xs tabular-nums text-[#1F1D19] placeholder-[#9A9388] focus:border-[#3D6B52] focus:bg-white focus:outline-none dark:border-[#312D27] dark:bg-[#161512] dark:text-[#F2EFE9] dark:focus:border-[#7EB093]"
              />
            </div>
          </div>
        </div>

        {/* Study Checklist Builder */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label
              htmlFor="entry-checklist-input"
              className="text-xs font-medium text-[#5A544A] dark:text-[#ACA59A]"
            >
              {t.form.checklistLabel}
            </label>
            {checklist.length > 0 && (
              <span className="font-mono text-[11px] tabular-nums text-[#3D6B52] dark:text-[#7EB093]">
                {t.form.checklistProgress(
                  checklist.filter((c) => c.done).length,
                  checklist.length
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="entry-checklist-input"
              type="text"
              value={checklistInput}
              onChange={(e) => setChecklistInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddChecklistItem();
                }
              }}
              placeholder={t.form.checklistPlaceholder}
              maxLength={160}
              className="min-w-0 flex-1 rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] px-3 py-2 text-xs text-[#1F1D19] placeholder-[#9A9388] focus:border-[#3D6B52] focus:bg-white focus:outline-none dark:border-[#312D27] dark:bg-[#161512] dark:text-[#F2EFE9] dark:placeholder-[#6B655B] dark:focus:border-[#7EB093] dark:focus:bg-[#1D1B18]"
            />
            <button
              type="button"
              onClick={handleAddChecklistItem}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#DDD6C9] bg-[#F5F1E9] px-3 py-2 text-xs font-medium text-[#2F2B25] transition-colors hover:bg-[#ECE6DB] whitespace-nowrap shrink-0 dark:border-[#34302A] dark:bg-[#26231F] dark:text-[#EAE5DC] dark:hover:bg-[#312D27]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.actions.add}</span>
            </button>
          </div>

          {checklist.length > 0 && (
            <ul className="mt-2 divide-y divide-[#ECE6DC] rounded-xl border border-[#E8E2D7] bg-[#FAF8F4] dark:divide-[#2A2722] dark:border-[#2E2B26] dark:bg-[#161512]">
              {checklist.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleChecklistItem(item.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                        item.done
                          ? 'border-[#3D6B52] bg-[#3D6B52] text-white dark:border-[#7EB093] dark:bg-[#7EB093] dark:text-[#121915]'
                          : 'border-[#CFC7B9] bg-white dark:border-[#423D36] dark:bg-[#1D1B18]'
                      }`}
                    >
                      {item.done && <Check className="h-3 w-3" />}
                    </span>
                    <span
                      className={`truncate ${
                        item.done
                          ? 'text-[#968E82] line-through dark:text-[#756E64]'
                          : 'text-[#2B2823] dark:text-[#E5E0D6]'
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklistItem(item.id)}
                    aria-label="Remove checklist item"
                    className="rounded-md p-1 text-[#8D8579] transition-colors hover:bg-[#EAE4D9] hover:text-[#B8413E] dark:hover:bg-[#292621] dark:hover:text-[#E57B78]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Saved Links / Resources */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#5A544A] dark:text-[#ACA59A]">
            {t.form.linksLabel}
          </label>
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.15fr_auto]">
              <input
                type="text"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder={t.form.linkLabelPlaceholder}
                className="min-w-0 rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] px-3 py-2 text-xs text-[#1F1D19] placeholder-[#9A9388] focus:border-[#3D6B52] focus:bg-white focus:outline-none dark:border-[#312D27] dark:bg-[#161512] dark:text-[#F2EFE9] dark:placeholder-[#6B655B] dark:focus:border-[#7EB093] dark:focus:bg-[#1D1B18]"
              />
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  if (linkError) setLinkError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLink();
                  }
                }}
                placeholder={t.form.linkUrlPlaceholder}
                className="min-w-0 rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] px-3 py-2 text-xs text-[#1F1D19] placeholder-[#9A9388] focus:border-[#3D6B52] focus:bg-white focus:outline-none dark:border-[#312D27] dark:bg-[#161512] dark:text-[#F2EFE9] dark:placeholder-[#6B655B] dark:focus:border-[#7EB093] dark:focus:bg-[#1D1B18]"
              />
              <button
                type="button"
                onClick={handleAddLink}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#DDD6C9] bg-[#F5F1E9] px-3 py-2 text-xs font-medium text-[#2F2B25] transition-colors hover:bg-[#ECE6DB] whitespace-nowrap shrink-0 dark:border-[#34302A] dark:bg-[#26231F] dark:text-[#EAE5DC] dark:hover:bg-[#312D27]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t.actions.add}</span>
              </button>
            </div>
            {linkError && (
              <p className="text-xs font-medium text-[#B8413E] dark:text-[#E57B78]">
                {linkError}
              </p>
            )}

            {links.length > 0 && (
              <ul className="divide-y divide-[#ECE6DC] rounded-xl border border-[#E8E2D7] bg-[#FAF8F4] dark:divide-[#2A2722] dark:border-[#2E2B26] dark:bg-[#161512]">
                {links.map((link) => (
                  <li
                    key={link.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-2 text-[#2E5B43] hover:underline dark:text-[#86B89B]"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0 opacity-75" />
                      <span className="truncate font-medium">{link.label}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(link.id)}
                      aria-label={`Remove ${link.label}`}
                      className="rounded-md p-1 text-[#8D8579] transition-colors hover:bg-[#EAE4D9] hover:text-[#B8413E] dark:hover:bg-[#292621] dark:hover:text-[#E57B78]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Photos & Screenshots Upload */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#5A544A] dark:text-[#ACA59A]">
              {t.form.photosLabel}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-[#8D8579]">
              {images.length}/{MAX_IMAGES_PER_ENTRY}
            </span>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingPhoto(true);
            }}
            onDragLeave={() => setIsDraggingPhoto(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingPhoto(false);
              if (e.dataTransfer.files?.length) {
                void processImageFiles(e.dataTransfer.files);
              }
            }}
            className={`rounded-xl border border-dashed p-3 transition-colors ${
              isDraggingPhoto
                ? 'border-[#3D6B52] bg-[#3D6B52]/5 dark:border-[#7EB093] dark:bg-[#7EB093]/10'
                : 'border-[#DCD4C7] bg-[#FAF8F4] dark:border-[#332F29] dark:bg-[#161512]'
            }`}
          >
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) {
                  void processImageFiles(e.target.files);
                }
                e.target.value = '';
              }}
              className="hidden"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-[#7E766B] dark:text-[#8E877C]">
                {isUploadingImg ? t.form.compressing : t.form.photosHint}
              </p>
              <button
                type="button"
                disabled={isUploadingImg || images.length >= MAX_IMAGES_PER_ENTRY}
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D0C2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#2E2A24] transition-colors hover:bg-[#F3EFE7] disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-[#34302A] dark:bg-[#1D1B18] dark:text-[#EAE5DC] dark:hover:bg-[#27241F]"
              >
                <ImagePlus className="h-3.5 w-3.5 text-[#3D6B52] dark:text-[#7EB093]" />
                <span>{t.form.uploadPhotos}</span>
              </button>
            </div>

            {images.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    className="overflow-hidden rounded-xl border border-[#E6E0D5] bg-white dark:border-[#2E2B26] dark:bg-[#1D1B18]"
                  >
                    <div className="relative aspect-4/3 bg-[#F2EDE4] dark:bg-[#141311]">
                      <button
                        type="button"
                        onClick={() => onOpenLightbox(images, idx)}
                        className="h-full w-full"
                      >
                        <img
                          src={img.dataUrl}
                          alt={img.caption || `Uploaded ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img.id)}
                        aria-label="Remove photo"
                        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#141311]/70 text-white transition-colors hover:bg-[#B8413E]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={img.caption ?? ''}
                      onChange={(e) => handleUpdateImageCaption(img.id, e.target.value)}
                      placeholder={t.form.photoCaptionPlaceholder}
                      maxLength={80}
                      className="w-full border-t border-[#ECE6DC] bg-transparent px-2 py-1.5 text-[11px] text-[#3F3A33] placeholder-[#9A9388] focus:outline-none dark:border-[#2A2722] dark:text-[#DCD6CB]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          {photoError && (
            <p className="mt-1.5 text-xs font-medium text-[#B8413E] dark:text-[#E57B78]">
              {photoError}
            </p>
          )}
        </div>

        {/* Key Takeaways / What I Gained */}
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
            <label
              htmlFor="entry-takeaways"
              className="text-xs font-medium text-[#5A544A] dark:text-[#ACA59A]"
            >
              {t.form.takeawaysLabel}
            </label>
            <div className="flex flex-wrap items-center gap-0.5">
              <button
                type="button"
                title={t.form.bulletBtn}
                onClick={() => insertFormatting('bullet')}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#6B6459] transition-colors hover:bg-[#F2EDE4] hover:text-[#1F1D19] dark:text-[#9A9388] dark:hover:bg-[#292621] dark:hover:text-[#F4F1EA]"
              >
                <List className="h-3 w-3" />
                <span className="hidden sm:inline">{t.form.bulletBtn}</span>
              </button>
              <button
                type="button"
                title={t.form.boldBtn}
                onClick={() => insertFormatting('bold')}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#6B6459] transition-colors hover:bg-[#F2EDE4] hover:text-[#1F1D19] dark:text-[#9A9388] dark:hover:bg-[#292621] dark:hover:text-[#F4F1EA]"
              >
                <Bold className="h-3 w-3" />
                <span className="hidden sm:inline">{t.form.boldBtn}</span>
              </button>
              <button
                type="button"
                title={t.form.highlightBtn}
                onClick={() => insertFormatting('highlight')}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#8C6419] transition-colors hover:bg-[#F9EED2] dark:text-[#E5BD67] dark:hover:bg-[#312817]"
              >
                <Highlighter className="h-3 w-3" />
                <span>{t.form.highlightBtn}</span>
              </button>
              <button
                type="button"
                title={t.form.phraseBtn}
                onClick={() => insertFormatting('phrase')}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#6B6459] transition-colors hover:bg-[#F2EDE4] hover:text-[#1F1D19] dark:text-[#9A9388] dark:hover:bg-[#292621] dark:hover:text-[#F4F1EA]"
              >
                <Code className="h-3 w-3" />
                <span className="hidden sm:inline">{t.form.phraseBtn}</span>
              </button>
              <button
                type="button"
                title={t.form.promptsBtn}
                onClick={() => insertFormatting('template')}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[#3D6B52] transition-colors hover:bg-[#EAF1EC] dark:text-[#7EB093] dark:hover:bg-[#23322A]"
              >
                <Sparkles className="h-3 w-3" />
                <span>{t.form.promptsBtn}</span>
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            id="entry-takeaways"
            rows={5}
            value={takeaways}
            onChange={(e) => setTakeaways(e.target.value)}
            onKeyDown={handleTakeawaysKeyDown}
            placeholder={t.form.takeawaysPlaceholder}
            className="w-full resize-y rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] px-3.5 py-2.5 text-sm leading-relaxed text-[#1F1D19] placeholder-[#9A9388] transition-colors focus:border-[#3D6B52] focus:bg-white focus:outline-none dark:border-[#312D27] dark:bg-[#161512] dark:text-[#F2EFE9] dark:placeholder-[#6B655B] dark:focus:border-[#7EB093] dark:focus:bg-[#1D1B18]"
          />
        </div>

        {/* Mood / Energy Rating */}
        <div>
          <span className="mb-2 block text-xs font-medium text-[#5A544A] dark:text-[#ACA59A]">
            {t.form.moodLabel}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {MOOD_OPTIONS.map((option) => {
              const active = mood === option.id;
              return (
                <motion.button
                  key={option.id}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    playClick();
                    setMood(option.id);
                  }}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'border-[#3D6B52] bg-[#3D6B52]/10 text-[#1E3B2B] dark:border-[#7EB093] dark:bg-[#7EB093]/15 dark:text-[#E5F2EA]'
                      : 'border-[#E6E0D5] bg-[#FAF8F4] text-[#5C554B] hover:border-[#D2C9BA] dark:border-[#2E2B26] dark:bg-[#161512] dark:text-[#A39C90] dark:hover:border-[#423D36]'
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {option.emoji}
                  </span>
                  <span>{t.moods[option.id]}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-2 pt-1">
          <motion.button
            type="submit"
            whileTap={{ scale: 0.98 }}
            className="flex-1 rounded-xl bg-[#3D6B52] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#315843] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3D6B52] dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
          >
            {editingEntry ? t.actions.saveChanges : t.actions.saveEntry}
          </motion.button>
          {editingEntry && (
            <button
              type="button"
              onClick={() => {
                playClick();
                onCancelEdit();
              }}
              className="rounded-xl border border-[#E2DBD0] bg-transparent px-4 py-2.5 text-sm font-medium text-[#5E584E] transition-colors hover:bg-[#F3EFE7] dark:border-[#322E28] dark:text-[#B3ACA0] dark:hover:bg-[#26231F]"
            >
              {t.actions.cancel}
            </button>
          )}
        </div>
      </form>
    </section>
  );
};

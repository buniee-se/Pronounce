import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Cloud,
  CloudOff,
  Copy,
  Download,
  FileJson,
  FileText,
  LogIn,
  LogOut,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  CategoryConfig,
  JournalEntry,
  JournalExportPayload,
} from '../types/journal';
import { Language, TRANSLATIONS } from '../i18n/translations';
import {
  generateMarkdownExport,
  getTodayIso,
  triggerFileDownload,
  validateImportPayload,
} from '../utils/journalUtils';

interface BackupViewProps {
  lang: Language;
  entries: JournalEntry[];
  categories: CategoryConfig[];
  cloudUser: {
    displayName: string;
    email: string;
    photoURL: string;
  } | null;
  cloudSyncing: boolean;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
  onSyncNow: () => void;
  onImportData: (
    data: { entries: JournalEntry[]; categories: CategoryConfig[] },
    mode: 'merge' | 'replace'
  ) => void;
  onResetSampleData: () => void;
  onClearAllEntries: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({
  lang,
  entries,
  categories,
  cloudUser,
  cloudSyncing,
  onOpenAuthModal,
  onSignOut,
  onSyncNow,
  onImportData,
  onResetSampleData,
  onClearAllEntries,
}) => {
  const t = TRANSLATIONS[lang];
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [copiedMd, setCopiedMd] = useState(false);
  const [showMdPreview, setShowMdPreview] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalPhotos = useMemo(
    () => entries.reduce((sum, e) => sum + (e.images?.length ?? 0), 0),
    [entries]
  );

  const markdownOutput = useMemo(
    () => generateMarkdownExport(entries, categories, lang),
    [entries, categories, lang]
  );

  const handleExportJson = () => {
    const payload: JournalExportPayload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      categories,
      entries,
    };
    triggerFileDownload(
      `dayleaf-journal-${getTodayIso()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  };

  const handleExportMarkdown = () => {
    triggerFileDownload(
      `dayleaf-journal-${getTodayIso()}.md`,
      markdownOutput,
      'text/markdown;charset=utf-8'
    );
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownOutput);
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
    } catch {
      setImportStatus({
        type: 'error',
        message: t.backup.clipboardBlocked,
      });
    }
  };

  const processJsonFile = (file: File) => {
    setImportStatus(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const parsed = JSON.parse(text);
        const result = validateImportPayload(parsed);
        if (!result.valid || !result.data) {
          setImportStatus({
            type: 'error',
            message: result.error || t.backup.importErrorJson,
          });
          return;
        }
        onImportData(result.data, importMode);
        setImportStatus({
          type: 'success',
          message:
            importMode === 'merge'
              ? t.backup.importSuccessMerge(result.data.entries.length)
              : t.backup.importSuccessReplace(result.data.entries.length),
        });
      } catch {
        setImportStatus({
          type: 'error',
          message: t.backup.importErrorJson,
        });
      }
    };
    reader.onerror = () => {
      setImportStatus({ type: 'error', message: t.backup.importErrorRead });
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processJsonFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processJsonFile(file);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#1F1D19] dark:text-[#F4F1EA]">
          {t.backup.title}
        </h1>
        <p className="mt-1 text-sm text-[#726B60] dark:text-[#9A9388]">
          {t.backup.subtitle}
        </p>
      </div>

      {/* Supabase Cloud Sync Section */}
      <section className="rounded-2xl border border-[#D7E2DA] bg-[#F5F8F6] p-6 dark:border-[#2B3B31] dark:bg-[#18201B]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3D6B52]/12 text-[#3D6B52] dark:bg-[#7EB093]/18 dark:text-[#9AC9AE]">
              {cloudUser ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
                {t.cloud.cardTitle}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#5F594F] dark:text-[#A9A296]">
                {cloudUser
                  ? t.cloud.cardDescSignedIn(cloudUser.email || cloudUser.displayName)
                  : t.cloud.cardDescSignedOut}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {cloudUser ? (
              <>
                <button
                  type="button"
                  disabled={cloudSyncing}
                  onClick={onSyncNow}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#3D6B52] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#315843] disabled:opacity-60 dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${cloudSyncing ? 'animate-spin' : ''}`} />
                  <span>{cloudSyncing ? t.cloud.syncing : t.cloud.syncNow}</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8D0C2] bg-white px-3.5 py-2 text-xs font-semibold text-[#3F3A33] transition-colors hover:bg-[#F3EFE7] dark:border-[#34302A] dark:bg-[#1D1B18] dark:text-[#DCD6CB] dark:hover:bg-[#27241F]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{t.cloud.signOut}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="inline-flex items-center gap-2 rounded-xl bg-[#3D6B52] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#315843] dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{t.cloud.signIn}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Export Section */}
      <section className="rounded-2xl border border-[#E6E0D5] bg-white p-6 dark:border-[#2C2924] dark:bg-[#1D1B18]">
        <h2 className="font-display text-base font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
          {t.backup.exportTitle}
        </h2>
        <p className="mt-1 text-xs text-[#756E63] dark:text-[#9A9388]">
          {t.backup.storingSummary(entries.length, categories.length, totalPhotos)}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col justify-between rounded-xl border border-[#EAE4D9] bg-[#FAF8F4] p-4 dark:border-[#2F2C27] dark:bg-[#161512]">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
                <FileJson className="h-4 w-4 text-[#3D6B52] dark:text-[#7EB093]" />
                <span>{t.backup.jsonTitle}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#726B60] dark:text-[#9A9388]">
                {t.backup.jsonDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportJson}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3D6B52] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#315843] dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t.backup.exportJsonBtn}</span>
            </button>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-[#EAE4D9] bg-[#FAF8F4] p-4 dark:border-[#2F2C27] dark:bg-[#161512]">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
                <FileText className="h-4 w-4 text-[#3D6B52] dark:text-[#7EB093]" />
                <span>{t.backup.mdTitle}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#726B60] dark:text-[#9A9388]">
                {t.backup.mdDesc}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D8D0C2] bg-white px-3 py-2.5 text-xs font-semibold text-[#1F1D19] transition-colors hover:bg-[#F3EFE7] dark:border-[#37332C] dark:bg-[#1D1B18] dark:text-[#F4F1EA] dark:hover:bg-[#27241F]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{t.backup.downloadMdBtn}</span>
              </button>
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D8D0C2] bg-white px-3 py-2.5 text-xs font-semibold text-[#1F1D19] transition-colors hover:bg-[#F3EFE7] dark:border-[#37332C] dark:bg-[#1D1B18] dark:text-[#F4F1EA] dark:hover:bg-[#27241F]"
              >
                {copiedMd ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#3D6B52] dark:text-[#7EB093]" />
                    <span>{t.backup.copiedBtn}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t.backup.copyBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowMdPreview((prev) => !prev)}
            className="text-xs font-medium text-[#3D6B52] hover:underline dark:text-[#7EB093]"
          >
            {showMdPreview ? t.backup.previewHide : t.backup.previewShow}
          </button>
          {showMdPreview && (
            <pre className="mt-2.5 max-h-72 overflow-auto rounded-xl border border-[#E6E0D5] bg-[#FAF8F4] p-4 font-mono text-xs leading-relaxed text-[#3E3A33] dark:border-[#2F2C27] dark:bg-[#141311] dark:text-[#C8C2B8]">
              {markdownOutput}
            </pre>
          )}
        </div>
      </section>

      {/* Import Section */}
      <section className="rounded-2xl border border-[#E6E0D5] bg-white p-6 dark:border-[#2C2924] dark:bg-[#1D1B18]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
              {t.backup.importTitle}
            </h2>
            <p className="mt-0.5 text-xs text-[#756E63] dark:text-[#9A9388]">
              {t.backup.importSubtitle}
            </p>
          </div>

          <div className="inline-flex rounded-lg bg-[#F1ECE2] p-1 dark:bg-[#161512]">
            <button
              type="button"
              onClick={() => setImportMode('merge')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                importMode === 'merge'
                  ? 'bg-white text-[#1F1D19] shadow-xs dark:bg-[#2A2722] dark:text-[#F4F1EA]'
                  : 'text-[#6E675C] hover:text-[#1F1D19] dark:text-[#9A9388] dark:hover:text-[#F4F1EA]'
              }`}
            >
              {t.backup.merge}
            </button>
            <button
              type="button"
              onClick={() => setImportMode('replace')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                importMode === 'replace'
                  ? 'bg-white text-[#1F1D19] shadow-xs dark:bg-[#2A2722] dark:text-[#F4F1EA]'
                  : 'text-[#6E675C] hover:text-[#1F1D19] dark:text-[#9A9388] dark:hover:text-[#F4F1EA]'
              }`}
            >
              {t.backup.replaceAll}
            </button>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors ${
            isDragging
              ? 'border-[#3D6B52] bg-[#3D6B52]/5 dark:border-[#7EB093] dark:bg-[#7EB093]/10'
              : 'border-[#D5CDC0] bg-[#FAF8F4] dark:border-[#36322B] dark:bg-[#161512]'
          }`}
        >
          <Upload className="h-5 w-5 text-[#756E63] dark:text-[#9A9388]" />
          <p className="mt-2 text-sm font-medium text-[#2B2823] dark:text-[#EAE5DC]">
            {t.backup.dropText}
          </p>
          <p className="mt-1 text-xs text-[#7E766B] dark:text-[#8E877C]">
            {importMode === 'merge' ? t.backup.mergeHint : t.backup.replaceHint}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 rounded-xl border border-[#D8D0C2] bg-white px-4 py-2 text-xs font-semibold text-[#1F1D19] transition-colors hover:bg-[#F3EFE7] dark:border-[#37332C] dark:bg-[#1D1B18] dark:text-[#F4F1EA] dark:hover:bg-[#27241F]"
          >
            {t.backup.chooseFile}
          </button>
        </div>

        {importStatus && (
          <div
            role="status"
            className={`mt-3 rounded-xl border px-4 py-3 text-xs font-medium ${
              importStatus.type === 'success'
                ? 'border-[#3D6B52]/30 bg-[#3D6B52]/10 text-[#264A36] dark:border-[#7EB093]/30 dark:bg-[#7EB093]/15 dark:text-[#B8DEC6]'
                : 'border-[#B8413E]/30 bg-[#B8413E]/10 text-[#8F2B28] dark:border-[#E57B78]/30 dark:bg-[#E57B78]/15 dark:text-[#F0ABA9]'
            }`}
          >
            {importStatus.message}
          </div>
        )}
      </section>

      {/* Maintenance / Sample Data */}
      <section className="rounded-2xl border border-[#E6E0D5] bg-white p-6 dark:border-[#2C2924] dark:bg-[#1D1B18]">
        <h2 className="font-display text-base font-semibold text-[#1F1D19] dark:text-[#F4F1EA]">
          {t.backup.localTitle}
        </h2>
        <p className="mt-1 text-xs text-[#756E63] dark:text-[#9A9388]">
          {t.backup.localDesc}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {confirmAction === 'reset' ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] px-3 py-2 text-xs dark:border-[#34302A] dark:bg-[#161512]">
              <span className="text-[#4B463E] dark:text-[#C8C2B8]">
                {t.backup.restoreConfirm}
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetSampleData();
                  setConfirmAction(null);
                }}
                className="rounded-lg bg-[#3D6B52] px-2.5 py-1 font-medium text-white dark:bg-[#7EB093] dark:text-[#121915]"
              >
                {t.actions.confirm}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg px-2 py-1 font-medium text-[#6B6459] hover:bg-[#EAE4D9] dark:text-[#A39C90] dark:hover:bg-[#2A2722]"
              >
                {t.actions.cancel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmAction('reset')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDD6C9] bg-[#FAF8F4] px-3.5 py-2 text-xs font-medium text-[#3F3A33] transition-colors hover:bg-[#EFEAE0] dark:border-[#34302A] dark:bg-[#161512] dark:text-[#DCD6CB] dark:hover:bg-[#26231F]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t.backup.restoreBtn}</span>
            </button>
          )}

          {confirmAction === 'clear' ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E4DDD2] bg-[#FAF8F4] px-3 py-2 text-xs dark:border-[#34302A] dark:bg-[#161512]">
              <span className="text-[#8F2B28] dark:text-[#E57B78]">
                {t.backup.clearConfirm(entries.length)}
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearAllEntries();
                  setConfirmAction(null);
                }}
                className="rounded-lg bg-[#B8413E] px-2.5 py-1 font-medium text-white"
              >
                {t.backup.clearYes}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg px-2 py-1 font-medium text-[#6B6459] hover:bg-[#EAE4D9] dark:text-[#A39C90] dark:hover:bg-[#2A2722]"
              >
                {t.actions.cancel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmAction('clear')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECD3D2] bg-transparent px-3.5 py-2 text-xs font-medium text-[#B8413E] transition-colors hover:bg-[#FCEEEE] dark:border-[#492928] dark:text-[#E57B78] dark:hover:bg-[#332020]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t.backup.clearBtn}</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  signInWithEmailPassword,
  signInWithGoogleOAuth,
  signUpWithEmailPassword,
} from '../lib/supabase';
import { Language, TRANSLATIONS } from '../i18n/translations';
import { playClick, playSave } from '../utils/soundEffects';

interface AuthModalProps {
  open: boolean;
  lang: Language;
  onClose: () => void;
  onAuthSuccess: (displayNameOrEmail: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  lang,
  onClose,
  onAuthSuccess,
}) => {
  const t = TRANSLATIONS[lang];
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const resetMessages = () => {
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!isSupabaseConfigured) {
      setErrorMsg(t.cloud.notConfiguredDesc);
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg(t.cloud.invalidEmail);
      return;
    }
    if (password.length < 6) {
      setErrorMsg(t.cloud.passwordTooShort);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const res = await signInWithEmailPassword(trimmedEmail, password);
        if (res.error) {
          setErrorMsg(res.error);
          return;
        }
        playSave();
        onAuthSuccess(res.user?.email || trimmedEmail);
        onClose();
      } else {
        const res = await signUpWithEmailPassword(trimmedEmail, password, displayName);
        if (res.error) {
          setErrorMsg(res.error);
          return;
        }
        playSave();
        if (res.needsEmailConfirmation) {
          setInfoMsg(t.cloud.checkEmailConfirm);
        } else {
          onAuthSuccess(displayName.trim() || res.user?.email || trimmedEmail);
          onClose();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    resetMessages();
    if (!isSupabaseConfigured) {
      setErrorMsg(t.cloud.notConfiguredDesc);
      return;
    }
    playClick();
    setGoogleLoading(true);
    try {
      const res = await signInWithGoogleOAuth();
      if (res.error) {
        setErrorMsg(res.error);
        setGoogleLoading(false);
      }
    } catch {
      setErrorMsg(t.cloud.signInError);
      setGoogleLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[#E6E0D5] bg-[#FAF8F4] p-6 shadow-xl dark:border-[#2E2B26] dark:bg-[#191815]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3D6B52]/12 text-[#3D6B52] dark:bg-[#7EB093]/18 dark:text-[#9AC9AE]">
                  <Cloud className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2
                    id="auth-modal-title"
                    className="font-display text-lg font-semibold text-[#1F1D19] dark:text-[#F4F1EA]"
                  >
                    {mode === 'signin' ? t.cloud.modalSignInTitle : t.cloud.modalSignUpTitle}
                  </h2>
                  <p className="text-xs text-[#756E63] dark:text-[#9A9388]">
                    {t.cloud.modalSubtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.actions.close}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[#756E63] transition-colors hover:bg-[#EFEAE0] hover:text-[#1F1D19] dark:text-[#9A9388] dark:hover:bg-[#27241F] dark:hover:text-[#F4F1EA]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Supabase Not Configured Notice */}
            {!isSupabaseConfigured && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#E6D5B8] bg-[#FDF8EE] p-3 text-xs leading-relaxed text-[#7D571D] dark:border-[#493A22] dark:bg-[#241E14] dark:text-[#E8C98F]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">{t.cloud.notConfiguredTitle}</p>
                  <p className="mt-0.5 opacity-90">{t.cloud.notConfiguredDesc}</p>
                </div>
              </div>
            )}

            {/* Mode Switcher */}
            <div className="mt-5 grid grid-cols-2 rounded-xl bg-[#EFEAE0] p-1 dark:bg-[#12110F]">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setMode('signin');
                  resetMessages();
                }}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                  mode === 'signin'
                    ? 'bg-white text-[#1F1D19] shadow-xs dark:bg-[#27241F] dark:text-[#F4F1EA]'
                    : 'text-[#6E675C] hover:text-[#1F1D19] dark:text-[#9A9388] dark:hover:text-[#F4F1EA]'
                }`}
              >
                {t.cloud.signIn}
              </button>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setMode('signup');
                  resetMessages();
                }}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                  mode === 'signup'
                    ? 'bg-white text-[#1F1D19] shadow-xs dark:bg-[#27241F] dark:text-[#F4F1EA]'
                    : 'text-[#6E675C] hover:text-[#1F1D19] dark:text-[#9A9388] dark:hover:text-[#F4F1EA]'
                }`}
              >
                {t.cloud.signUp}
              </button>
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              disabled={googleLoading || loading}
              onClick={handleGoogle}
              className="mt-4 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#DCD5C8] bg-white px-4 py-2.5 text-xs font-semibold text-[#1F1D19] transition-colors hover:bg-[#F3EFE7] disabled:opacity-60 dark:border-[#34302A] dark:bg-[#22201C] dark:text-[#F4F1EA] dark:hover:bg-[#2A2722]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>
                {googleLoading ? t.cloud.signingIn : t.cloud.signInGoogle}
              </span>
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#E6E0D5] dark:bg-[#2C2924]" />
              <span className="text-[11px] font-medium text-[#8A8276] dark:text-[#7F786D]">
                {t.cloud.orEmail}
              </span>
              <div className="h-px flex-1 bg-[#E6E0D5] dark:bg-[#2C2924]" />
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4B463E] dark:text-[#C8C2B8]">
                    {t.cloud.nameLabel}
                  </label>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8A8276]" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t.cloud.namePlaceholder}
                      maxLength={80}
                      className="w-full rounded-xl border border-[#DFD8CB] bg-white py-2.5 pl-9 pr-3 text-xs text-[#1F1D19] outline-none transition-colors focus:border-[#3D6B52] dark:border-[#322E28] dark:bg-[#141311] dark:text-[#F4F1EA] dark:focus:border-[#7EB093]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-[#4B463E] dark:text-[#C8C2B8]">
                  {t.cloud.emailLabel}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8A8276]" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-[#DFD8CB] bg-white py-2.5 pl-9 pr-3 text-xs text-[#1F1D19] outline-none transition-colors focus:border-[#3D6B52] dark:border-[#322E28] dark:bg-[#141311] dark:text-[#F4F1EA] dark:focus:border-[#7EB093]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#4B463E] dark:text-[#C8C2B8]">
                  {t.cloud.passwordLabel}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8A8276]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-[#DFD8CB] bg-white py-2.5 pl-9 pr-9 text-xs text-[#1F1D19] outline-none transition-colors focus:border-[#3D6B52] dark:border-[#322E28] dark:bg-[#141311] dark:text-[#F4F1EA] dark:focus:border-[#7EB093]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8276] hover:text-[#1F1D19] dark:hover:text-[#F4F1EA]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#B8413E]/30 bg-[#B8413E]/10 px-3 py-2 text-xs text-[#8F2B28] dark:border-[#E57B78]/30 dark:bg-[#E57B78]/15 dark:text-[#F0ABA9]"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-[#3D6B52]/30 bg-[#3D6B52]/10 px-3 py-2 text-xs text-[#264A36] dark:border-[#7EB093]/30 dark:bg-[#7EB093]/15 dark:text-[#B8DEC6]"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3D6B52] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#315843] disabled:opacity-60 dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
              >
                <span>
                  {loading
                    ? t.cloud.signingIn
                    : mode === 'signin'
                    ? t.cloud.signInWithEmail
                    : t.cloud.createAccount}
                </span>
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

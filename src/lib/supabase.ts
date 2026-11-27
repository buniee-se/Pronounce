import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl.includes('YOUR_PROJECT_ID') &&
  !supabaseAnonKey.includes('YOUR_SUPABASE_ANON');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getAuthRedirectUrl(): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}`;
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  if (!supabase) {
    return { user: null, error: 'SUPABASE_NOT_CONFIGURED' };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    return { user: null, error: error.message };
  }
  return { user: data.user, error: null };
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  displayName?: string
): Promise<{
  user: User | null;
  needsEmailConfirmation: boolean;
  error: string | null;
}> {
  if (!supabase) {
    return {
      user: null,
      needsEmailConfirmation: false,
      error: 'SUPABASE_NOT_CONFIGURED',
    };
  }
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: displayName?.trim()
        ? { full_name: displayName.trim().slice(0, 80) }
        : undefined,
    },
  });
  if (error) {
    return { user: null, needsEmailConfirmation: false, error: error.message };
  }
  const needsEmailConfirmation = Boolean(data.user && !data.session);
  return { user: data.user, needsEmailConfirmation, error: null };
}

export async function signInWithGoogleOAuth(): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'SUPABASE_NOT_CONFIGURED' };
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl(),
      queryParams: {
        prompt: 'select_account',
      },
    },
  });
  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function signOutSupabase(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function getUserDisplayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fullName =
    typeof meta?.full_name === 'string' && meta.full_name.trim()
      ? meta.full_name.trim()
      : typeof meta?.name === 'string' && meta.name.trim()
      ? meta.name.trim()
      : '';
  if (fullName) return fullName;
  if (user.email) return user.email.split('@')[0];
  return 'Dayleaf User';
}

export function getUserAvatarUrl(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (typeof meta?.avatar_url === 'string' && /^https?:\/\//i.test(meta.avatar_url)) {
    return meta.avatar_url;
  }
  if (typeof meta?.picture === 'string' && /^https?:\/\//i.test(meta.picture)) {
    return meta.picture;
  }
  return '';
}

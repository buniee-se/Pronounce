-- ============================================================================
-- Dayleaf — Supabase Database Schema & Row Level Security (RLS)
-- Copy and paste this entire script into: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

-- 1. Categories Table (custom study tags & colors)
create table if not exists public.journal_categories (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#3D6B52' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 2. Journal Entries Table (active entries + soft-deleted trash items)
create table if not exists public.journal_entries (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  title text not null check (char_length(title) between 1 and 240),
  category_ids jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  takeaways text not null default '',
  mood text not null default 'good' check (mood in ('productive', 'good', 'overwhelmed', 'lazy')),
  is_highlighted boolean not null default false,
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 1440),
  is_trashed boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 3. Entry Photos Table (compressed study snapshots linked to entries)
create table if not exists public.journal_photos (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  data_url text not null check (char_length(data_url) <= 600000),
  caption text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, entry_id) references public.journal_entries(user_id, id) on delete cascade
);

-- 4. Indexes for fast timeline, calendar, and photo lookups
create index if not exists idx_journal_entries_user_date
  on public.journal_entries (user_id, is_trashed, date desc);

create index if not exists idx_journal_photos_user_entry
  on public.journal_photos (user_id, entry_id);

-- 5. Automatic updated_at trigger
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_journal_categories_updated_at on public.journal_categories;
create trigger trg_journal_categories_updated_at
  before update on public.journal_categories
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_journal_entries_updated_at on public.journal_entries;
create trigger trg_journal_entries_updated_at
  before update on public.journal_entries
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_journal_photos_updated_at on public.journal_photos;
create trigger trg_journal_photos_updated_at
  before update on public.journal_photos
  for each row execute function public.handle_updated_at();

-- 6. Enable Row Level Security (RLS) on all tables
alter table public.journal_categories enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_photos enable row level security;

-- 7. Strict Owner-Only RLS Policies (users can only access their own rows)
-- Categories policies
drop policy if exists "Users select own categories" on public.journal_categories;
create policy "Users select own categories"
  on public.journal_categories for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own categories" on public.journal_categories;
create policy "Users insert own categories"
  on public.journal_categories for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own categories" on public.journal_categories;
create policy "Users update own categories"
  on public.journal_categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own categories" on public.journal_categories;
create policy "Users delete own categories"
  on public.journal_categories for delete
  using (auth.uid() = user_id);

-- Entries policies
drop policy if exists "Users select own entries" on public.journal_entries;
create policy "Users select own entries"
  on public.journal_entries for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own entries" on public.journal_entries;
create policy "Users insert own entries"
  on public.journal_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own entries" on public.journal_entries;
create policy "Users update own entries"
  on public.journal_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own entries" on public.journal_entries;
create policy "Users delete own entries"
  on public.journal_entries for delete
  using (auth.uid() = user_id);

-- Photos policies
drop policy if exists "Users select own photos" on public.journal_photos;
create policy "Users select own photos"
  on public.journal_photos for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own photos" on public.journal_photos;
create policy "Users insert own photos"
  on public.journal_photos for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own photos" on public.journal_photos;
create policy "Users update own photos"
  on public.journal_photos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own photos" on public.journal_photos;
create policy "Users delete own photos"
  on public.journal_photos for delete
  using (auth.uid() = user_id);

-- 8. Enable Realtime sync across tabs/devices (optional, safe if already added)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'journal_categories'
  ) then
    alter publication supabase_realtime add table public.journal_categories;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'journal_entries'
  ) then
    alter publication supabase_realtime add table public.journal_entries;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'journal_photos'
  ) then
    alter publication supabase_realtime add table public.journal_photos;
  end if;
end $$;

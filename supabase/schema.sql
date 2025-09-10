-- Supabase Schema for MTG Collection Tracker
-- Run this SQL in your connected Supabase project

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Profiles table (public usernames)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

-- Collections table
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Cards table
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  card_name text not null,
  quantity integer not null check (quantity >= 0),
  set_name text,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_collections_user_id on public.collections(user_id);
create index if not exists idx_cards_collection_id on public.cards(collection_id);
create index if not exists idx_cards_card_name_lower on public.cards (lower(card_name));
create index if not exists idx_cards_card_name_trgm on public.cards using gin (card_name gin_trgm_ops);

-- RLS
alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.cards enable row level security;

-- Policies: drop existing to be idempotent
-- Profiles policies
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;

create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Collections policies
drop policy if exists "collections_select_all" on public.collections;
drop policy if exists "collections_insert_own" on public.collections;
drop policy if exists "collections_update_own" on public.collections;
drop policy if exists "collections_delete_own" on public.collections;

create policy "collections_select_all" on public.collections
  for select using (true);

create policy "collections_insert_own" on public.collections
  for insert with check (auth.uid() = user_id);

create policy "collections_update_own" on public.collections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "collections_delete_own" on public.collections
  for delete using (auth.uid() = user_id);

-- Cards policies
drop policy if exists "cards_select_all" on public.cards;
drop policy if exists "cards_insert_own" on public.cards;
drop policy if exists "cards_update_own" on public.cards;
drop policy if exists "cards_delete_own" on public.cards;

create policy "cards_select_all" on public.cards
  for select using (true);

create policy "cards_insert_own" on public.cards
  for insert with check (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  ));

create policy "cards_update_own" on public.cards
  for update using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  ));

create policy "cards_delete_own" on public.cards
  for delete using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  ));

-- Auto-create profile on new user signup
drop function if exists public.handle_new_user cascade;
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'user_' || substr(new.id::text,1,8)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Grants
grant usage on schema public to anon, authenticated; 
grant select on public.profiles, public.collections, public.cards to anon, authenticated;
grant insert, update, delete on public.collections, public.cards to authenticated;
-- Supabase setup for shared Savings Tracker
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 32),
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('save', 'spend')),
  amount numeric(12,2) not null check (amount > 0),
  note text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected')) default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_friend_request check (requester_id <> addressee_id)
);

create unique index if not exists uniq_friend_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table if not exists public.profile_visibility (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  can_view boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, viewer_id),
  constraint no_self_visibility check (owner_id <> viewer_id)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_visibility_touch_updated_at on public.profile_visibility;
create trigger trg_visibility_touch_updated_at
before update on public.profile_visibility
for each row execute procedure public.touch_updated_at();

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = a and f.addressee_id = b)
        or
        (f.requester_id = b and f.addressee_id = a)
      )
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  clean_username text;
begin
  base_username := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1));
  clean_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');

  if clean_username is null or char_length(clean_username) < 3 then
    clean_username := 'user' || substr(new.id::text, 1, 6);
  end if;

  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    clean_username || '_' || substr(new.id::text, 1, 4),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.friendships enable row level security;
alter table public.profile_visibility enable row level security;

-- Recreate policies safely

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;

drop policy if exists "entries_select_owner_or_allowed_viewer" on public.entries;
drop policy if exists "entries_insert_own" on public.entries;
drop policy if exists "entries_update_own" on public.entries;
drop policy if exists "entries_delete_own" on public.entries;

drop policy if exists "friendships_select_participant" on public.friendships;
drop policy if exists "friendships_insert_requester" on public.friendships;
drop policy if exists "friendships_update_addressee" on public.friendships;
drop policy if exists "friendships_delete_participant" on public.friendships;

drop policy if exists "visibility_select_participant" on public.profile_visibility;
drop policy if exists "visibility_insert_owner" on public.profile_visibility;
drop policy if exists "visibility_update_owner" on public.profile_visibility;
drop policy if exists "visibility_delete_owner" on public.profile_visibility;

-- Profiles: readable by authenticated users so friend search works.
create policy "profiles_select_authenticated"
on public.profiles
for select
using (auth.role() = 'authenticated');

create policy "profiles_insert_self"
on public.profiles
for insert
with check (id = auth.uid());

create policy "profiles_update_self"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- Entries: shared data requires BOTH accepted friendship and explicit permission.
create policy "entries_select_owner_or_allowed_viewer"
on public.entries
for select
using (
  user_id = auth.uid()
  or (
    public.are_friends(auth.uid(), user_id)
    and exists (
      select 1
      from public.profile_visibility pv
      where pv.owner_id = public.entries.user_id
        and pv.viewer_id = auth.uid()
        and pv.can_view = true
    )
  )
);

create policy "entries_insert_own"
on public.entries
for insert
with check (user_id = auth.uid());

create policy "entries_update_own"
on public.entries
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "entries_delete_own"
on public.entries
for delete
using (user_id = auth.uid());

-- Friendships
create policy "friendships_select_participant"
on public.friendships
for select
using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "friendships_insert_requester"
on public.friendships
for insert
with check (
  requester_id = auth.uid()
  and requester_id <> addressee_id
);

create policy "friendships_update_addressee"
on public.friendships
for update
using (addressee_id = auth.uid())
with check (
  addressee_id = auth.uid()
  and requester_id <> addressee_id
);

create policy "friendships_delete_participant"
on public.friendships
for delete
using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Visibility permissions
create policy "visibility_select_participant"
on public.profile_visibility
for select
using (owner_id = auth.uid() or viewer_id = auth.uid());

create policy "visibility_insert_owner"
on public.profile_visibility
for insert
with check (
  owner_id = auth.uid()
  and public.are_friends(owner_id, viewer_id)
);

create policy "visibility_update_owner"
on public.profile_visibility
for update
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and public.are_friends(owner_id, viewer_id)
);

create policy "visibility_delete_owner"
on public.profile_visibility
for delete
using (owner_id = auth.uid());

create index if not exists idx_entries_user_created_at on public.entries(user_id, created_at desc);

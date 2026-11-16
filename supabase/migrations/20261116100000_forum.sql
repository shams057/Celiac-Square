-- Forum (November 2026)
--   * forum_threads: a question asked by a signed-in user
--   * forum_replies: the answers; one of them can be marked as the accepted answer
--   * forum_thread_likes: "I have the same question"
--   * forum_reply_likes: "this answer helped me"
--   * forum_saved_threads: questions a user keeps to read again
--   * reports: forum posts can be reported to the team
-- Everything is read and written by the API (secret key): row level security is on, without policies.

-- Threads -----------------------------------------------------------------------
create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('DIAGNOSIS', 'PRODUCTS', 'PLACES', 'RECIPES', 'DAILY_LIFE', 'CHILDREN', 'TRAVEL', 'OTHER')),
  title text not null check (char_length(title) between 8 and 160),
  body text not null default '' check (char_length(body) <= 5000),
  -- The language the question was written in ('fr' or 'ar'), shown as a hint in the list
  lang text not null default 'fr' check (lang in ('fr', 'ar')),
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  accepted_reply_id uuid,
  -- Kept up to date by the triggers below
  reply_count integer not null default 0,
  like_count integer not null default 0,
  view_count integer not null default 0,
  last_activity_at timestamptz not null default now(),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  search_text text generated always as (public.f_unaccent(lower(title || ' ' || body))) stored
);
create index if not exists forum_threads_activity_idx on public.forum_threads (is_pinned desc, last_activity_at desc);
create index if not exists forum_threads_category_idx on public.forum_threads (category, last_activity_at desc);
create index if not exists forum_threads_author_idx on public.forum_threads (author_id, created_at desc);
create index if not exists forum_threads_popular_idx on public.forum_threads (like_count desc, reply_count desc);

-- Replies -----------------------------------------------------------------------
create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- The reply this one answers, when it answers a reply rather than the question
  parent_id uuid references public.forum_replies (id) on delete set null,
  body text not null check (char_length(body) between 2 and 3000),
  like_count integer not null default 0,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists forum_replies_thread_idx on public.forum_replies (thread_id, created_at);
create index if not exists forum_replies_author_idx on public.forum_replies (author_id, created_at desc);
create index if not exists forum_replies_parent_idx on public.forum_replies (parent_id);

alter table public.forum_threads
  add constraint forum_threads_accepted_reply_fkey foreign key (accepted_reply_id) references public.forum_replies (id) on delete set null;
create index if not exists forum_threads_accepted_reply_idx on public.forum_threads (accepted_reply_id);

-- Likes and saved questions -----------------------------------------------------
create table if not exists public.forum_thread_likes (
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index if not exists forum_thread_likes_user_idx on public.forum_thread_likes (user_id);

create table if not exists public.forum_reply_likes (
  reply_id uuid not null references public.forum_replies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);
create index if not exists forum_reply_likes_user_idx on public.forum_reply_likes (user_id);

create table if not exists public.forum_saved_threads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);
create index if not exists forum_saved_threads_thread_idx on public.forum_saved_threads (thread_id);

-- Counters ----------------------------------------------------------------------
-- A new reply counts on its thread and brings it back to the top of the list
create or replace function public.forum_reply_counts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.forum_threads
      set reply_count = reply_count + 1, last_activity_at = now()
      where id = new.thread_id;
    return new;
  end if;
  update public.forum_threads
    set reply_count = greatest(reply_count - 1, 0)
    where id = old.thread_id;
  return old;
end;
$$;
create trigger forum_replies_counts after insert or delete on public.forum_replies
  for each row execute function public.forum_reply_counts();

create or replace function public.forum_thread_like_counts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.forum_threads set like_count = like_count + 1 where id = new.thread_id;
    return new;
  end if;
  update public.forum_threads set like_count = greatest(like_count - 1, 0) where id = old.thread_id;
  return old;
end;
$$;
create trigger forum_thread_likes_counts after insert or delete on public.forum_thread_likes
  for each row execute function public.forum_thread_like_counts();

create or replace function public.forum_reply_like_counts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.forum_replies set like_count = like_count + 1 where id = new.reply_id;
    return new;
  end if;
  update public.forum_replies set like_count = greatest(like_count - 1, 0) where id = old.reply_id;
  return old;
end;
$$;
create trigger forum_reply_likes_counts after insert or delete on public.forum_reply_likes
  for each row execute function public.forum_reply_like_counts();

-- One more read of a question; called by the API only
create or replace function public.forum_bump_views(p_thread uuid)
returns void
language sql
set search_path = ''
as $$
  update public.forum_threads set view_count = view_count + 1 where id = p_thread;
$$;
revoke execute on function public.forum_bump_views(uuid) from public, anon, authenticated;
grant execute on function public.forum_bump_views(uuid) to service_role;
revoke execute on function public.forum_reply_counts() from public, anon, authenticated;
revoke execute on function public.forum_thread_like_counts() from public, anon, authenticated;
revoke execute on function public.forum_reply_like_counts() from public, anon, authenticated;

-- Written and read only by the API (secret key)
alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_thread_likes enable row level security;
alter table public.forum_reply_likes enable row level security;
alter table public.forum_saved_threads enable row level security;

-- Reports: forum posts ----------------------------------------------------------
-- target_id is the question's id, or "<question id>:<reply id>" for a reply
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports
  add constraint reports_target_type_check
  check (target_type in ('ATMC_PRODUCT', 'ASSOCIATION_PRODUCT', 'OFF_PRODUCT', 'SPOT', 'SCAN', 'FORUM_THREAD', 'FORUM_REPLY'));
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports
  add constraint reports_reason_check
  check (reason in ('LABEL_CHANGED', 'WRONG_STATUS', 'CLOSED', 'NO_LONGER_GLUTEN_FREE', 'WRONG_INFO', 'REACTION', 'DANGEROUS_ADVICE', 'SPAM', 'ABUSE', 'OTHER'));

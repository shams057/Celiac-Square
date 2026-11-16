-- Forum moderation (November 2026)
--   * forum_blocks: members the team has stopped from posting on the forum, for a time or until lifted.
--     A blocked member still reads, likes and saves; asking, answering and editing are refused by the API.
-- Read and written only by the API (secret key): row level security is on, without policies.

create table if not exists public.forum_blocks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Shown to the member with the refusal
  reason text not null default '' check (char_length(reason) <= 500),
  blocked_by uuid references public.profiles (id) on delete set null,
  -- null: until the team lifts it. A block past this date no longer counts.
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists forum_blocks_blocked_by_idx on public.forum_blocks (blocked_by);

alter table public.forum_blocks enable row level security;

-- Forum views counted once per reader (November 2026)
--   * forum_thread_views: who has read a question. A signed-in member counts as "u:<account id>",
--     a visitor as "v:<random id kept on their device>". The author's own reads are not counted.
--   * forum_record_view(): records a read and counts it only the first time; called by the API only.
-- Counts recorded before this migration were page loads; they are kept as they are.

create table if not exists public.forum_thread_views (
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  viewer text not null check (char_length(viewer) between 3 and 80),
  created_at timestamptz not null default now(),
  primary key (thread_id, viewer)
);

alter table public.forum_thread_views enable row level security;

-- true when this reader had not read the question before (the count went up by one)
create or replace function public.forum_record_view(p_thread uuid, p_viewer text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into public.forum_thread_views (thread_id, viewer) values (p_thread, p_viewer) on conflict do nothing;
  if not found then
    return false;
  end if;
  update public.forum_threads set view_count = view_count + 1 where id = p_thread;
  return true;
end;
$$;
revoke execute on function public.forum_record_view(uuid, text) from public, anon, authenticated;
grant execute on function public.forum_record_view(uuid, text) to service_role;

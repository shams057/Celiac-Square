-- Phone number on accounts: asked at sign-up, editable on the account page, and used
-- to prefill orders (the team confirms orders by WhatsApp or by phone).
-- Stored as the API formats it: "53 314 369" (Tunisian number, without +216).

alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles
  add constraint profiles_phone_length check (char_length(phone) <= 30) not valid;

-- New accounts take the phone given at sign-up (the API validates it before calling Supabase Auth)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 30)
  );
  return new;
end;
$$;

-- Still only callable as the auth.users trigger (see 20261105130000_lock_handle_new_user.sql)
revoke execute on function public.handle_new_user() from public, anon, authenticated;

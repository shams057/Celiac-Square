-- Photos and videos of map spots, added from the back-office.
-- Public bucket, written only through signed upload URLs that the API hands to admins.
-- Videos are too large to pass through the API (Vercel caps request bodies at 4.5 MB),
-- so the browser sends the file straight to Storage. 50 MB is the free plan's per-file cap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spot-media',
  'spot-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

do $$
declare
  existing_bucket storage.buckets%rowtype;
begin
  select *
  into existing_bucket
  from storage.buckets
  where id = 'profile-avatars';

  if not found then
    insert into storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    )
    values (
      'profile-avatars',
      'profile-avatars',
      false,
      5242880,
      array['image/jpeg', 'image/png', 'image/webp']::text[]
    );
  elsif existing_bucket.name is distinct from 'profile-avatars'
    or existing_bucket.public is distinct from false
    or existing_bucket.file_size_limit is distinct from 5242880
    or existing_bucket.allowed_mime_types is distinct from
      array['image/jpeg', 'image/png', 'image/webp']::text[] then
    raise exception
      'Bucket profile-avatars already exists with a different configuration';
  end if;
end
$$;

create policy "grow_profile_avatars_select_own_v1"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
);

create policy "grow_profile_avatars_insert_own_v1"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
);

create policy "grow_profile_avatars_update_own_v1"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
)
with check (
  bucket_id = 'profile-avatars'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
);

create policy "grow_profile_avatars_delete_own_v1"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and array_length(storage.foldername(name), 1) = 1
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
);

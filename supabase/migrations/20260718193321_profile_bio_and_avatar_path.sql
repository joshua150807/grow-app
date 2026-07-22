-- Additive profile fields for the public bio and the internal avatar object path.
-- A null avatar_path keeps the bundled mobile default avatar active.

alter table public.profiles
  add column if not exists bio text not null default '',
  add column if not exists avatar_path text;

alter table public.profiles
  add constraint profiles_bio_max_length_check
  check (char_length(bio) <= 100)
  not valid;

alter table public.profiles
  validate constraint profiles_bio_max_length_check;

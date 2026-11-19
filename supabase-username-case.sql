-- Usernames preserve the owner's capitalization but remain unique ignoring case.
-- The original UNIQUE(username) constraint stays in place; this index also blocks
-- AnimeFan / animefan / ANIMEFAN from being different accounts.
-- Existing handles are not modified.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_check
  CHECK (username ~ '^[A-Za-z][A-Za-z0-9_]{2,31}$');
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_case_insensitive_key
  ON public.profiles (lower(username));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS password_reset_token text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS password_reset_expires_at timestamp with time zone DEFAULT NULL;
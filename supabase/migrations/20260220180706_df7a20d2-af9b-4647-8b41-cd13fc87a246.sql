
-- Add last_active_at column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at timestamp with time zone DEFAULT now();

-- Update existing profiles to have a value
UPDATE public.profiles SET last_active_at = now() WHERE last_active_at IS NULL;

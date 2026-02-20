
-- Add email_verified column to profiles (default false for new users)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- Add email_verification_token and expiry columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

-- Update handle_new_user to set email_verified = false for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, is_approved, email_verified)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), true, false);
  RETURN NEW;
END;
$function$;

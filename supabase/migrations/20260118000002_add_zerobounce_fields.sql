-- Add ZeroBounce email verification fields to people table
ALTER TABLE people ADD COLUMN IF NOT EXISTS email_zerobounce_status TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS email_zerobounce_sub_status TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS email_zerobounce_at TIMESTAMPTZ;

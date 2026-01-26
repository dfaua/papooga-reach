-- Update the status check constraint to include 'asked_for_intro'
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_status_check;
ALTER TABLE people ADD CONSTRAINT people_status_check
  CHECK (status IN ('saved', 'requested', 'accepted', 'messaged', 'replied', 'asked_for_intro'));

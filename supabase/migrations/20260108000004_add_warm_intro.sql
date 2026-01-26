-- Add warm_intro_referrer column to people table
-- This stores the name or LinkedIn URL of the person who referred/introduced

ALTER TABLE people
ADD COLUMN warm_intro_referrer TEXT;

-- Add comment for documentation
COMMENT ON COLUMN people.warm_intro_referrer IS 'Name or LinkedIn URL of the person providing the warm introduction';

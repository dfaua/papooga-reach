-- Add follow_up template type and sequence_number for follow-up ordering

-- Drop the existing CHECK constraint on type
ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_type_check;

-- Add new CHECK constraint including 'follow_up' type
ALTER TABLE message_templates ADD CONSTRAINT message_templates_type_check
    CHECK (type IN ('connection_note', 'message', 'inmail', 'follow_up'));

-- Add sequence_number column for follow-up ordering (1st follow-up, 2nd follow-up, etc.)
-- NULL for non-follow-up templates
ALTER TABLE message_templates ADD COLUMN sequence_number INTEGER;

-- Add constraint: sequence_number required for follow_up type, must be >= 1
ALTER TABLE message_templates ADD CONSTRAINT follow_up_sequence_number_check
    CHECK (
        (type = 'follow_up' AND sequence_number IS NOT NULL AND sequence_number >= 1)
        OR (type != 'follow_up' AND sequence_number IS NULL)
    );

-- Index for efficient follow-up template lookups by profile and sequence
CREATE INDEX idx_message_templates_follow_up ON message_templates(profile_id, sequence_number)
    WHERE type = 'follow_up';

-- Add comment for clarity
COMMENT ON COLUMN message_templates.sequence_number IS 'Order in follow-up sequence (1, 2, 3...). Only used for follow_up type templates.';

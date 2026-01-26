-- Add outcome column to outreach_logs to track results
-- Possible values: pending, accepted (connection accepted but no reply), replied (they responded)
ALTER TABLE outreach_logs
ADD COLUMN outcome TEXT DEFAULT 'pending' CHECK (outcome IN ('pending', 'accepted', 'replied'));

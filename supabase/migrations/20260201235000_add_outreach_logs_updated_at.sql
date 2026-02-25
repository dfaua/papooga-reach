-- Add updated_at to outreach_logs to track when outcome changes

ALTER TABLE outreach_logs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_outreach_logs_updated_at
    BEFORE UPDATE ON outreach_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Initialize updated_at for existing rows to created_at
UPDATE outreach_logs SET updated_at = created_at WHERE updated_at IS NULL;

-- Add index on updated_at for sorting
CREATE INDEX idx_outreach_logs_updated_at ON outreach_logs(updated_at DESC);

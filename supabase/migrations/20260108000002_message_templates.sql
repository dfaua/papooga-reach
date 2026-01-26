-- Message templates table for managing outreach messages
CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('connection_note', 'message', 'inmail')),
    content TEXT NOT NULL,
    target_roles TEXT[] NOT NULL DEFAULT '{}',
    industry TEXT,
    is_current BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add template_id to outreach_logs to track which template was used
ALTER TABLE outreach_logs ADD COLUMN template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL;

-- Index for finding current templates
CREATE INDEX idx_message_templates_current ON message_templates(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_message_templates_type ON message_templates(type);

-- Enable realtime for message_templates
ALTER PUBLICATION supabase_realtime ADD TABLE message_templates;

-- Trigger for updated_at
CREATE TRIGGER update_message_templates_updated_at
    BEFORE UPDATE ON message_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Profiles & Templates Restructure
-- Profiles are defined by roles + industry, with pain points
-- Templates reference profiles instead of having embedded target_roles

-- Create profiles table first
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roles TEXT[] NOT NULL DEFAULT '{}',
    industry TEXT,
    pain_points TEXT[] NOT NULL DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing message_templates and recreate with profile_id FK
DROP TABLE IF EXISTS message_templates CASCADE;

CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('connection_note', 'message', 'inmail')),
    content TEXT NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_roles ON profiles USING GIN (roles);
CREATE INDEX idx_profiles_industry ON profiles(industry);
CREATE INDEX idx_message_templates_profile ON message_templates(profile_id);
CREATE INDEX idx_message_templates_current ON message_templates(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_message_templates_type ON message_templates(type);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE message_templates;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at
    BEFORE UPDATE ON message_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

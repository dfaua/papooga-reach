-- Messages table for tracking conversations with people
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID REFERENCES people(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sales_navigator', 'linkedin')),
    direction TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying messages by person
CREATE INDEX idx_messages_person_id ON messages(person_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

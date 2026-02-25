-- Add 'email' as a valid message type
ALTER TABLE messages DROP CONSTRAINT messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check CHECK (type IN ('sales_navigator', 'linkedin', 'email'));

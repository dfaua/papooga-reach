-- Disable RLS on google_auth and emails tables (single-user app)
ALTER TABLE google_auth DISABLE ROW LEVEL SECURITY;
ALTER TABLE emails DISABLE ROW LEVEL SECURITY;

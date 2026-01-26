-- Add linkedin_profile_url column to people table
-- This stores the regular LinkedIn profile URL (linkedin.com/in/xxx)
-- while linkedin_url stores the Sales Navigator URL (linkedin.com/sales/lead/xxx)
ALTER TABLE people ADD COLUMN linkedin_profile_url TEXT;

-- Add connections and followers count to people table
ALTER TABLE people ADD COLUMN connections_count INTEGER;
ALTER TABLE people ADD COLUMN followers_count INTEGER;

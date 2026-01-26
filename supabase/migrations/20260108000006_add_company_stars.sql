-- Add stars column to companies table for favouriting
-- 0 = usual, 1 = cool, 2 = favourite
ALTER TABLE companies
ADD COLUMN stars INTEGER DEFAULT 0 CHECK (stars >= 0 AND stars <= 2);

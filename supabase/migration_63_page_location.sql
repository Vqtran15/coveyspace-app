-- Add optional location field to meal_pages and serving_pages.
-- Location is intentionally NOT copied by autoFillPages, so rotating pages start with NULL.

ALTER TABLE meal_pages   ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE serving_pages ADD COLUMN IF NOT EXISTS location TEXT;

-- No RLS changes needed — existing member-read / admin-write policies already cover these tables.

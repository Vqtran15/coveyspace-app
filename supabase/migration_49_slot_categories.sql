ALTER TABLE meal_pages
  ADD COLUMN IF NOT EXISTS slot_categories text[] DEFAULT '{}';

ALTER TABLE meal_pages
  ADD COLUMN IF NOT EXISTS slot_categories text[] DEFAULT '{}';

ALTER TABLE serving_pages
  ADD COLUMN IF NOT EXISTS slot_categories text[] DEFAULT '{}';

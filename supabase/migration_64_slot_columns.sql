-- Add optional slot_columns setting to meal_pages and serving_pages.
-- 1 = single column (default, current behavior), 2 = two columns always.
-- Admins set this in the Edit modal; display in MealPage uses it to choose grid class.

ALTER TABLE meal_pages    ADD COLUMN IF NOT EXISTS slot_columns smallint DEFAULT 1;
ALTER TABLE serving_pages ADD COLUMN IF NOT EXISTS slot_columns smallint DEFAULT 1;

-- Allow groups to schedule meetings on multiple days per week.
-- Converts meal_day_of_week and service_day_of_week from int to int[],
-- preserving existing single-day configs as single-element arrays.

ALTER TABLE group_settings
  ALTER COLUMN meal_day_of_week TYPE int[]
  USING CASE WHEN meal_day_of_week IS NULL THEN NULL ELSE ARRAY[meal_day_of_week] END;

ALTER TABLE group_settings
  ALTER COLUMN service_day_of_week TYPE int[]
  USING CASE WHEN service_day_of_week IS NULL THEN NULL ELSE ARRAY[service_day_of_week] END;

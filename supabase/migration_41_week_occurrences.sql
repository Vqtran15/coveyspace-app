-- migration_41_week_occurrences.sql
-- Add nth-weekday-of-month scheduling columns to group_settings.
-- weekOccurrences is an array of which week numbers (1–5) the group meets.
-- e.g. {1,2,3,4,5} = every week, {2,4} = 2nd & 4th, {1} = first of month.
-- When set, the app uses this instead of meal_interval_days / service_interval_days.

alter table group_settings
  add column if not exists meal_week_occurrences    int[],
  add column if not exists service_week_occurrences int[];

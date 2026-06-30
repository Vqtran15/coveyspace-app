-- migration_40_remove_sample_seed.sql
-- Remove sample data seeding infrastructure — no longer used after onboarding rewrite

alter table group_settings drop column if exists sample_seeded;

drop function if exists seed_group();

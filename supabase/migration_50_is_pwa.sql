-- Migration 50: Track PWA installation per user
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_pwa BOOLEAN DEFAULT FALSE;

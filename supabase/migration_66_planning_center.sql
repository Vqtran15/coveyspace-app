-- Migration 66: Planning Center Online Integration
-- Stores OAuth tokens per group and exposes safe read-only helpers for the browser.
-- Run in Supabase SQL editor: https://app.supabase.com → SQL Editor (project ktmlyzwpgvhrwfgyoeiq)

-- Short-lived CSRF state records to protect the OAuth redirect flow.
CREATE TABLE IF NOT EXISTS pco_oauth_states (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_group_id UUID REFERENCES community_groups(id) ON DELETE CASCADE NOT NULL,
  created_by         UUID REFERENCES auth.users(id) NOT NULL,
  return_url         TEXT NOT NULL,
  expires_at         TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes') NOT NULL
);

-- Enable RLS with no policies on pco_oauth_states: blocks all direct browser access.
-- Edge Functions use the service role key and bypass RLS entirely.
ALTER TABLE pco_oauth_states ENABLE ROW LEVEL SECURITY;

-- Per-group PCO OAuth tokens.
-- Tokens are only ever read by Edge Functions using the service role key.
-- The browser never sees the access_token or refresh_token columns.
CREATE TABLE IF NOT EXISTS planning_center_connections (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_group_id    UUID REFERENCES community_groups(id) ON DELETE CASCADE UNIQUE NOT NULL,
  pco_organization_id   TEXT,
  pco_organization_name TEXT,
  access_token          TEXT NOT NULL,
  refresh_token         TEXT NOT NULL,
  token_expires_at      TIMESTAMPTZ NOT NULL,
  connected_by          UUID REFERENCES auth.users(id),
  connected_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Same for planning_center_connections: tokens must never be visible to browser clients.
ALTER TABLE planning_center_connections ENABLE ROW LEVEL SECURITY;

-- Returns PCO connection metadata (no tokens) for the calling user's group.
CREATE OR REPLACE FUNCTION get_pco_connection()
RETURNS TABLE (
  pco_organization_id   TEXT,
  pco_organization_name TEXT,
  connected_at          TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT pco_organization_id, pco_organization_name, connected_at
  FROM planning_center_connections
  WHERE community_group_id = (
    SELECT community_group_id FROM profiles WHERE user_id = auth.uid()
  );
$$;

-- Given a list of email addresses, returns which ones are already members of
-- the calling user's Covey Space group. Used by the member-import UI to
-- distinguish existing members from people who need an invite.
CREATE OR REPLACE FUNCTION check_pco_members(emails text[])
RETURNS TABLE (email text, in_group boolean)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT e.email,
    (p.user_id IS NOT NULL) AS in_group
  FROM unnest(emails) e(email)
  LEFT JOIN auth.users au ON lower(au.email) = lower(e.email)
  LEFT JOIN profiles p
    ON p.user_id = au.id
   AND p.community_group_id = (
         SELECT community_group_id FROM profiles WHERE user_id = auth.uid()
       );
$$;

-- ─── Secrets ──────────────────────────────────────────────────────────────────
-- Add these in Supabase Dashboard → Settings → Edge Functions Secrets:
--   PCO_CLIENT_ID      — Application ID from your Planning Center OAuth app
--   PCO_CLIENT_SECRET  — Secret from your Planning Center OAuth app
--   APP_URL            — https://app.coveyspace.com
--                        (set to https://staging.app.coveyspace.com for staging)

-- ─── Planning Center OAuth App setup ─────────────────────────────────────────
-- In your PCO developer account, register this as the redirect URI:
--   https://ktmlyzwpgvhrwfgyoeiq.supabase.co/functions/v1/pco-oauth-callback
--
-- Scopes to request: people  groups  giving

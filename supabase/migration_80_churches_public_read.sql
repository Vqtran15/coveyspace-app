-- Migration 80: Allow unauthenticated reads of the churches table
--
-- Bug: AuthPage fetches churches BEFORE the user has a session (for the
-- signup church-picker). The existing RLS policy requires auth.uid() IS NOT NULL,
-- so anonymous requests return empty — no churches populate in the picker.
--
-- Fix: Replace the authenticated-only policy with an unrestricted SELECT policy.
-- Churches only contain {id, name, created_at} — no sensitive data — so public
-- read is safe.
--
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

DROP POLICY IF EXISTS "authenticated users read churches" ON churches;

CREATE POLICY "public read churches" ON churches
  FOR SELECT USING (true);

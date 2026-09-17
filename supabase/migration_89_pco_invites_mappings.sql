-- migration_89: PCO invite tracking, group mappings, and birthday auto-import
--
-- 1. pco_invites: tracks every PCO-sourced invite per email+group.
--    Enables resend, "invited X days ago" status, and birthday pre-population.
-- 2. pco_group_mappings: persists the PCO list → Coveyspace group selection so
--    admins don't have to re-pick the mapping on every visit.
-- 3. on_profile_created_pco_import trigger: when a user joins via a PCO invite,
--    marks the invite as joined and pre-populates profiles.birthday (which then
--    cascades to the birthdays table via the existing sync_profile_birthday trigger).
--
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

-- ── 1. pco_invites ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pco_invites (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id           uuid NOT NULL REFERENCES churches(id)          ON DELETE CASCADE,
  coveyspace_group_id uuid NOT NULL REFERENCES community_groups(id)  ON DELETE CASCADE,
  email               text NOT NULL,
  invited_name        text,
  birthdate           date,
  sent_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  last_sent_at        timestamptz NOT NULL DEFAULT now(),
  send_count          int NOT NULL DEFAULT 1,
  joined_at           timestamptz,
  UNIQUE (email, coveyspace_group_id)
);

ALTER TABLE pco_invites ENABLE ROW LEVEL SECURITY;

-- Church admins can fully manage invites for their church
CREATE POLICY "church admins manage pco invites" ON pco_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM church_roles
      WHERE user_id = auth.uid() AND church_id = pco_invites.church_id
    )
  );

-- ── 2. pco_group_mappings ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pco_group_mappings (
  church_id           uuid NOT NULL REFERENCES churches(id)         ON DELETE CASCADE,
  pco_group_id        text NOT NULL,
  coveyspace_group_id uuid          REFERENCES community_groups(id) ON DELETE SET NULL,
  last_synced_at      timestamptz,
  PRIMARY KEY (church_id, pco_group_id)
);

ALTER TABLE pco_group_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church admins manage pco group mappings" ON pco_group_mappings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM church_roles
      WHERE user_id = auth.uid() AND church_id = pco_group_mappings.church_id
    )
  );

-- ── 3. Birthday auto-import trigger ──────────────────────────────────────────
--
-- Fires BEFORE INSERT on profiles. If a pco_invites row exists for this user's
-- email + group (with no joined_at yet):
--   a. Marks the invite as joined (so the resend button is hidden and the
--      "invited X days ago" status converts to "Member ✓").
--   b. Sets NEW.birthday from the invite's stored birthdate. The existing
--      sync_profile_birthday trigger (AFTER INSERT OR UPDATE OF birthday) then
--      propagates it into the birthdays table automatically.

CREATE OR REPLACE FUNCTION on_profile_created_pco_import()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email    text;
  v_inv_id   uuid;
  v_birthdate date;
BEGIN
  -- Look up the new user's email
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  IF v_email IS NULL THEN RETURN NEW; END IF;

  -- Find a pending PCO invite for this email+group
  SELECT id, birthdate
    INTO v_inv_id, v_birthdate
  FROM pco_invites
  WHERE lower(email) = lower(v_email)
    AND coveyspace_group_id = NEW.community_group_id
    AND joined_at IS NULL
  ORDER BY sent_at DESC
  LIMIT 1;

  IF v_inv_id IS NOT NULL THEN
    -- Mark the invite as accepted
    UPDATE pco_invites SET joined_at = now() WHERE id = v_inv_id;

    -- Pre-populate birthday if PCO provided one and the profile doesn't have one yet
    IF v_birthdate IS NOT NULL AND NEW.birthday IS NULL THEN
      NEW.birthday := v_birthdate;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_pco_import_trigger ON profiles;
CREATE TRIGGER on_profile_created_pco_import_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION on_profile_created_pco_import();

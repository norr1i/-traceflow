-- ══════════════════════════════════════════════════════════════════════════════
-- TraceFlow — Self-Service Onboarding Migration
--
-- Run this in the Supabase SQL editor AFTER supabase_multitenancy_v2.sql.
-- Idempotent: safe to re-run.
--
-- What this adds:
--   1. full_name column on user_profiles
--   2. Updated tf_bootstrap_company trigger — reads company_name from
--      signup metadata and sets role = 'admin' for company creators
--   3. create_my_company(text) — SECURITY DEFINER function for the
--      /onboarding page (users who already have a profile but no company)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. full_name on user_profiles ────────────────────────────────────────────
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS full_name text;

-- ── 2. Updated bootstrap trigger ─────────────────────────────────────────────
-- Fires BEFORE INSERT on user_profiles.
-- If company_id is not already set (new user, not invited):
--   • Reads company_name from auth.users.raw_user_meta_data (set at signup)
--   • Falls back to email-domain name if not provided
--   • Creates the company, sets company_id on the new profile row
--   • Sets role = 'admin' (company creator is always admin)
--   • Stores full_name from metadata if provided

CREATE OR REPLACE FUNCTION tf_bootstrap_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid        uuid;
  user_email text;
  meta_cname text;
  meta_fname text;
  cname      text;
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT
      email,
      raw_user_meta_data->>'company_name',
      raw_user_meta_data->>'full_name'
    INTO user_email, meta_cname, meta_fname
    FROM auth.users
    WHERE id = NEW.user_id;

    -- Prefer metadata company name; fall back to email-domain heuristic
    cname := COALESCE(
      NULLIF(trim(meta_cname), ''),
      CASE
        WHEN user_email IS NOT NULL
          THEN INITCAP(SPLIT_PART(SPLIT_PART(user_email, '@', 2), '.', 1)) || ' Industries'
        ELSE 'My Factory'
      END
    );

    INSERT INTO companies (name, owner_id)
    VALUES (cname, NEW.user_id)
    RETURNING id INTO cid;

    NEW.company_id := cid;
    NEW.role       := 'admin';   -- company creator is always admin

    IF meta_fname IS NOT NULL AND trim(meta_fname) <> '' THEN
      NEW.full_name := trim(meta_fname);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bootstrap_company ON user_profiles;
CREATE TRIGGER trg_bootstrap_company
  BEFORE INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION tf_bootstrap_company();

-- ── 3. create_my_company(p_name) ─────────────────────────────────────────────
-- Called by the /onboarding page for users who already have a user_profiles
-- row but no company_id (e.g. existing users from before multi-tenancy).
-- SECURITY DEFINER so it can write to user_profiles bypassing RLS.

CREATE OR REPLACE FUNCTION create_my_company(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
  uid uuid := auth.uid();
BEGIN
  -- Must be authenticated
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate input
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Company name cannot be empty';
  END IF;

  -- Prevent creating a second company (no privilege escalation)
  IF EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = uid AND company_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;

  -- Create company
  INSERT INTO companies (name, owner_id)
  VALUES (trim(p_name), uid)
  RETURNING id INTO cid;

  -- Upsert user_profiles: INSERT if missing, UPDATE company_id+role if exists
  INSERT INTO user_profiles (user_id, role, company_id)
  VALUES (uid, 'admin', cid)
  ON CONFLICT (user_id) DO UPDATE
    SET company_id = excluded.company_id,
        role       = 'admin';

  RETURN cid;
END;
$$;

GRANT EXECUTE ON FUNCTION create_my_company(text) TO authenticated;

-- ── 4. Verify ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '=== TraceFlow Onboarding Migration Complete ===';
  RAISE NOTICE 'user_profiles.full_name column: ready';
  RAISE NOTICE 'tf_bootstrap_company trigger: updated (reads metadata, sets admin)';
  RAISE NOTICE 'create_my_company() function: ready for /onboarding page';
  RAISE NOTICE 'New signups will automatically get a named company and admin role.';
END;
$$;

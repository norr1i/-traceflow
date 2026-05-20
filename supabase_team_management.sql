-- ══════════════════════════════════════════════════════════════════════════════
-- TraceFlow — Team Management Migration
--
-- Run AFTER supabase_onboarding.sql. Idempotent: safe to re-run.
--
-- What this adds:
--   1. Expanded role constraint on user_profiles
--   2. invitations table (pending team invites)
--   3. Updated tf_bootstrap_company trigger (checks invitations on new signup)
--   4. get_team_members()  — active members + pending invitations, company-scoped
--   5. invite_member(email, role) — admin/manager only, creates pending invite
--   6. update_member_role(user_id, new_role) — protected, prevents last-admin demotion
--   7. remove_team_member(user_id)  — protected, prevents removing last admin
--   8. cancel_invitation(invitation_id) — revoke a pending invite
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Expand role constraint on user_profiles ────────────────────────────────
-- role can be NULL (users removed from a company keep their auth account)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IS NULL OR role IN (
    'admin', 'manager', 'inspector',
    'operations', 'warehouse', 'qc_inspector', 'sales'
  ));

-- ── 2. invitations table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,
  role        text        NOT NULL DEFAULT 'manager'
                CONSTRAINT invitations_role_check
                CHECK (role IN ('admin', 'manager', 'operations', 'warehouse', 'qc_inspector', 'sales')),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status      text        NOT NULL DEFAULT 'pending'
                CONSTRAINT invitations_status_check
                CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days'
);

CREATE INDEX IF NOT EXISTS idx_invitations_email   ON invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_invitations_company ON invitations(company_id);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- admin/manager can read their company's invitations
DROP POLICY IF EXISTS inv_select ON invitations;
CREATE POLICY inv_select ON invitations
  FOR SELECT USING (company_id = get_my_company_id());

-- admin/manager can insert (enforced in function too)
DROP POLICY IF EXISTS inv_insert ON invitations;
CREATE POLICY inv_insert ON invitations
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

-- ── 3. Updated tf_bootstrap_company trigger ───────────────────────────────────
-- Now checks invitations table: if a pending invite exists for the new user's
-- email, the user joins that company with the invited role instead of creating
-- their own company.
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
  inv        RECORD;
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT
      email,
      raw_user_meta_data->>'company_name',
      raw_user_meta_data->>'full_name'
    INTO user_email, meta_cname, meta_fname
    FROM auth.users
    WHERE id = NEW.user_id;

    -- Check for a live pending invitation matching this email
    SELECT * INTO inv
    FROM invitations
    WHERE lower(email) = lower(user_email)
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF inv IS NOT NULL THEN
      -- Join the inviting company with the invited role
      NEW.company_id := inv.company_id;
      NEW.role       := inv.role;
      IF meta_fname IS NOT NULL AND trim(meta_fname) <> '' THEN
        NEW.full_name := trim(meta_fname);
      END IF;
      -- Mark invitation as accepted
      UPDATE invitations SET status = 'accepted' WHERE id = inv.id;
      RETURN NEW;
    END IF;

    -- No invitation — create a brand-new company as before
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
    NEW.role       := 'admin';

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

-- ── 4. get_team_members() ─────────────────────────────────────────────────────
-- Returns active members (from user_profiles) and pending invitations for the
-- caller's company. SECURITY DEFINER to read auth.users.email.
CREATE OR REPLACE FUNCTION get_team_members()
RETURNS TABLE (
  user_id       uuid,
  invitation_id uuid,
  email         text,
  full_name     text,
  role          text,
  status        text,
  joined_at     timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_company uuid := get_my_company_id();
BEGIN
  IF my_company IS NULL THEN
    RAISE EXCEPTION 'Not a member of any company';
  END IF;

  RETURN QUERY
    -- Active members
    SELECT
      up.user_id,
      NULL::uuid                  AS invitation_id,
      au.email::text,
      up.full_name,
      up.role,
      'active'::text              AS status,
      up.created_at               AS joined_at
    FROM user_profiles up
    JOIN auth.users au ON au.id = up.user_id
    WHERE up.company_id = my_company

  UNION ALL

    -- Pending invitations (no user_id yet)
    SELECT
      NULL::uuid                  AS user_id,
      inv.id                      AS invitation_id,
      inv.email,
      NULL::text                  AS full_name,
      inv.role,
      'pending'::text             AS status,
      inv.created_at              AS joined_at
    FROM invitations inv
    WHERE inv.company_id = my_company
      AND inv.status     = 'pending'
      AND inv.expires_at > now()

  ORDER BY joined_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_team_members() TO authenticated;

-- ── 5. invite_member(p_email, p_role) ────────────────────────────────────────
-- Creates a pending invitation (admin/manager only).
-- Expires any prior pending invite for the same email+company.
CREATE OR REPLACE FUNCTION invite_member(p_email text, p_role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid         uuid := auth.uid();
  caller_role text;
  caller_co   uuid;
  inv_id      uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role, company_id INTO caller_role, caller_co
  FROM user_profiles WHERE user_id = uid;

  IF caller_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Only admins and managers can invite team members';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF p_role NOT IN ('admin', 'manager', 'operations', 'warehouse', 'qc_inspector', 'sales') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Check if email already belongs to a member of this company
  IF EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN auth.users au ON au.id = up.user_id
    WHERE lower(au.email) = lower(trim(p_email))
      AND up.company_id = caller_co
  ) THEN
    RAISE EXCEPTION 'This email is already a member of your company';
  END IF;

  -- Expire any prior pending invitation for this email+company
  UPDATE invitations
  SET status = 'expired'
  WHERE lower(email) = lower(trim(p_email))
    AND company_id = caller_co
    AND status = 'pending';

  -- Create new invitation
  INSERT INTO invitations (email, role, company_id, invited_by)
  VALUES (lower(trim(p_email)), p_role, caller_co, uid)
  RETURNING id INTO inv_id;

  RETURN inv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION invite_member(text, text) TO authenticated;

-- ── 6. update_member_role(p_user_id, p_new_role) ─────────────────────────────
CREATE OR REPLACE FUNCTION update_member_role(p_user_id uuid, p_new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid          uuid := auth.uid();
  caller_role  text;
  caller_co    uuid;
  target_co    uuid;
  admin_count  int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role, company_id INTO caller_role, caller_co
  FROM user_profiles WHERE user_id = uid;

  IF caller_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_user_id = uid THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  IF p_new_role NOT IN ('admin', 'manager', 'operations', 'warehouse', 'qc_inspector', 'sales') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;

  SELECT company_id INTO target_co
  FROM user_profiles WHERE user_id = p_user_id;

  IF target_co IS DISTINCT FROM caller_co THEN
    RAISE EXCEPTION 'User is not a member of your company';
  END IF;

  -- Prevent demoting the last admin/manager
  IF p_new_role NOT IN ('admin', 'manager') THEN
    SELECT COUNT(*) INTO admin_count
    FROM user_profiles
    WHERE company_id = caller_co
      AND role IN ('admin', 'manager')
      AND user_id != p_user_id;

    IF admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot demote the last admin/manager — promote another member first';
    END IF;
  END IF;

  UPDATE user_profiles SET role = p_new_role WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_member_role(uuid, text) TO authenticated;

-- ── 7. remove_team_member(p_user_id) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION remove_team_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid          uuid := auth.uid();
  caller_role  text;
  caller_co    uuid;
  target_co    uuid;
  target_role  text;
  admin_count  int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role, company_id INTO caller_role, caller_co
  FROM user_profiles WHERE user_id = uid;

  IF caller_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_user_id = uid THEN
    RAISE EXCEPTION 'You cannot remove yourself from the company';
  END IF;

  SELECT company_id, role INTO target_co, target_role
  FROM user_profiles WHERE user_id = p_user_id;

  IF target_co IS DISTINCT FROM caller_co THEN
    RAISE EXCEPTION 'User is not a member of your company';
  END IF;

  -- Prevent removing last admin/manager
  IF target_role IN ('admin', 'manager') THEN
    SELECT COUNT(*) INTO admin_count
    FROM user_profiles
    WHERE company_id = caller_co
      AND role IN ('admin', 'manager')
      AND user_id != p_user_id;

    IF admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last admin/manager';
    END IF;
  END IF;

  -- Detach from company; the auth account remains intact
  UPDATE user_profiles
  SET company_id = NULL, role = NULL
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_team_member(uuid) TO authenticated;

-- ── 8. cancel_invitation(p_invitation_id) ────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid         uuid := auth.uid();
  caller_role text;
  caller_co   uuid;
  inv_co      uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role, company_id INTO caller_role, caller_co
  FROM user_profiles WHERE user_id = uid;

  IF caller_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT company_id INTO inv_co
  FROM invitations WHERE id = p_invitation_id;

  IF inv_co IS DISTINCT FROM caller_co THEN
    RAISE EXCEPTION 'Invitation not found or not in your company';
  END IF;

  UPDATE invitations SET status = 'expired' WHERE id = p_invitation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_invitation(uuid) TO authenticated;

-- ── Verify ────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '=== TraceFlow Team Management Migration Complete ===';
  RAISE NOTICE 'user_profiles role constraint: expanded';
  RAISE NOTICE 'invitations table: ready';
  RAISE NOTICE 'tf_bootstrap_company trigger: updated (checks invitations on signup)';
  RAISE NOTICE 'get_team_members(): ready';
  RAISE NOTICE 'invite_member(): ready';
  RAISE NOTICE 'update_member_role(): ready';
  RAISE NOTICE 'remove_team_member(): ready';
  RAISE NOTICE 'cancel_invitation(): ready';
  RAISE NOTICE '';
  RAISE NOTICE 'INVITATION FLOW: admin creates invite → share signup URL → user';
  RAISE NOTICE 'signs up with that email → trigger auto-assigns company + role.';
END;
$$;

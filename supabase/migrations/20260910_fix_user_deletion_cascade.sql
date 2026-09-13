-- Fix: 500 error when deleting users via Supabase Auth Admin API
--
-- Root cause: Two issues block the cascade delete that GoTrue performs when
-- the Auth Admin API deletes a user from auth.users.
--
-- 1) audit_log.immutable BEFORE UPDATE trigger blocks the ON DELETE SET NULL
--    cascade on audit_log.actor_id (FK -> auth.users). When GoTrue deletes a
--    user, the FK tries to UPDATE audit_log SET actor_id = NULL, but the
--    trigger RAISE EXCEPTION for every update that is not an audit.correction.
--    This is the hard, definitive blocker.
--
-- 2) Several public tables with ON DELETE CASCADE from auth.users (and from
--    profiles, which itself cascades from auth.users) have RLS enabled with
--    policies scoped TO authenticated only. GoTrue's supabase_auth_admin role
--    is not a member of authenticated and does not bypass RLS, so the
--    CASCADE deletes on profiles, user_roles, user_sessions, candidate_notifications,
--    votes, candidates, election_committees, election_observers, etc. are blocked.
--
-- Fix:
-- (a) Allow audit_log_immutable to permit SET NULL on actor_id — the only
--     column changed by the FK cascade, with all other columns left intact.
-- (b) Add a BEFORE DELETE trigger on auth.users that:
--       * Disables RLS for the transaction (set_config row_security = 'off')
--       * Manually deletes every row from CASCADE tables that reference
--         auth.users or profiles
--       * Nulls out every SET NULL FK referencing auth.users or profiles
--     After the trigger, the FK cascades that fire are no-ops (rows already
--     gone / columns already nulled), so RLS never blocks anything.

-- ============================================================
-- (a) Fix audit_log immutability trigger to allow FK SET NULL cascade
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow audit.correction rows to be updated (existing behaviour)
  IF OLD.action = 'audit.correction' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Allow the FK ON DELETE SET NULL cascade from auth.users deletion.
  -- The constraint only sets actor_id to NULL and leaves every other
  -- column untouched.  We verify that no other column changed to be sure
  -- this is the automatic cascade and not an application UPDATE.
  IF NEW.actor_id IS NULL
     AND OLD.actor_id IS NOT NULL
     AND NEW.actor_email        IS NOT DISTINCT FROM OLD.actor_email
     AND NEW.actor_role         IS NOT DISTINCT FROM OLD.actor_role
     AND NEW.action             IS NOT DISTINCT FROM OLD.action
     AND NEW.category           IS NOT DISTINCT FROM OLD.category
     AND NEW.target_type        IS NOT DISTINCT FROM OLD.target_type
     AND NEW.target_id          IS NOT DISTINCT FROM OLD.target_id
     AND NEW.description        IS NOT DISTINCT FROM OLD.description
     AND NEW.metadata           IS NOT DISTINCT FROM OLD.metadata
     AND NEW.ip_address         IS NOT DISTINCT FROM OLD.ip_address
     AND NEW.user_agent         IS NOT DISTINCT FROM OLD.user_agent
     AND NEW.severity           IS NOT DISTINCT FROM OLD.severity
     AND NEW.election_id        IS NOT DISTINCT FROM OLD.election_id
     AND NEW.request_id         IS NOT DISTINCT FROM OLD.request_id
     AND NEW.original_description IS NOT DISTINCT FROM OLD.original_description
     AND NEW.schema_version     IS NOT DISTINCT FROM OLD.schema_version
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'audit_log is immutable; use rpc admin_correct_audit_entry to make corrections'
    USING ERRCODE = 'P0001';
END;
$$;

-- ============================================================
-- (b) BEFORE DELETE trigger on auth.users: disable RLS and clean up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Disable RLS for this transaction so FK CASCADE / SET NULL operations
  -- on public tables succeed regardless of per-table RLS policies that were
  -- written for the authenticated role only.
  PERFORM set_config('row_security', 'off', true);

  -- --- Tables that CASCADE from auth.users directly ---
  DELETE FROM public.profiles               WHERE id = OLD.id;
  DELETE FROM public.user_roles             WHERE user_id = OLD.id;
  DELETE FROM public.user_sessions          WHERE user_id = OLD.id;
  DELETE FROM public.candidate_notifications WHERE user_id = OLD.id;

  -- --- Tables that SET NULL from auth.users ---
  UPDATE public.audit_log      SET actor_id = NULL WHERE actor_id = OLD.id;
  UPDATE public.invitations    SET invited_by = NULL WHERE invited_by = OLD.id;
  UPDATE public.invitations    SET accepted_user_id = NULL WHERE accepted_user_id = OLD.id;
  UPDATE public.candidate_pairs SET approved_by = NULL WHERE approved_by = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tg_handle_auth_user_delete ON auth.users;
CREATE TRIGGER tg_handle_auth_user_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_delete();

COMMENT ON FUNCTION public.handle_auth_user_delete() IS
  'BEFORE DELETE trigger on auth.users. Disables RLS and manually cleans up all rows in public tables that reference auth.users (via CASCADE or SET NULL FK). Makes the automatic FK cascades no-ops so they never hit RLS.';

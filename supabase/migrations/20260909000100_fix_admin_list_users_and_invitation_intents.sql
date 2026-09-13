-- Fix runtime errors that remained after the 20260909 repair migration.
--
-- 1) admin_list_users failed with:
--      42804: structure of query does not match function result type
--      "Returned type character varying(255) does not match expected type
--       text in column 4"
--    auth.users.email is varchar(255), but the RETURNS TABLE declared TEXT.
--    PostgREST invokes the function and PostgreSQL rejects the implicit
--    varchar->text coercion in RETURN QUERY.  Cast the email explicitly and
--    drop/recreate the function (CREATE OR REPLACE cannot change the return
--    shape in place).
--
-- 2) The invitations.intent CHECK still only allows
--    ('register','candidate','voter_group'), but the repair migration and the
--    admin UI now also use 'committee' and 'observer'.  Creating such an
--    invitation failed with 23514 until the constraint is widened.

-- ============================================================
-- 1) admin_list_users with explicit auth.users.email cast
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  student_id TEXT,
  email TEXT,
  department TEXT,
  class_id UUID,
  class_name TEXT,
  roles public.app_role[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.caller_has_permission('user.edit'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.edit' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.student_id,
    u.email::TEXT,
    p.department,
    p.class_id,
    c.name,
    COALESCE(
      array_agg(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),
      ARRAY[]::public.app_role[]
    )
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.classes c ON c.id = p.class_id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  GROUP BY p.id, p.full_name, p.student_id, u.email, p.department, p.class_id, c.name, p.created_at
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Same varchar->text mismatch exists in admin_create_invitation's
-- RETURNING invitations.token path? No - invitations.token is TEXT. But
-- admin_lookup_user_id_by_email returns auth.users.id (UUID, fine) and
-- get_user_email returns TEXT while selecting auth.users.email into a TEXT
-- variable, which PostgreSQL coerces silently. Only the set-returning
-- functions exposed through PostgREST needed the fix above.

-- ============================================================
-- 2) Widen invitations.intent for committee/observer invitations
-- ============================================================
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_intent_check;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_intent_check CHECK (
    intent IN ('register', 'candidate', 'voter_group', 'committee', 'observer')
  );

-- Backfill the global committee/observer role for users that already have an
-- active assignment, mirroring the repair migration for rows created since.
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'committee'::public.app_role
FROM public.election_committees
WHERE revoked_at IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'observer'::public.app_role
FROM public.election_observers
WHERE revoked_at IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- 3) Election-event SELECT policies still reference the removed
--    'active'/'closed' statuses.  After the phase2 state machine
--    migration, status only contains draft/registration/voting/
--    counting/published/archived, so those policies match zero rows
--    and voters could not see any event at all.  Recreate them
--    against the current lifecycle statuses.
-- ============================================================
DROP POLICY IF EXISTS "Everyone can view active and closed events" ON public.election_events;
CREATE POLICY "Everyone can view active and closed events"
  ON public.election_events FOR SELECT
  TO authenticated
  USING (
    status IN ('voting', 'counting', 'published', 'archived')
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Committee and observers view their assigned elections" ON public.election_events;
CREATE POLICY "Committee and observers view their assigned elections"
  ON public.election_events FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR status IN ('draft', 'registration', 'voting', 'counting', 'published', 'archived')
    OR public.can_access_election(auth.uid(), id)
  );

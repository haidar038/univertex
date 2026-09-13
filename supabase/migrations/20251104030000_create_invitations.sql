-- Migration: Create invitations table
-- Allows admin/committee to invite people to register or to register them
-- as candidates in a specific election event. Replaces the public sign-up flow.

CREATE TABLE IF NOT EXISTS public.invitations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Email of the invitee (may not yet be a user)
  email             TEXT NOT NULL,
  full_name         TEXT,
  student_id        TEXT,
  -- What kind of invitation is this?
  --   'register'        -> create a user account for the invitee
  --   'candidate'       -> create the user and add them as candidate to the event
  --   'voter_group'     -> invite a whole class into a event_voter_groups row (handled via class_id)
  intent            TEXT NOT NULL CHECK (intent IN ('register', 'candidate', 'voter_group')),
  event_id          UUID REFERENCES public.election_events(id) ON DELETE CASCADE,
  class_id          UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  roles             TEXT[] NOT NULL DEFAULT ARRAY['voter']::TEXT[],   -- intended roles for the invited user
  -- Token used in the magic URL
  token             TEXT NOT NULL UNIQUE,
  expires_at        TIMESTAMPTZ NOT NULL,
  accepted_at       TIMESTAMPTZ,
  accepted_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at        TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_invitations_email      ON public.invitations (email);
CREATE INDEX IF NOT EXISTS idx_invitations_event      ON public.invitations (event_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token      ON public.invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_active     ON public.invitations (expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE public.invitations IS
  'Invite-only onboarding flow. Admins create an invitation row + token; the recipient uses a magic-link to set up their account or accept candidacy.';

-- user_roles needs a UNIQUE (user_id, role) constraint for the
-- ON CONFLICT clause in redeem_invitation() below. The original schema only
-- had a PK on id, which would make redeem fail with
-- "no unique or exclusion constraint matching the ON CONFLICT specification".
-- Also clean up any duplicate rows first so the constraint can be applied.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_id_role_key'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    DELETE FROM public.user_roles a
     USING public.user_roles b
     WHERE a.id > b.id
       AND a.user_id = b.user_id
       AND a.role = b.role;

    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admins manage invitations" ON public.invitations;
CREATE POLICY "Admins manage invitations"
  ON public.invitations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- A user can see invitations addressed to their email (used for "accept invite" UI)
-- NOTE (fix): the original policy read auth.users directly, which the
-- `authenticated` role cannot access - the subquery always failed and users
-- could never see their own invitations. The email is available in the JWT
-- itself, so we compare against auth.jwt() ->> 'email' instead.
DROP POLICY IF EXISTS "Users see invitations for their own email" ON public.invitations;
CREATE POLICY "Users see invitations for their own email"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- RPC: redeem an invitation token. Creates a new auth user if needed and assigns
-- the requested roles. Returns the new (or existing) user id.
CREATE OR REPLACE FUNCTION public.redeem_invitation(p_token TEXT)
RETURNS TABLE (
  user_id        UUID,
  email          TEXT,
  invitation_id  UUID,
  intent         TEXT,
  event_id       UUID,
  class_id       UUID,
  roles          TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv  public.invitations%ROWTYPE;
  v_uid  UUID := auth.uid();
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv
    FROM public.invitations
   WHERE token = p_token
     AND accepted_at IS NULL
     AND revoked_at IS NULL
   LIMIT 1;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found or already used';
  END IF;

  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- The invitee must match the logged-in user
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS DISTINCT FROM v_inv.email THEN
    RAISE EXCEPTION 'This invitation is for a different email';
  END IF;

  -- Update profile fields from the invitation
  UPDATE public.profiles
     SET full_name  = COALESCE(v_inv.full_name, full_name),
         student_id = COALESCE(v_inv.student_id, student_id),
         class_id   = COALESCE(v_inv.class_id, class_id)
   WHERE id = v_uid;

  -- Assign roles
  IF v_inv.roles IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT v_uid, UNNEST(v_inv.roles)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Mark as accepted
  UPDATE public.invitations
     SET accepted_at = now(),
         accepted_user_id = v_uid
   WHERE id = v_inv.id;

  RETURN QUERY
    SELECT v_uid, v_email, v_inv.id, v_inv.intent, v_inv.event_id, v_inv.class_id, v_inv.roles;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;



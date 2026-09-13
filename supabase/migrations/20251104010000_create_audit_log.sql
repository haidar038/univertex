-- Migration: Create audit_log table
-- A general-purpose append-only ledger of important admin actions and
-- security-relevant events (login attempts, account changes, election changes, etc.).

CREATE TABLE IF NOT EXISTS public.audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email   TEXT,
  actor_role    TEXT,
  action        TEXT NOT NULL,             -- e.g. 'event.create', 'candidate.approve', 'user.delete'
  category      TEXT NOT NULL DEFAULT 'admin',
                                     -- 'admin' | 'auth' | 'election' | 'security'
  target_type   TEXT,                  -- e.g. 'election_events', 'candidates'
  target_id     TEXT,                  -- textual so non-uuid ids are also captured
  description   TEXT NOT NULL,         -- human-readable summary
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address    INET,
  user_agent    TEXT,
  severity      TEXT NOT NULL DEFAULT 'info'
                                     -- 'info' | 'warning' | 'critical'
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor     ON public.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action    ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_category  ON public.audit_log (category);
CREATE INDEX IF NOT EXISTS idx_audit_log_target    ON public.audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created   ON public.audit_log (created_at DESC);

COMMENT ON TABLE public.audit_log IS
  'Append-only audit trail of admin actions and security-relevant events. Only admins can read; insertions are allowed via SECURITY DEFINER functions or directly by admins.';

-- Enable RLS - default deny
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins may read everything
DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
CREATE POLICY "Admins can view audit log"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins may insert directly (useful when the action and the log happen in the same context)
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.audit_log;
CREATE POLICY "Admins can insert audit log"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- No UPDATE/DELETE policy -> immutable

-- RPC helper used by the application to insert a row consistently.
-- Returns the new id so the caller can correlate.
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action        TEXT,
  p_description   TEXT,
  p_category      TEXT DEFAULT 'admin',
  p_target_type   TEXT DEFAULT NULL,
  p_target_id     TEXT DEFAULT NULL,
  p_metadata      JSONB DEFAULT '{}'::jsonb,
  p_severity      TEXT DEFAULT 'info',
  p_ip_address    INET DEFAULT NULL,
  p_user_agent    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_email    TEXT;
  v_role     TEXT;
  v_new_id   UUID;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_actor_id;
    SELECT role INTO v_role
      FROM public.user_roles
     WHERE user_id = v_actor_id
     ORDER BY CASE role
                WHEN 'admin' THEN 1
                WHEN 'candidate' THEN 2
                WHEN 'voter' THEN 3
                ELSE 4
              END
     LIMIT 1;
  END IF;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, category, target_type, target_id,
    description, metadata, severity,
    ip_address, user_agent
  ) VALUES (
    v_actor_id, v_email, v_role,
    p_action, p_category, p_target_type, p_target_id,
    p_description, COALESCE(p_metadata, '{}'::jsonb), p_severity,
    p_ip_address, p_user_agent
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(
  TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, INET, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.log_audit_event IS
  'Insert a row into audit_log with the current user as actor. Bypasses RLS because it is SECURITY DEFINER, but only authenticated callers may invoke it.';

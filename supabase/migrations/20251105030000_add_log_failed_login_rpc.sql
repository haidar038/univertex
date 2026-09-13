-- Migration: Add log_failed_login RPC (anon-callable)
--
-- Problem: failed-login audit entries were never recorded. The old flow
-- called log_audit_event from the browser AFTER signInWithPassword failed -
-- but at that point the caller is still `anon`, and log_audit_event is only
-- granted to `authenticated`, so the insert was silently rejected.
--
-- This dedicated RPC is granted to anon AND authenticated with an internal
-- rate limit (max 10 entries per email per 15 minutes) so it cannot be used
-- to spam the audit log. The only client-controllable field is the email.

CREATE OR REPLACE FUNCTION public.log_failed_login(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent INTEGER;
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN; -- nothing useful to log
  END IF;

  -- Rate limit: skip when more than 10 entries for this email in 15 minutes
  SELECT COUNT(*) INTO v_recent
    FROM public.audit_log
   WHERE action = 'auth.login.failed'
     AND metadata->>'email' = lower(btrim(p_email))
     AND created_at > now() - interval '15 minutes';

  IF v_recent >= 10 THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, category, target_type, target_id,
    description, metadata, severity,
    ip_address, user_agent
  ) VALUES (
    NULL, lower(btrim(p_email)), NULL,
    'auth.login.failed', 'security', 'auth.users', NULL,
    'Failed login attempt for ' || lower(btrim(p_email)),
    jsonb_build_object('email', lower(btrim(p_email))),
    'warning',
    NULL, NULL
  );
END;
$$;

-- Narrow the default PUBLIC grant; anon + authenticated both call this.
REVOKE EXECUTE ON FUNCTION public.log_failed_login(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_failed_login(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.log_failed_login(TEXT) TO authenticated;

COMMENT ON FUNCTION public.log_failed_login(TEXT) IS
  'Anon-callable audit entry for failed login attempts. Rate limited to 10 rows per email per 15 minutes.';

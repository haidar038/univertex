-- Ensure audit views execute with the querying user's permissions and RLS
-- policies, rather than the view owner's permissions.
--
-- Both views are intentionally still selectable by authenticated users. With
-- security_invoker enabled, the existing `audit_log` SELECT policy permits
-- rows only for admins, while other users receive no audit rows.

BEGIN;

ALTER VIEW public.election_audit_trail
  SET (security_invoker = true);

ALTER VIEW public.election_audit_by_election
  SET (security_invoker = true);

-- No anonymous or PUBLIC access should be possible even if database defaults
-- are changed later. Keep the existing authenticated application access.
REVOKE ALL ON public.election_audit_trail FROM PUBLIC, anon;
REVOKE ALL ON public.election_audit_by_election FROM PUBLIC, anon;
GRANT SELECT ON public.election_audit_trail TO authenticated;
GRANT SELECT ON public.election_audit_by_election TO authenticated;

COMMENT ON VIEW public.election_audit_trail IS
  'Per-election audit trail. SECURITY INVOKER: access is filtered by underlying table grants and RLS.';

COMMENT ON VIEW public.election_audit_by_election IS
  'Audit log by election. SECURITY INVOKER: access is filtered by underlying table grants and RLS.';

COMMIT;

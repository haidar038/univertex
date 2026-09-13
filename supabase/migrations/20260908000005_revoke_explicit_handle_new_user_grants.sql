-- Existing deployments granted this internal trigger function directly to the
-- API roles. REVOKE FROM PUBLIC is insufficient for those explicit ACL rows.
-- Trigger execution remains unaffected; only direct RPC invocation is removed.

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM anon, authenticated, service_role;

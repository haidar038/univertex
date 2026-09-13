-- handle_new_user is an auth.users trigger function, not a PostgREST RPC.
-- SECURITY DEFINER is required so the auth trigger can create rows in public,
-- but no API role should be able to invoke this function directly.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

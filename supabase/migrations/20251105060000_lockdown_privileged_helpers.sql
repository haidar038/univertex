-- Migration: Lock down privileged helper RPCs (defense in depth)
--
-- The security advisor flagged that `make_user_admin` (SECURITY DEFINER,
-- grants the admin role to ANY email with no caller check) and
-- `create_admin_user` (placeholder that echoes setup instructions) were
-- executable by anon/authenticated via PostgREST. make_user_admin is a
-- privilege-escalation primitive: any caller could self-promote to admin.
--
-- Neither function is needed by the application at runtime (admin
-- promotion is done via SQL console by the operator), so revoke all
-- API-role execution. Only postgres/service_role retain access.

REVOKE EXECUTE ON FUNCTION public.make_user_admin(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_admin_user(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

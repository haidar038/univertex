-- Migration: Fase 3 M1.2 — has_permission + caller_has_permission helpers
--
-- Adds two SECURITY DEFINER helpers that drive the new permission-based
-- RBAC sweep (M2):
--
--   public.has_permission(p_user_id, p_permission)
--     -> TRUE if user has 'admin' role OR any of the user's roles maps
--        to p_permission in role_permissions.
--
--   public.caller_has_permission(p_permission)
--     -> same but auth.uid() is implicit. Convenient in RPC bodies.
--
-- Both functions are STABLE so the planner can use them in indexes.
-- They are SECURITY DEFINER so they can read role_permissions / user_roles
-- without the caller needing table-level grants.
--
-- The 'admin' check is an early short-circuit; admins are seeded with all
-- permissions in role_permissions, so even without the short-circuit the
-- result would be TRUE. Keeping the short-circuit avoids the join when
-- the caller is admin.

CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id    UUID,
  p_permission public.permission_key
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(p_user_id, 'admin'::app_role) THEN TRUE
    ELSE EXISTS (
      SELECT 1
        FROM public.role_permissions rp
        JOIN public.user_roles ur ON ur.role = rp.role
       WHERE ur.user_id = p_user_id
         AND rp.permission = p_permission
    )
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(UUID, public.permission_key) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, public.permission_key) TO authenticated;

CREATE OR REPLACE FUNCTION public.caller_has_permission(
  p_permission public.permission_key
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission(auth.uid(), p_permission);
$$;

REVOKE EXECUTE ON FUNCTION public.caller_has_permission(public.permission_key) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.caller_has_permission(public.permission_key) TO authenticated;

COMMENT ON FUNCTION public.has_permission(UUID, public.permission_key) IS
  'Permission check. TRUE if user has admin role OR any role mapped to the permission via role_permissions. SECURITY DEFINER bypasses RLS.';

COMMENT ON FUNCTION public.caller_has_permission(public.permission_key) IS
  'Convenience wrapper: same as has_permission but uses auth.uid().';

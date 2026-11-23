-- Pagination server-side untuk halaman Manajemen Pengguna.
--
-- admin_list_users() mengembalikan SEMUA profil; PostgREST memotong ±1000
-- baris, lalu UI membuang 1 admin → hanya 999 yang tampil padahal data aktif
-- ~1600. RPC ini melakukan filter admin, pencarian, count, dan LIMIT/OFFSET
-- di database supaya UI hanya menerima 1 halaman (max 100 baris).

CREATE OR REPLACE FUNCTION public.admin_list_users_paged(
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  student_id TEXT,
  email TEXT,
  department TEXT,
  class_id UUID,
  class_name TEXT,
  roles public.app_role[],
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search TEXT := NULLIF(BTRIM(p_search), '');
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.caller_has_permission('user.edit'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin user.edit' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.id,
      p.full_name,
      p.student_id,
      u.email::TEXT AS email,
      p.department,
      p.class_id,
      c.name AS class_name,
      COALESCE(
        array_agg(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),
        ARRAY[]::public.app_role[]
      ) AS roles,
      p.created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.classes c ON c.id = p.class_id
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur_admin
      WHERE ur_admin.user_id = p.id
        AND ur_admin.role = 'admin'::public.app_role
    )
    AND (
      v_search IS NULL
      OR p.full_name ILIKE '%' || v_search || '%'
      OR p.student_id ILIKE '%' || v_search || '%'
      OR u.email::TEXT ILIKE '%' || v_search || '%'
    )
    GROUP BY
      p.id, p.full_name, p.student_id, u.email,
      p.department, p.class_id, c.name, p.created_at
  )
  SELECT
    f.id,
    f.full_name,
    f.student_id,
    f.email,
    f.department,
    f.class_id,
    f.class_name,
    f.roles,
    COUNT(*) OVER()::BIGINT AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  OFFSET v_offset
  LIMIT v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users_paged(INT, INT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users_paged(INT, INT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.admin_list_users_paged(INT, INT, TEXT) IS
  'Requires user.edit. Halaman pengguna + total_count; admin dikecualikan di SQL agar tidak ada off-by-one pasca PostgREST cap.';

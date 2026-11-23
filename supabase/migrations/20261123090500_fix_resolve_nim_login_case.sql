-- Resolver NIM sebelumnya memakai perbandingan eksak (`p.student_id = v_identifier`),
-- sehingga NIM dengan huruf kapital/berbeda case gagal dicari saat dipakai sebagai
-- identifier. Password sudah case-insensitive, jadi identifier juga disamakan.

CREATE OR REPLACE FUNCTION public.resolve_nim_login(p_identifier TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  student_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identifier TEXT := BTRIM(COALESCE(p_identifier, ''));
BEGIN
  IF v_identifier = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    p.student_id
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(v_identifier)
     OR lower(BTRIM(p.student_id)) = lower(v_identifier)
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_nim_login(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_nim_login(TEXT) TO service_role;

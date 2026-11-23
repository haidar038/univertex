-- Resolver identitas untuk login paralel NIM-as-password.
--
-- Edge Function nim-login berjalan dengan service_role dan perlu memetakan
-- email/NIM yang diketik user ke (user_id, email, student_id). auth.users
-- tidak bisa dibaca lewat PostgREST biasa, jadi dibungkus RPC SECURITY
-- DEFINER yang hanya bisa dipanggil service_role. Tidak mengembalikan hash
-- password dan tidak mengubah password tersimpan (PIN blast tetap berlaku).

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
     OR p.student_id = v_identifier
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_nim_login(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_nim_login(TEXT) TO service_role;

COMMENT ON FUNCTION public.resolve_nim_login(TEXT) IS
  'Service-role only. Resolve email/NIM ke identitas untuk verifikasi NIM-as-password. Tanpa email dikirim.';

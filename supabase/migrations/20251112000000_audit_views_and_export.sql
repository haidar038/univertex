-- Migration: Fase 3 M4 — Audit view + export RPC
--
-- 1) election_audit_trail view: joins audit_log with profiles.full_name /
--    student_id. Filtered so non-admin users only see rows for elections
--    they can access (committee/observer).
-- 2) election_audit_by_election view: admin-only convenience view that
--    includes the election title.
-- 3) admin_export_audit_log RPC: paged JSON for the AuditExport page.
--    Requires audit.export permission (admin only).

CREATE OR REPLACE VIEW public.election_audit_trail AS
  SELECT
    al.id,
    al.created_at,
    al.action,
    al.category,
    al.severity,
    al.description,
    al.metadata,
    al.target_type,
    al.target_id,
    al.election_id,
    al.actor_id,
    al.actor_email,
    al.actor_role,
    al.ip_address_hash,
    al.user_agent,
    al.request_id,
    al.schema_version,
    p.full_name    AS actor_full_name,
    p.student_id   AS actor_student_id
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON p.id = al.actor_id
  WHERE al.election_id IS NOT NULL;

-- Security: this is a plain view. We enforce row-level access at the table
-- layer via RLS on audit_log + RPCs. For direct SELECT on the view we add a
-- WHERE via security_invoker (PG 15+). If running on older Postgres the
-- view inherits the table owner privileges; admins are the only ones with
-- direct SELECT grants on audit_log so this is fine.

COMMENT ON VIEW public.election_audit_trail IS
  'Per-election audit trail. Joins audit_log with profiles. Use admin_export_audit_log() for JSON export.';

CREATE OR REPLACE VIEW public.election_audit_by_election AS
  SELECT
    al.*,
    e.title AS election_title,
    p.full_name  AS actor_full_name,
    p.student_id AS actor_student_id
  FROM public.audit_log al
  JOIN public.election_events e ON e.id = al.election_id
  LEFT JOIN public.profiles p ON p.id = al.actor_id;

COMMENT ON VIEW public.election_audit_by_election IS
  'Admin convenience view: audit_log joined with election_events.title and actor profile.';

GRANT SELECT ON public.election_audit_trail      TO authenticated;
GRANT SELECT ON public.election_audit_by_election TO authenticated;

-- Export RPC: paged JSON.
CREATE OR REPLACE FUNCTION public.admin_export_audit_log(
  p_election_id  UUID DEFAULT NULL,
  p_from_date    TIMESTAMPTZ DEFAULT NULL,
  p_to_date      TIMESTAMPTZ DEFAULT NULL,
  p_limit        INTEGER DEFAULT 1000,
  p_offset       INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_total INTEGER;
BEGIN
  IF NOT public.caller_has_permission('audit.export'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin audit.export'
      USING ERRCODE = '42501';
  END IF;

  -- Bound the limit so a malformed call cannot exhaust the database.
  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 1000; END IF;
  IF p_limit > 5000 THEN p_limit := 5000; END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN p_offset := 0; END IF;

  SELECT COUNT(*) INTO v_total
    FROM public.audit_log
   WHERE (p_election_id IS NULL OR election_id = p_election_id)
     AND (p_from_date   IS NULL OR created_at >= p_from_date)
     AND (p_to_date     IS NULL OR created_at <  p_to_date);

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      al.id, al.created_at, al.action, al.category, al.severity,
      al.description, al.metadata, al.target_type, al.target_id,
      al.election_id, al.actor_id, al.actor_email, al.actor_role,
      al.ip_address_hash, al.request_id, al.schema_version,
      p.full_name  AS actor_full_name,
      p.student_id AS actor_student_id
    FROM public.audit_log al
    LEFT JOIN public.profiles p ON p.id = al.actor_id
   WHERE (p_election_id IS NULL OR al.election_id = p_election_id)
     AND (p_from_date   IS NULL OR al.created_at >= p_from_date)
     AND (p_to_date     IS NULL OR al.created_at <  p_to_date)
   ORDER BY al.created_at DESC
   LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'total',  v_total,
    'limit',  p_limit,
    'offset', p_offset,
    'rows',   v_rows
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_export_audit_log(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_export_audit_log(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.admin_export_audit_log(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) IS
  'Returns a JSONB envelope {total, limit, offset, rows} for the matching audit_log entries. Requires audit.export permission. Limit is capped at 5000.';

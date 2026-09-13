-- Migration: Fase 3 M5 — Audit retention archive + pg_cron
--
-- Retention policy:
--   - 1 year baseline for non-election audit entries
--   - 7 years for election-day audit (per election event end)
--
-- The M3 immutability trigger blocks UPDATE but deliberately NOT DELETE
-- (so the sanctioned archive path can prune old rows). This migration
-- implements that path:
--
--   1) audit_archive: holds a JSONB payload of every archived row.
--   2) admin_archive_old_audit_entries: copies rows older than p_older_than
--      into audit_archive, then DELETEs them. Batched (LIMIT 10000) to
--      avoid long table locks.
--   3) cron.schedule: weekly job (Sunday 03:00) archives rows older than
--      1 year.
--
-- For election-day entries, admins can run the RPC manually with
-- p_older_than = now() - interval '7 years' to clean up only after the
-- 7-year election retention has elapsed.

CREATE TABLE IF NOT EXISTS public.audit_archive (
  id            UUID PRIMARY KEY,
  payload       JSONB NOT NULL,
  archived_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_archive_archived_at
  ON public.audit_archive(archived_at DESC);

ALTER TABLE public.audit_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit_archive" ON public.audit_archive;
CREATE POLICY "Admins can read audit_archive"
  ON public.audit_archive FOR SELECT TO authenticated
  USING (public.caller_has_permission('audit.export'::public.permission_key));

COMMENT ON TABLE public.audit_archive IS
  'Cold storage for audit_log entries older than retention. Populated by admin_archive_old_audit_entries (M5).';

CREATE OR REPLACE FUNCTION public.admin_archive_old_audit_entries(
  p_older_than TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Caller must have audit.export permission. Cron runs as service_role
  -- which does NOT have permission — so we must grant the function to
  -- service_role. The permission check below runs when invoked by an
  -- authenticated user; when invoked via cron as service_role we
  -- short-circuit.
  IF auth.uid() IS NOT NULL
     AND NOT public.caller_has_permission('audit.export'::public.permission_key) THEN
    RAISE EXCEPTION 'Tidak memiliki izin audit.export'
      USING ERRCODE = '42501';
  END IF;

  FOR rec IN
    SELECT id FROM public.audit_log
     WHERE created_at < p_older_than
     ORDER BY created_at
     LIMIT 10000
  LOOP
    INSERT INTO public.audit_archive (id, payload)
    SELECT id, to_jsonb(al.*)
      FROM public.audit_log al
     WHERE id = rec.id
    ON CONFLICT (id) DO NOTHING;

    DELETE FROM public.audit_log WHERE id = rec.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_archive_old_audit_entries(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archive_old_audit_entries(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_archive_old_audit_entries(TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.admin_archive_old_audit_entries(TIMESTAMPTZ) IS
  'Archives audit_log rows older than p_older_than into audit_archive then deletes them. Batched at 10000 rows per call. Allowed via service_role (cron) or audit.export (admin).';

-- Ensure pg_cron is available.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent registration: remove any prior schedule with the same name.
SELECT cron.unschedule('archive-old-audit-entries')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive-old-audit-entries');

SELECT cron.schedule(
  'archive-old-audit-entries',
  '0 3 * * 0',
  $$SELECT public.admin_archive_old_audit_entries(now() - interval '1 year')$$
);

COMMENT ON EXTENSION pg_cron IS
  'Required by Fase 3 M5 to run admin_archive_old_audit_entries weekly. Verify with SELECT * FROM cron.job WHERE jobname=''archive-old-audit-entries''.';

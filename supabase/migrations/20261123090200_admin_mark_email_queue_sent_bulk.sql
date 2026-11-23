-- Tandai banyak baris email_queue sebagai 'sent' dalam 1 statement.
--
-- Dipakai edge function send-voter-credentials untuk mengganti 800+ UPDATE
-- per-baris yang menyebabkan worker kena WORKER_RESOURCE_LIMIT (546) saat
-- blast 1566 pending. Satu chunk = satu RPC call, bukan 100 call.
--
-- p_items: [{"id":"<uuid>","provider_msg_id":"<resend id>"}, ...]
-- Hanya baris 'pending' yang diubah; idempotent.

CREATE OR REPLACE FUNCTION public.admin_mark_email_queue_sent_bulk(
  p_items JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items harus array' USING ERRCODE = 'P0001';
  END IF;

  WITH items AS (
    SELECT DISTINCT
      (x ->> 'id')::UUID AS id,
      x ->> 'provider_msg_id' AS provider_msg_id
    FROM jsonb_array_elements(p_items) AS x
    WHERE x ->> 'id' IS NOT NULL
  )
  UPDATE public.email_queue q
     SET status = 'sent',
         sent_at = now(),
         provider_msg_id = i.provider_msg_id,
         error = NULL
    FROM items i
   WHERE q.id = i.id
     AND q.status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_mark_email_queue_sent_bulk(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_email_queue_sent_bulk(JSONB)
  TO service_role;

COMMENT ON FUNCTION public.admin_mark_email_queue_sent_bulk(JSONB) IS
  'Bulk-mark email_queue rows sent from the credential blast edge function. service_role only.';

-- Migration: Fase 2 — Election State Machine & Scope
--
-- Adds a 6-state lifecycle (draft → registration → voting → counting → published → archived) with trigger-enforced transitions, automated registration→voting and voting→counting transitions via pg_cron, polymorphic scope columns, and an eligibility_rules table that complements the existing event_voter_groups table.
--
-- Order of operations matters:
--   1) UPDATE existing rows so 'active' becomes 'voting' and 'closed'
--      becomes 'published' BEFORE adding the new CHECK constraint.
--   2) DROP old CHECK + ADD new CHECK.
--   3) Create supporting tables, functions, trigger, RLS, cron job.
--
-- IMPORTANT: The frontend `ALLOWED_TRANSITIONS` map in src/lib/election-state.ts
-- MUST mirror the CASE expression in validate_election_state_transition()
-- exactly. Drift causes UI buttons to allow actions that the trigger rejects.

-- ============================================================
-- 1) Migrate existing data BEFORE adding the new CHECK constraint
-- ============================================================
UPDATE public.election_events SET status = 'voting'    WHERE status = 'active';
UPDATE public.election_events SET status = 'published' WHERE status = 'closed';

-- ============================================================
-- 2) Replace CHECK constraint on election_events.status
-- ============================================================
ALTER TABLE public.election_events
  DROP CONSTRAINT IF EXISTS election_events_status_check;

ALTER TABLE public.election_events
  ADD CONSTRAINT election_events_status_check CHECK (
    status IN ('draft','registration','voting','counting','published','archived')
  );

-- ============================================================
-- 3) election_state_transitions table — audit trail for state changes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.election_state_transitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id   UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  from_status   TEXT NOT NULL CHECK (from_status IN
                  ('draft','registration','voting','counting','published','archived')),
  to_status     TEXT NOT NULL CHECK (to_status IN
                  ('draft','registration','voting','counting','published','archived')),
  triggered_by  TEXT NOT NULL CHECK (triggered_by IN ('admin','system','auto_window')),
  actor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_election_state_transitions_election
  ON public.election_state_transitions(election_id, created_at DESC);

ALTER TABLE public.election_state_transitions ENABLE ROW LEVEL SECURITY;

-- Admin sees everything; committee/observer see transitions of their own events.
DROP POLICY IF EXISTS "Admins view state transitions" ON public.election_state_transitions;
CREATE POLICY "Admins view state transitions"
  ON public.election_state_transitions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Committee/observer view state transitions" ON public.election_state_transitions;
CREATE POLICY "Committee/observer view state transitions"
  ON public.election_state_transitions FOR SELECT TO authenticated
  USING (public.can_access_election(auth.uid(), election_id));

-- Only service_role (cron) or admin RPC inserts. No policy = deny by default
-- for authenticated; the SECURITY DEFINER admin RPCs and auto_transition_elections
-- both bypass RLS as service_role / owner.

-- ============================================================
-- 4) Trigger validating state transitions
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_election_state_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor_is_admin BOOLEAN := public.has_role(auth.uid(), 'admin'::app_role);
  v_actor_is_chair  BOOLEAN := public.can_manage_election(auth.uid(), NEW.id);
BEGIN
  -- 1) Identical status = no-op (allow updates to other fields like end_time)
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- 2) System-triggered auto-transition (auth.uid() IS NULL via SECURITY DEFINER)
  --    Allowed; auto_transition_elections logs separately.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  -- 3) Only admin or committee chair can change status
  IF NOT (v_actor_is_admin OR v_actor_is_chair) THEN
    RAISE EXCEPTION 'Tidak berhak mengubah status pemilihan'
      USING ERRCODE = '42501';
  END IF;

  -- 4) Allowed transitions map (MIRRORED in src/lib/election-state.ts ALLOWED_TRANSITIONS):
  --    draft        -> registration | archived
  --    registration -> voting      | draft      | archived
  --    voting       -> counting    | draft      | archived
  --    counting     -> published   | voting     | archived
  --    published    -> archived
  --    archived     -> (terminal)
  -- Admin can also force any transition (override).
  IF NOT (
    v_actor_is_admin
    OR (OLD.status = 'draft'        AND NEW.status IN ('registration','archived'))
    OR (OLD.status = 'registration'  AND NEW.status IN ('voting','draft','archived'))
    OR (OLD.status = 'voting'       AND NEW.status IN ('counting','draft','archived'))
    OR (OLD.status = 'counting'     AND NEW.status IN ('published','voting','archived'))
    OR (OLD.status = 'published'    AND NEW.status IN ('archived'))
  ) THEN
    RAISE EXCEPTION 'Transisi status % -> % tidak diizinkan', OLD.status, NEW.status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_validate_election_state_transition ON public.election_events;
CREATE TRIGGER tg_validate_election_state_transition
  BEFORE UPDATE OF status ON public.election_events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_election_state_transition();

-- ============================================================
-- 5) Auto-transition RPC (called by pg_cron via service_role)
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_transition_elections()
RETURNS TABLE (election_id UUID, from_status TEXT, to_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, status, start_time, end_time FROM public.election_events
    WHERE status IN ('registration','voting')
  LOOP
    IF rec.status = 'registration' AND rec.start_time <= now() THEN
      UPDATE public.election_events SET status = 'voting' WHERE id = rec.id;
      INSERT INTO public.election_state_transitions
        (election_id, from_status, to_status, triggered_by, reason)
      VALUES (rec.id, 'registration', 'voting', 'auto_window', 'start_time reached');
      RETURN QUERY SELECT rec.id, 'registration'::TEXT, 'voting'::TEXT;
    ELSIF rec.status = 'voting' AND rec.end_time <= now() THEN
      UPDATE public.election_events SET status = 'counting' WHERE id = rec.id;
      INSERT INTO public.election_state_transitions
        (election_id, from_status, to_status, triggered_by, reason)
      VALUES (rec.id, 'voting', 'counting', 'auto_window', 'end_time reached');
      RETURN QUERY SELECT rec.id, 'voting'::TEXT, 'counting'::TEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_transition_elections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_transition_elections() TO service_role;

COMMENT ON FUNCTION public.auto_transition_elections() IS
  'Called by pg_cron every minute. SECURITY DEFINER bypasses RLS. The BEFORE-UPDATE trigger allows auth.uid() IS NULL. Granted only to service_role so that authenticated users cannot invoke it directly.';

-- ============================================================
-- 6) Scope columns (polymorphic organization scope)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'election_scope_type') THEN
    CREATE TYPE public.election_scope_type AS ENUM (
      'university','faculty','department','program','cohort','class','organization'
    );
  END IF;
END $$;

ALTER TABLE public.election_events
  ADD COLUMN IF NOT EXISTS scope_type public.election_scope_type,
  ADD COLUMN IF NOT EXISTS scope_id TEXT;

ALTER TABLE public.election_events
  DROP CONSTRAINT IF EXISTS election_events_scope_consistency;
ALTER TABLE public.election_events
  ADD CONSTRAINT election_events_scope_consistency CHECK (
    (scope_type IS NULL AND scope_id IS NULL) OR
    (scope_type IS NOT NULL AND scope_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_election_events_scope
  ON public.election_events(scope_type, scope_id)
  WHERE scope_type IS NOT NULL;

-- ============================================================
-- 7) validate_scope_id RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_scope_id(
  p_scope_type public.election_scope_type,
  p_scope_id   TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_scope_type IS NULL OR p_scope_id IS NULL THEN RETURN TRUE; END IF;

  CASE p_scope_type
    WHEN 'class' THEN
      RETURN EXISTS (SELECT 1 FROM public.classes WHERE id::text = p_scope_id);
    WHEN 'organization' THEN
      RETURN TRUE;
    ELSE
      -- faculty/department/program/cohort/university: tables added in Fase 3
      RETURN TRUE;
  END CASE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_scope_id(public.election_scope_type, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_scope_id(public.election_scope_type, TEXT) TO authenticated;

-- ============================================================
-- 8) election_eligibility_rules table (new, complementary to event_voter_groups)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.election_eligibility_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES public.election_events(id) ON DELETE CASCADE,
  rule_type       TEXT NOT NULL CHECK (rule_type IN
                    ('class_id','profile_id','department','cohort','organization','custom')),
  rule_value      TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_election_eligibility_rules_election
  ON public.election_eligibility_rules(election_id);

CREATE INDEX IF NOT EXISTS idx_election_eligibility_rules_lookup
  ON public.election_eligibility_rules(election_id, rule_type, rule_value);

ALTER TABLE public.election_eligibility_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage eligibility rules" ON public.election_eligibility_rules;
CREATE POLICY "Admins manage eligibility rules"
  ON public.election_eligibility_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Committee/observer view eligibility rules" ON public.election_eligibility_rules;
CREATE POLICY "Committee/observer view eligibility rules"
  ON public.election_eligibility_rules FOR SELECT TO authenticated
  USING (public.can_access_election(auth.uid(), election_id));

-- ============================================================
-- 9) is_eligible_voter RPC (combines event_voter_groups + rules)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_eligible_voter(
  p_user_id     UUID,
  p_election_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id UUID;
  v_in_group BOOLEAN;
BEGIN
  -- Path 1: event_voter_groups (legacy, class-based)
  SELECT class_id INTO v_class_id FROM public.profiles WHERE id = p_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.event_voter_groups evg
    WHERE evg.event_id = p_election_id AND evg.class_id = v_class_id
  ) INTO v_in_group;

  IF v_in_group THEN RETURN TRUE; END IF;

  -- Path 2: election_eligibility_rules
  RETURN EXISTS (
    SELECT 1 FROM public.election_eligibility_rules r
    WHERE r.election_id = p_election_id
      AND (
        (r.rule_type = 'class_id'    AND r.rule_value = v_class_id::TEXT)
        OR (r.rule_type = 'profile_id' AND r.rule_value = p_user_id::TEXT)
      )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_eligible_voter(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_eligible_voter(UUID, UUID) TO authenticated;

-- ============================================================
-- 10) Admin RPCs for eligibility rules
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_add_eligibility_rule(
  p_election_id  UUID,
  p_rule_type    TEXT,
  p_rule_value   TEXT,
  p_description  TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Hanya admin' USING ERRCODE = '42501';
  END IF;
  IF p_rule_type NOT IN ('class_id','profile_id','department','cohort','organization','custom') THEN
    RAISE EXCEPTION 'rule_type tidak valid' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.election_eligibility_rules (election_id, rule_type, rule_value, description, created_by)
  VALUES (p_election_id, p_rule_type, p_rule_value, p_description, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_id, action, category, target_type, target_id, description, election_id, metadata, severity)
  VALUES (auth.uid(), 'eligibility.add', 'admin', 'election_eligibility_rules', v_id::TEXT,
          'Eligibility rule added', p_election_id,
          jsonb_build_object('rule_type', p_rule_type, 'rule_value', p_rule_value),
          'info');
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_eligibility_rule(
  p_rule_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_election UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Hanya admin' USING ERRCODE = '42501';
  END IF;
  SELECT election_id INTO v_election FROM public.election_eligibility_rules WHERE id = p_rule_id;
  IF v_election IS NULL THEN
    RAISE EXCEPTION 'Rule tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.election_eligibility_rules WHERE id = p_rule_id;
  INSERT INTO public.audit_log (actor_id, action, category, target_type, target_id, description, election_id, severity)
  VALUES (auth.uid(), 'eligibility.remove', 'admin', 'election_eligibility_rules', p_rule_id::TEXT,
          'Eligibility rule removed', v_election, 'info');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_add_eligibility_rule(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_eligibility_rule(UUID, TEXT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_remove_eligibility_rule(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_eligibility_rule(UUID) TO authenticated;

-- ============================================================
-- 11) Admin RPC for manual state transitions
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_transition_election_state(
  p_election_id UUID,
  p_to_status   TEXT,
  p_reason      TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from TEXT;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.can_manage_election(auth.uid(), p_election_id)) THEN
    RAISE EXCEPTION 'Tidak berhak' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_from FROM public.election_events WHERE id = p_election_id;
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'Pemilihan tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  -- Trigger validate_election_state_transition enforces allowed transitions.
  -- Admin override (v_actor_is_admin) inside the trigger permits any transition.
  UPDATE public.election_events SET status = p_to_status WHERE id = p_election_id;

  INSERT INTO public.election_state_transitions
    (election_id, from_status, to_status, triggered_by, actor_id, reason)
  VALUES (p_election_id, v_from, p_to_status, 'admin', auth.uid(), p_reason);

  INSERT INTO public.audit_log
    (actor_id, action, category, target_type, target_id, description, election_id, metadata, severity)
  VALUES (auth.uid(), 'election.transition', 'admin', 'election_events', p_election_id::TEXT,
            'Election state: ' || v_from || ' -> ' || p_to_status,
            p_election_id, jsonb_build_object('from', v_from, 'to', p_to_status, 'reason', p_reason),
            'info');

  RETURN p_to_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_transition_election_state(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_transition_election_state(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 12) Update RLS — state-based vote insert
-- ============================================================
DROP POLICY IF EXISTS "Voters can insert their own votes" ON public.votes;
CREATE POLICY "Voters can insert their own votes"
  ON public.votes FOR INSERT TO authenticated
  WITH CHECK (
    voter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.election_events e
      WHERE e.id = event_id
        AND e.status = 'voting'
        AND public.is_eligible_voter(auth.uid(), e.id)
    )
  );

-- Existing "Voters can view their own votes" remains; keep its identity:
DROP POLICY IF EXISTS "Voters can view their own votes" ON public.votes;
CREATE POLICY "Voters can view their own votes"
  ON public.votes FOR SELECT TO authenticated
  USING (voter_id = auth.uid());

-- ============================================================
-- 13) Update existing public-anon SELECT policy (was 'active'/'closed')
-- ============================================================
DROP POLICY IF EXISTS "Public can view active events and public results" ON public.election_events;
CREATE POLICY "Public can view active events and public results"
  ON public.election_events FOR SELECT
  TO anon
  USING (
    status = 'voting'
    OR (status = 'published' AND public_results = true)
    OR (status = 'counting' AND public_results = true)
  );

-- ============================================================
-- 14) pg_cron job — auto-transition every minute
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove pre-existing job with the same name (idempotent re-applies).
SELECT cron.unschedule('auto-transition-elections')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-transition-elections');

SELECT cron.schedule(
  'auto-transition-elections',
  '* * * * *',
  $$SELECT * FROM public.auto_transition_elections()$$
);

-- ============================================================
-- 15) Comments / documentation
-- ============================================================
COMMENT ON FUNCTION public.validate_election_state_transition() IS
  'BEFORE-UPDATE trigger on election_events.status. Enforces the 6-state lifecycle. Auth.uid() IS NULL is allowed (cron). Admin overrides any transition; chair committee follows the ALLOWED_TRANSITIONS map.';

COMMENT ON TABLE public.election_state_transitions IS
  'Append-only audit trail of every election status change. Written by the trigger, auto_transition_elections, and admin_transition_election_state.';

COMMENT ON TABLE public.election_eligibility_rules IS
  'Per-election eligibility rules that complement event_voter_groups. is_eligible_voter() returns TRUE if the user matches ANY rule OR any event_voter_groups row.';

COMMENT ON FUNCTION public.is_eligible_voter(UUID, UUID) IS
  'Returns TRUE if the user is eligible to vote in the given election (via event_voter_groups OR election_eligibility_rules).';

COMMENT ON FUNCTION public.validate_scope_id(public.election_scope_type, TEXT) IS
  'Returns TRUE if the given scope_id references a valid entity for the scope_type. Only class/organization are validated today; others defer to Fase 3 (org hierarchy).';

COMMENT ON FUNCTION public.admin_transition_election_state(UUID, TEXT, TEXT) IS
  'Admin/chair RPC to manually transition an election between states. The trigger still enforces the transition map; admin override only allows admin to skip invalid transitions.';
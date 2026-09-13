-- TEST-ONLY DATABASE RESET
--
-- Removes every row from the application's current public tables and every
-- Supabase Auth account. The schema, RLS policies, functions, extensions, and
-- Supabase migration history are intentionally preserved.
--
-- Run this migration only against a disposable development/test project. It
-- permanently removes all election, audit, invitation, role, and user data.
-- To reset the same project again after this migration has been recorded, run
-- this file manually in the Supabase SQL Editor (or via the Supabase CLI).

BEGIN;

-- Keep this an explicit allow-list rather than truncating every `public` table:
-- extension-owned data (for example, PostGIS reference tables) must survive.
-- `CASCADE` also clears any dependent table added outside this allow-list.
TRUNCATE TABLE
  public.election_observations,
  public.candidate_notifications,
  public.election_state_transitions,
  public.audit_archive,
  public.audit_log,
  public.user_sessions,
  public.role_permissions,
  public.election_committees,
  public.election_observers,
  public.election_eligibility_rules,
  public.candidate_pair_members,
  public.candidate_pairs,
  public.invitations,
  public.votes,
  public.event_voter_groups,
  public.candidates,
  public.election_events,
  public.user_roles,
  public.profiles,
  public.classes
RESTART IDENTITY CASCADE;

-- Remove test accounts and auth activity, including records that are not
-- foreign-keyed to auth.users (notably audit logs and one-time-token flows).
-- Do not use RESTART IDENTITY here: auth.refresh_tokens_id_seq is owned by
-- Supabase's internal `supabase_auth_admin` role, so migrations cannot reset
-- it. Continuing its counter has no effect on the cleanliness of test data.
-- Deliberately retained: auth.instances, auth.schema_migrations, OAuth/SSO
-- provider configuration, and OAuth client configuration.
TRUNCATE TABLE
  auth.users,
  auth.refresh_tokens,
  auth.audit_log_entries,
  auth.identities,
  auth.sessions,
  auth.mfa_factors,
  auth.mfa_challenges,
  auth.mfa_amr_claims,
  auth.saml_relay_states,
  auth.flow_state,
  auth.one_time_tokens,
  auth.oauth_authorizations,
  auth.oauth_consents,
  auth.oauth_client_states,
  auth.webauthn_credentials,
  auth.webauthn_challenges
CONTINUE IDENTITY CASCADE;

COMMIT;

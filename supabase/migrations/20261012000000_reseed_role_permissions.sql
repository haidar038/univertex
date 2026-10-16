-- Reseed default role -> permission mappings.
--
-- Konteks: migrasi 20260908000000_reset_database_for_testing me-TRUNCATE
-- role_permissions (plus semua data). Di prod seed sudah ada (48 rows).
-- Di project fresh (staging) tabel jadi kosong → has_permission() FALSE
-- untuk semua non-admin → staging tidak bisa dipakai uji.
-- File ini idempotent (ON CONFLICT DO NOTHING) jadi aman bila ikut
-- ter-push ke prod suatu saat.
-- Source: 20251109000100_create_role_permissions.sql:37-65.

INSERT INTO public.role_permissions (role, permission) VALUES
  ('admin','election.view'),('admin','election.update'),('admin','election.publish'),
  ('admin','election.delete'),('admin','election.transition'),
  ('admin','candidate.view'),('admin','candidate.create'),('admin','candidate.review'),
  ('admin','candidate.approve'),('admin','candidate.reject'),('admin','candidate.edit'),
  ('admin','vote.cast'),('admin','vote.view'),('admin','vote.count'),('admin','vote.export'),
  ('admin','voter.view'),('admin','voter.verify'),('admin','voter.manage'),
  ('admin','committee.manage'),('admin','committee.view'),
  ('admin','observer.manage'),('admin','observer.view'),
  ('admin','audit.view'),('admin','audit.export'),
  ('admin','user.create'),('admin','user.edit'),('admin','user.delete'),('admin','user.reset_password'),
  ('admin','system.manage'),('admin','system.settings'),
  ('admin','eligibility.manage'),
  ('committee','election.view'),('committee','candidate.view'),
  ('committee','vote.view'),('committee','voter.view'),('committee','voter.verify'),
  ('committee','committee.view'),
  ('committee','audit.view'),
  ('observer','election.view'),('observer','candidate.view'),
  ('observer','vote.view'),
  ('observer','committee.view'),('observer','observer.view'),
  ('observer','audit.view'),
  ('voter','election.view'),('voter','vote.cast'),
  ('candidate','election.view'),('candidate','candidate.create')
ON CONFLICT (role, permission) DO NOTHING;

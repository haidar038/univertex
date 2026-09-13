-- Migration: Fase 3 M1.0 — permission_key enum
--
-- Adds the 30-value permission_key enum used by the role_permissions table
-- (M1.1) and the has_permission / caller_has_permission helpers (M1.2).
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot run inside a transaction block
-- together with any USE of the new values. This migration therefore lives in
-- its own file and is applied in a non-transactional scope. The IF NOT EXISTS
-- guard makes re-runs safe.
--
-- Modular naming convention (domain.action):
--   election.*, candidate.*, vote.*, voter.*, committee.*, observer.*,
--   audit.*, user.*, system.*, eligibility.*

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_key') THEN
    CREATE TYPE public.permission_key AS ENUM (
      'election.view','election.update','election.publish','election.delete','election.transition',
      'candidate.view','candidate.create','candidate.review','candidate.approve','candidate.reject','candidate.edit',
      'vote.cast','vote.view','vote.count','vote.export',
      'voter.view','voter.verify','voter.manage',
      'committee.manage','committee.view',
      'observer.manage','observer.view',
      'audit.view','audit.export',
      'user.create','user.edit','user.delete','user.reset_password',
      'system.manage','system.settings',
      'eligibility.manage'
    );
  END IF;
END $$;

ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'election.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'election.update';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'election.publish';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'election.delete';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'election.transition';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.create';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.review';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.approve';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.reject';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'candidate.edit';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'vote.cast';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'vote.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'vote.count';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'vote.export';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'voter.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'voter.verify';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'voter.manage';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'committee.manage';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'committee.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'observer.manage';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'observer.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'audit.view';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'audit.export';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'user.create';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'user.edit';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'user.delete';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'user.reset_password';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'system.manage';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'system.settings';
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'eligibility.manage';

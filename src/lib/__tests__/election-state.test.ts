/**
 * Tests for src/lib/election-state.ts — frontend mirror of the DB trigger
 * `validate_election_state_transition`.
 *
 * Critical invariant: ALLOWED_TRANSITIONS MUST mirror the CASE expression
 * in the migration. If you change one, change the other.
 */
import { describe, it, expect } from 'vitest';
import {
  ELECTION_STATUSES,
  STATUS_LABEL,
  STATUS_COLOR,
  ALLOWED_TRANSITIONS,
  STATUS_ACTION_LABEL,
  canTransition,
  type ElectionStatus,
} from '../election-state';

describe('ELECTION_STATUSES', () => {
  it('mengandung tepat 6 status sesuai state machine', () => {
    expect(ELECTION_STATUSES).toEqual([
      'draft', 'registration', 'voting', 'counting', 'published', 'archived',
    ]);
  });

  it('setiap status punya label dan color', () => {
    for (const s of ELECTION_STATUSES) {
      expect(STATUS_LABEL[s]).toBeTruthy();
      expect(STATUS_COLOR[s]).toBeTruthy();
    }
  });
});

describe('ALLOWED_TRANSITIONS (mirror DB trigger)', () => {
  it('draft -> registration | archived', () => {
    expect(ALLOWED_TRANSITIONS.draft.sort()).toEqual(['archived', 'registration']);
  });

  it('registration -> voting | draft | archived', () => {
    expect(ALLOWED_TRANSITIONS.registration.sort()).toEqual(['archived', 'draft', 'voting']);
  });

  it('voting -> counting | draft | archived', () => {
    expect(ALLOWED_TRANSITIONS.voting.sort()).toEqual(['archived', 'counting', 'draft']);
  });

  it('counting -> published | voting | archived', () => {
    expect(ALLOWED_TRANSITIONS.counting.sort()).toEqual(['archived', 'published', 'voting']);
  });

  it('published -> archived', () => {
    expect(ALLOWED_TRANSITIONS.published).toEqual(['archived']);
  });

  it('archived adalah terminal (no transitions out)', () => {
    expect(ALLOWED_TRANSITIONS.archived).toEqual([]);
  });
});

describe('canTransition', () => {
  it('non-admin: draft -> registration diizinkan', () => {
    expect(canTransition('draft', 'registration', false)).toBe(true);
  });

  it('non-admin: draft -> voting ditolak', () => {
    expect(canTransition('draft', 'voting', false)).toBe(false);
  });

  it('non-admin: voting -> published ditolak (harus via counting)', () => {
    expect(canTransition('voting', 'published', false)).toBe(false);
  });

  it('non-admin: archived -> draft ditolak (terminal)', () => {
    expect(canTransition('archived', 'draft', false)).toBe(false);
  });

  it('admin: boleh transisi apapun (override)', () => {
    expect(canTransition('draft', 'published', true)).toBe(true);
    expect(canTransition('archived', 'voting', true)).toBe(true);
    expect(canTransition('voting', 'archived', true)).toBe(true);
  });

  it('sama status -> false (no-op transition tidak dihitung)', () => {
    for (const s of ELECTION_STATUSES) {
      expect(canTransition(s, s, false)).toBe(false);
      expect(canTransition(s, s, true)).toBe(false);
    }
  });
});

describe('STATUS_ACTION_LABEL', () => {
  it('punya label untuk tiap transisi utama', () => {
    const keys = Object.keys(STATUS_ACTION_LABEL) as ElectionStatus[];
    expect(keys).toContain('registration');
    expect(keys).toContain('voting');
    expect(keys).toContain('counting');
    expect(keys).toContain('published');
    expect(keys).toContain('archived');
  });
});
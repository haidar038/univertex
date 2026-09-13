/**
 * Election state machine — frontend mirror of the trigger in
 * supabase/migrations/20251108000000_phase2_state_machine_and_scope.sql
 *
 * IMPORTANT: ALLOWED_TRANSITIONS MUST match the CASE expression inside
 * `validate_election_state_transition()`. Drift causes UI buttons to
 * allow actions the trigger rejects (or vice versa).
 */

export type ElectionStatus =
  | 'draft'
  | 'registration'
  | 'voting'
  | 'counting'
  | 'published'
  | 'archived';

export const ELECTION_STATUSES: ElectionStatus[] = [
  'draft',
  'registration',
  'voting',
  'counting',
  'published',
  'archived',
];

export const STATUS_LABEL: Record<ElectionStatus, string> = {
  draft: 'Draf',
  registration: 'Pendaftaran',
  voting: 'Voting',
  counting: 'Penghitungan',
  published: 'Dipublikasikan',
  archived: 'Diarsipkan',
};

export const STATUS_COLOR: Record<ElectionStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  registration: 'bg-info text-info-foreground',
  voting: 'bg-success text-success-foreground',
  counting: 'bg-warning text-warning-foreground',
  published: 'bg-primary text-primary-foreground',
  archived: 'bg-secondary text-secondary-foreground',
};

/**
 * Allowed transition map. Mirrors validate_election_state_transition()
 * in the DB trigger. Admin override is handled separately in canTransition.
 */
export const ALLOWED_TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  draft:        ['registration', 'archived'],
  registration: ['voting', 'draft', 'archived'],
  voting:       ['counting', 'draft', 'archived'],
  counting:     ['published', 'voting', 'archived'],
  published:    ['archived'],
  archived:     [],
};

/**
 * Whether `from -> to` is allowed. Admin can always force a transition;
 * the trigger also allows admin to skip invalid transitions, so the UI
 * must mirror that behaviour.
 */
export function canTransition(
  from: ElectionStatus,
  to: ElectionStatus,
  isAdmin: boolean,
): boolean {
  if (from === to) return false;
  if (isAdmin) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * UI labels for the state transition buttons in EventDetail.
 */
export const STATUS_ACTION_LABEL: Partial<Record<ElectionStatus, string>> = {
  registration: 'Buka Pendaftaran',
  voting: 'Buka Voting',
  counting: 'Mulai Hitung',
  published: 'Publikasikan',
  archived: 'Arsipkan',
  draft: 'Kembalikan ke Draft',
};
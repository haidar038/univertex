import { supabase } from '@/integrations/supabase/client';

/**
 * Shared helpers for candidate pairs (pasangan calon).
 *
 * The database schema (migration 20251104040000) provides:
 *   - candidate_pairs        (the ticket: label, number, vision, mission, photo, status)
 *   - candidate_pair_members (junction: pair_id -> candidates.id with optional position)
 *   - votes.pair_id          (a vote is either for a candidate OR a pair)
 *   - election_events.use_pairs (feature flag per event)
 *
 * These helpers centralize the embed query so every page (admin, voter,
 * committee, observer, public) renders pairs consistently.
 */

export interface PairMemberCandidate {
    id: string;
    vision: string | null;
    mission: string | null;
    photo_url: string | null;
    photo_storage_path: string | null;
    profiles: { full_name: string; student_id: string } | null;
}

export interface PairMember {
    id: string;
    pair_id: string;
    candidate_id: string;
    position: string | null;
    candidates: PairMemberCandidate | null;
}

export interface PairWithMembers {
    id: string;
    event_id: string;
    label: string | null;
    number: number | null;
    vision: string | null;
    mission: string | null;
    photo_url: string | null;
    photo_storage_path: string | null;
    status: 'pending' | 'approved' | 'rejected';
    admin_notes: string | null;
    rejection_reason: string | null;
    approved_at: string | null;
    members: PairMember[];
}

interface RawPairRow {
    id: string;
    event_id: string;
    label: string | null;
    number: number | null;
    vision: string | null;
    mission: string | null;
    photo_url: string | null;
    photo_storage_path: string | null;
    status: 'pending' | 'approved' | 'rejected';
    admin_notes: string | null;
    rejection_reason: string | null;
    approved_at: string | null;
    candidate_pair_members?: Array<{
        id: string;
        pair_id: string;
        candidate_id: string;
        position: string | null;
        candidates: PairMemberCandidate | null;
    }> | null;
}

/**
 * Fetch candidate pairs for an event, with member candidates (and their
 * profiles) embedded in a single round-trip.
 */
export async function fetchPairsWithMembers(
    eventId: string,
    options: { approvedOnly?: boolean } = {}
): Promise<PairWithMembers[]> {
    let query = supabase
        .from('candidate_pairs')
        .select(
            `id, event_id, label, number, vision, mission, photo_url, photo_storage_path,
       status, admin_notes, rejection_reason, approved_at,
       candidate_pair_members (
         id, pair_id, candidate_id, position,
         candidates (
           id, vision, mission, photo_url, photo_storage_path,
           profiles ( full_name, student_id )
         )
       )`
        )
        .eq('event_id', eventId)
        .order('number', { ascending: true, nullsFirst: false });

    if (options.approvedOnly) {
        query = query.eq('status', 'approved');
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: RawPairRow) => ({
        id: row.id,
        event_id: row.event_id,
        label: row.label,
        number: row.number,
        vision: row.vision,
        mission: row.mission,
        photo_url: row.photo_url,
        photo_storage_path: row.photo_storage_path,
        status: row.status,
        admin_notes: row.admin_notes,
        rejection_reason: row.rejection_reason,
        approved_at: row.approved_at,
        members: row.candidate_pair_members || [],
    }));
}

/**
 * Human-readable display name for a pair, e.g. "Budi Santoso & Andi Wijaya".
 * Falls back to the pair label, then a generic placeholder.
 */
export function getPairDisplayName(pair: PairWithMembers): string {
    const names = pair.members
        .map((m) => m.candidates?.profiles?.full_name)
        .filter((n): n is string => Boolean(n));

    if (names.length > 0) {
        return names.join(' & ');
    }
    return pair.label || 'Pasangan Kandidat';
}

/**
 * Short display name for charts / narrow layouts: uses the ketua (first
 * member) name, or the label.
 */
export function getPairShortName(pair: PairWithMembers): string {
    const first = pair.members.find((m) => m.candidates?.profiles?.full_name);
    return (
        first?.candidates?.profiles?.full_name ||
        pair.label ||
        `Pasangan #${pair.number ?? '?'}`
    );
}

/**
 * Position label in Indonesian for common values.
 */
export function getPairPositionLabel(position: string | null): string {
    switch (position) {
        case 'ketua':
            return 'Ketua';
        case 'wakil':
            return 'Wakil Ketua';
        case 'chair':
            return 'Ketua';
        case 'vice':
            return 'Wakil';
        default:
            return position ? position.charAt(0).toUpperCase() + position.slice(1) : 'Anggota';
    }
}
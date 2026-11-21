/**
 * Schema form event — aturan closed tidak boleh membocorkan hasil.
 *
 * Dipakai CreateEventDialog + EditEventDialog. UI juga memaksa false saat
 * submit, tapi schema adalah lapisan pertama yang menolak kombinasi salah.
 */
import { describe, it, expect } from 'vitest';
import { eventFormSchema as createSchema } from '../CreateEventDialog';
import { eventFormSchema as editSchema } from '../EditEventDialog';

const base = {
  title: 'Pemilihan BEM',
  description: '',
  start_date: '2026-01-01',
  start_time: '08:00',
  end_date: '2026-01-01',
  end_time: '17:00',
  status: 'draft' as const,
  election_type: 'open' as const,
  use_pairs: false,
  show_results_after_voting: true,
  public_results: true,
  public_live_count: true,
  scope_type: '' as const,
  scope_id: '',
};

const closedSafe = {
  ...base,
  election_type: 'closed' as const,
  show_results_after_voting: false,
  public_results: false,
  public_live_count: false,
};

const schemas = [
  ['CreateEventDialog', createSchema],
  ['EditEventDialog', editSchema],
] as const;

describe.each(schemas)('%s — flag hasil publik', (_name, schema) => {
  it('open boleh menyalakan semua flag', () => {
    expect(schema.safeParse(base).success).toBe(true);
  });

  it('closed dengan semua flag mati lolos', () => {
    expect(schema.safeParse(closedSafe).success).toBe(true);
  });

  it('closed + show_results_after_voting ditolak', () => {
    const result = schema.safeParse({ ...closedSafe, show_results_after_voting: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('show_results_after_voting'))).toBe(true);
    }
  });

  it('closed + public_results ditolak', () => {
    const result = schema.safeParse({ ...closedSafe, public_results: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('public_results'))).toBe(true);
    }
  });

  it('closed + public_live_count ditolak', () => {
    const result = schema.safeParse({ ...closedSafe, public_live_count: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('public_live_count'))).toBe(true);
    }
  });
});

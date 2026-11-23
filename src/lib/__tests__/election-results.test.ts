import { describe, it, expect } from 'vitest';
import { getTieGroup } from '../election-results';

describe('getTieGroup', () => {
  it('mengembalikan grup ketika dua entri menyamai suara terbanyak', () => {
    const results = [
      { id: 'a', votes: 5 },
      { id: 'b', votes: 5 },
      { id: 'c', votes: 2 },
    ];
    expect(getTieGroup(results).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('mengembalikan [] ketika pemenang tunggal', () => {
    const results = [
      { id: 'a', votes: 6 },
      { id: 'b', votes: 5 },
    ];
    expect(getTieGroup(results)).toEqual([]);
  });

  it('mengembalikan [] ketika semua suara 0 atau tidak ada entri', () => {
    expect(getTieGroup([{ id: 'a', votes: 0 }, { id: 'b', votes: 0 }])).toEqual([]);
    expect(getTieGroup([{ id: 'a', votes: 5 }])).toEqual([]);
    expect(getTieGroup([])).toEqual([]);
  });

  it('tidak bergantung pada urutan input', () => {
    const results = [
      { id: 'c', votes: 2 },
      { id: 'b', votes: 5 },
      { id: 'a', votes: 5 },
    ];
    expect(getTieGroup(results).map((r) => r.id)).toEqual(['b', 'a']);
  });
});

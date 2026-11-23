/**
 * Kandidat/pasangan yang memiliki suara terbanyak ketika hasil berujung seri.
 *
 * Dipakai oleh tampilan hasil (admin, voter, publik) untuk membedakan kondisi
 * "Pemenang" (satu entri di puncak) dari "Seri" (≥2 entri di puncak).
 * Tidak bergantung pada urutan input dan tidak menganggap suara 0 sebagai seri.
 */
export function getTieGroup<T extends { votes: number }>(results: T[]): T[] {
  if (results.length < 2) return [];

  const maxVotes = Math.max(...results.map((r) => r.votes));
  if (!Number.isFinite(maxVotes) || maxVotes <= 0) return [];

  const top = results.filter((r) => r.votes === maxVotes);
  return top.length >= 2 ? top : [];
}

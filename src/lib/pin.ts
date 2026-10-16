/**
 * PIN kredensial H-H: 8 digit acak (10^8 kombinasi) dari CSPRNG.
 * Disengaja digit-only agar tidak membingungkan voter (tanpa O/0, l/I, case).
 * Aman untuk kredensial 1 hari: brute-force online mati oleh rate-limit
 * Supabase + audit log_failed_login. Syarat: SELALU string (nol di depan
 * dipertahankan), jangan pernah Math.random.
 */
export function generatePin(): string {
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  return String(buf[0] % 100000000).padStart(8, '0');
}

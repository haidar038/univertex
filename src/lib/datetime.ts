/**
 * Konversi waktu event antara input lokal (form) dan UTC (database).
 *
 * Akar bug: form menyimpan string naif `yyyy-MM-ddTHH:mm` (waktu dinding lokal)
 * yang dibaca Postgres TIMESTAMPTZ sebagai UTC, sementara tampilan mengonversi
 * UTC→lokal. Tiap simpan-buka menggeser jam sebesar offset zona waktu.
 * Aturan: input form SELALU waktu lokal → simpan sebagai ISO UTC.
 */
export function localDateTimeToUTCISO(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return '';
  const local = new Date(`${date}T${time}:00`);
  if (Number.isNaN(local.getTime())) return '';
  return local.toISOString();
}

/** Pecah ISO UTC menjadi tanggal lokal `yyyy-MM-dd` untuk input form. */
export function utcToLocalDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Pecah ISO UTC menjadi jam lokal `HH:mm` untuk input form. */
export function utcToLocalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = `${d.getHours()}`.padStart(2, '0');
  const min = `${d.getMinutes()}`.padStart(2, '0');
  return `${h}:${min}`;
}

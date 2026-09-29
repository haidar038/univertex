import { describe, it, expect } from 'vitest';
import { localDateTimeToUTCISO, utcToLocalDate, utcToLocalTime } from '../datetime';

// Kunci zona waktu agar ekspektasi deterministik (WITA, tanpa DST).
process.env.TZ = 'Asia/Makassar';

describe('datetime helpers (zona waktu event)', () => {
  it('menyimpan 21:00 lokal sebagai 13:00Z (UTC+8)', () => {
    expect(localDateTimeToUTCISO('2026-09-28', '21:00')).toBe('2026-09-28T13:00:00.000Z');
  });

  it('round-trip: simpan lalu tampil kembali ke 21:00 yang sama', () => {
    const saved = localDateTimeToUTCISO('2026-09-28', '21:00');
    expect(utcToLocalDate(saved)).toBe('2026-09-28');
    expect(utcToLocalTime(saved)).toBe('21:00');
  });

  it('menangani lewat tengah malam (00:30 lokal = 16:30Z hari sebelum)', () => {
    const saved = localDateTimeToUTCISO('2026-09-28', '00:30');
    expect(saved).toBe('2026-09-27T16:30:00.000Z');
    expect(utcToLocalDate(saved)).toBe('2026-09-28');
    expect(utcToLocalTime(saved)).toBe('00:30');
  });

  it('input kosong / tidak valid → string kosong', () => {
    expect(localDateTimeToUTCISO('', '21:00')).toBe('');
    expect(localDateTimeToUTCISO('2026-09-28', '')).toBe('');
    expect(localDateTimeToUTCISO('bukan-tanggal', 'x')).toBe('');
    expect(utcToLocalDate('bukan-iso')).toBe('');
    expect(utcToLocalTime('bukan-iso')).toBe('');
  });
});

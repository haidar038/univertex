import { describe, it, expect } from 'vitest';
import { generatePin } from '@/lib/pin';

describe('generatePin - kredensial H-H', () => {
  it('selalu 8 digit angka (nol di depan dipertahankan)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePin()).toMatch(/^\d{8}$/);
    }
  });

  it('tidak deterministik (100 PIN tidak semua sama)', () => {
    const pins = new Set(Array.from({ length: 100 }, generatePin));
    expect(pins.size).toBeGreaterThan(90);
  });
});

/**
 * Device fingerprint tests - verifikasi:
 * - Hash deterministik untuk input yang sama (penting untuk identifikasi device)
 * - Hash berubah ketika komponen fingerprint berubah
 * - Label mengandung browser + OS info
 * - UserAgent ter-capture
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDeviceFingerprint } from '../device';

describe('buildDeviceFingerprint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menghasilkan hash yang deterministik untuk environment yang sama', async () => {
    const fp1 = await buildDeviceFingerprint();
    const fp2 = await buildDeviceFingerprint();
    expect(fp1.hash).toBe(fp2.hash);
  });

  it('menghasilkan hash SHA-256 (64 hex chars)', async () => {
    const fp = await buildDeviceFingerprint();
    expect(fp.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('label berisi browser dan OS', async () => {
    // jsdom UA: "jsdom/x.y.z" - detectBrowser akan return "Unknown Browser"
    const fp = await buildDeviceFingerprint();
    expect(fp.label).toMatch(/Unknown Browser|Chrome|Firefox|Safari|Edge/);
    expect(fp.label).toMatch(/\(/); // "(Desktop)" wrapper
  });

  it('userAgent terisi dari navigator.userAgent', async () => {
    const fp = await buildDeviceFingerprint();
    expect(fp.userAgent).toBe(navigator.userAgent);
  });

  it('hash berubah ketika userAgent berubah (device berbeda)', async () => {
    const fp1 = await buildDeviceFingerprint();

    const original = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      configurable: true,
    });

    const fp2 = await buildDeviceFingerprint();
    expect(fp2.hash).not.toBe(fp1.hash);

    Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true });
  });
});

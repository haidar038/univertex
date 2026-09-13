import { test as base, expect } from '@playwright/test';

/** Env helper — kembalikan string atau undefined bila kosong. */
export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const TEST_EVENT_ID = env('TEST_EVENT_ID');

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password|kata sandi/i).fill(password);
  await page.getByRole('button', { name: /masuk|login/i }).click();
}

/**
 * Prod-safe guard: tanpa TEST_EVENT_ID semua spec TULIS di-skip (jangan
 * arahkan write ke event asli). Test reference: `test` import di spec.
 */
export function skipWithoutTestEvent(): void {
  base.beforeEach(() => {
    base.skip(!TEST_EVENT_ID, 'TEST_EVENT_ID tidak diset — spec tulis di-skip (lindungi event asli).');
  });
}

/** Skip bila kredensial test tidak diset (bukan failure infrastructure). */
export function skipWithoutCreds(testRef: typeof base, ...names: string[]): void {
  testRef.beforeEach(() => {
    const missing = names.filter((n) => !env(n));
    if (missing.length > 0) {
      testRef.skip(true, `Kredensial env belum diset: ${missing.join(', ')} — di-skip.`);
    }
  });
}

export { expect };

import { test as base, expect, Page } from '@playwright/test';

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

/** Skip test tulis bila TEST_EVENT_ID tidak diset (lindungi event asli). */
export const test = base.extend({});
export function skipWithoutTestEvent(testRef: typeof base) {
  testRef.beforeEach(async ({}, testInfo) => {
    if (!TEST_EVENT_ID) {
      testInfo.skip(true, 'TEST_EVENT_ID tidak diset — spec tulis di-skip agar event asli aman.');
    }
  });
}
export { expect };

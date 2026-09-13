import { defineConfig, devices } from '@playwright/test';

/**
 * P1-01 — Playwright E2E (prod-direct, aman).
 *
 * Prinsip prod-direct (slot staging penuh, tanpa project staging):
 * - JANGAN arahkan test tulis ke event asli.
 *   Semua spec tulis WAJIB pakai TEST_EVENT_ID = event isolasi `[P1-TEST]`.
 * - Tanpa TEST_EVENT_ID → spec tulis SKIP otomatis (hanya spec read-only jalan).
 * - BaeURL default = Vite dev server lokal (http://localhost:8080);
 *   arahkan ke deploy prod hanya saat jendela maintenance via BASE_URL env.
 *
 * Env:
 *   BASE_URL      — default http://localhost:8080
 *   TEST_EVENT_ID — uuid event isolasi [P1-TEST] (wajib untuk spec tulis)
 *   E2E_VOTER_EMAIL / E2E_VOTER_PASSWORD             — akun sintetis p1test+*
 *   E2E_NON_DPT_EMAIL / E2E_NON_DPT_PASSWORD
 *   E2E_COMMITTEE_EMAIL / E2E_COMMITTEE_PASSWORD
 *   E2E_OBSERVER_EMAIL / E2E_OBSERVER_PASSWORD
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  trace: 'on-first-retry',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

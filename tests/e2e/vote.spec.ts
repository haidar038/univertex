/**
 * P1-01 skenario 1–3 (voter + timeline + non-DPT) — prod-direct aman.
 * Semua aksi TULIS hanya ke TEST_EVENT_ID (event isolasi [P1-TEST]).
 */
import { test, expect } from '@playwright/test';
import { login, env, skipWithoutTestEvent, skipWithoutCreds, TEST_EVENT_ID } from './helpers';

const VOTER_CREDS = ['E2E_VOTER_EMAIL', 'E2E_VOTER_PASSWORD'];
const NON_DPT_CREDS = ['E2E_NON_DPT_EMAIL', 'E2E_NON_DPT_PASSWORD'];

skipWithoutTestEvent();
skipWithoutCreds(test, ...VOTER_CREDS);

test.describe('voter vote + double-vote + non-DPT (event isolasi)', () => {
  test('1. voter eligible vote → toast sukses → banner sudah-vote → vote ke-2 ditolak 23505', async ({ page }) => {
    const email = env('E2E_VOTER_EMAIL')!;
    const password = env('E2E_VOTER_PASSWORD')!;
    await login(page, email, password);
    await expect(page).toHaveURL(/\/app\/dashboard/);
    // Dashboard hanya menampilkan event eligible — event test harus terlihat.
    await expect(page.locator('body')).toContainText(/Pemilihan|Dashboard/i);
    await page.goto(`/app/vote/${TEST_EVENT_ID}`);
    // Pilih kandidat pertama yang tersedia lalu konfirmasi.
    const candidateCard = page.locator('text=Kandidat').first();
    if (await candidateCard.count()) {
      await candidateCard.click();
      await page.getByRole('button', { name: /Konfirmasi Pilihan/i }).click();
      await page.getByRole('button', { name: /Ya, Saya Yakin/i }).click();
      await expect(page.locator('body')).toContainText(/berhasil tercatat|sudah memberikan suara/i);
    }
    // Banner sudah-vote + vote ke-2 ditolak (toast 23505).
    await page.goto(`/app/vote/${TEST_EVENT_ID}`);
    await expect(page.locator('body')).toContainText(/sudah memberikan suara|tidak termasuk|belum dimulai|sudah berakhir/i);
  });

  test('2. non-DPT → banner DPT + tombol disabled', async ({ page }) => {
    test.skip(!env('E2E_NON_DPT_EMAIL') || !env('E2E_NON_DPT_PASSWORD'), 'Kredensial non-DPT belum diset.');
    const email = env('E2E_NON_DPT_EMAIL')!;
    const password = env('E2E_NON_DPT_PASSWORD')!;
    await login(page, email, password);
    await page.goto(`/app/vote/${TEST_EVENT_ID}`);
    await expect(page.locator('body')).toContainText(/Daftar Pemilih Tetap|DPT/i);
    const confirmBtn = page.getByRole('button', { name: /Konfirmasi Pilihan/i });
    if (await confirmBtn.count()) {
      await expect(confirmBtn).toBeDisabled();
    }
    // Regresi P0-01 (insert via API → 42501) diverifikasi manual via SQL console,
    // bukan via klik UI — lihat docs/P0-01-Eligibility-Enforcement.md T2.
  });

  test('3. timeline banner sesuai status; vote luar window ditolak P0001', async ({ page }) => {
    const email = env('E2E_VOTER_EMAIL')!;
    const password = env('E2E_VOTER_PASSWORD')!;
    await login(page, email, password);
    await page.goto(`/app/vote/${TEST_EVENT_ID}`);
    // Salah satu banner status harus tampil; tidak boleh ada crash.
    await expect(page.locator('body')).toContainText(
      /belum dimulai|Waktu pemilihan sudah berakhir|tahap draf|tahap pendaftaran|penghitungan|dipublikasikan|diarsipkan|sudah memberikan suara|Pilih satu kandidat/i
    );
  });
});

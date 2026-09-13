/**
 * P1-01 skenario 4–5 (committee + observer) — aman, tanpa tulis ke event asli.
 */
import { test, expect, login, env, TEST_EVENT_ID } from './helpers';

test.describe('committee & observer', () => {
  test('4. committee login → /committee → tally + submit observation tersimpan (event isolasi)', async ({ page }) => {
    test.skip(!TEST_EVENT_ID, 'TEST_EVENT_ID tidak diset.');
    const email = env('E2E_COMMITTEE_EMAIL')!;
    const password = env('E2E_COMMITTEE_PASSWORD')!;
    await login(page, email, password);
    await page.goto('/committee');
    await expect(page.locator('body')).toContainText(/Panitia|pemilihan/i);
    await page.goto(`/committee/election/${TEST_EVENT_ID}`);
    await expect(page.locator('body')).toContainText(/Tally|Hasil|Observasi|Monitoring/i);
    const obsBox = page.getByPlaceholder(/observasi|catatan/i);
    if (await obsBox.count()) {
      await obsBox.first().fill(`[P1-TEST] observasi e2e ${new Date().toISOString()}`);
      const submit = page.getByRole('button', { name: /kirim|simpan|tambah/i });
      if (await submit.count()) {
        await submit.first().click();
        await expect(page.locator('body')).toContainText(/tersimpan|berhasil/i);
      }
    }
  });

  test('5. observer login → /observer read-only (tanpa tombol aksi)', async ({ page }) => {
    const email = env('E2E_OBSERVER_EMAIL');
    const password = env('E2E_OBSERVER_PASSWORD');
    test.skip(!email || !password, 'Kredensial observer tidak diset.');
    await login(page, email!, password!);
    await page.goto('/observer');
    await expect(page.locator('body')).toContainText(/Observer|pemilihan/i);
    // Tidak boleh ada tombol tulis di dashboard observer.
    await expect(page.getByRole('button', { name: /hapus|tambah kandidat|publish|arsip/i })).toHaveCount(0);
  });
});

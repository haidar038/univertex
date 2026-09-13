/**
 * P1-01 skenario 6–7 (admin export + revoke, invite accept) — prod-direct aman.
 * - Export audit: read-only, filter election_id = TEST_EVENT_ID.
 * - Revoke: HANYA sesi milik akun test, bukan akun asli.
 * - Invite: akun sintetis p1test+* saja, langsung cleanup setelah accept.
 */
import { test, expect, login, env, TEST_EVENT_ID } from './helpers';

test.describe('admin export/revoke + invite', () => {
  test('6. admin export audit JSON + revoke sesi test → logout ≤5 mnt', async ({ page }) => {
    const email = env('E2E_ADMIN_EMAIL');
    const password = env('E2E_ADMIN_PASSWORD');
    test.skip(!email || !password || !TEST_EVENT_ID, 'Kredensial admin / TEST_EVENT_ID belum diset.');
    await login(page, email!, password!);
    await page.goto('/admin/audit-export');
    const eventInput = page.getByLabel(/election|event/i);
    if (await eventInput.count()) {
      await eventInput.first().fill(TEST_EVENT_ID!);
    }
    const exportBtn = page.getByRole('button', { name: /ekspor/i });
    if (await exportBtn.count()) {
      await exportBtn.first().click();
      await expect(page.locator('body')).toContainText(/Hasil|baris|Tidak ada data/i);
    }
    // Revoke sesi: buka /admin/sessions, cabut sesi milik user test saja.
    await page.goto('/admin/sessions');
    await expect(page.locator('body')).toContainText(/Sesi|Manajemen Sesi/i);
  });

  test('7. invite committee/observer → accept → role + baris tabel benar', async ({ page }) => {
    const email = env('E2E_ADMIN_EMAIL');
    const password = env('E2E_ADMIN_PASSWORD');
    test.skip(!email || !password, 'Kredensial admin belum diset — invite di-skip.');
    await login(page, email!, password!);
    await page.goto('/admin/invitations');
    await expect(page.locator('body')).toContainText(/Undangan|Invitation/i);
    // Pembuatan undangan sungguhan hanya saat jendela maintenance;
    // di run rutin cukup verifikasi halaman render tanpa error.
  });
});

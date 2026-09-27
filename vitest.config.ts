import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // E2E dijalankan oleh Playwright (bukan Vitest) — exclude agar vitest
    // tidak mencoba resolve `@playwright/test` dan tidak mengganggu coverage.
    exclude: ['tests/e2e/**', 'tests/load/**', 'node_modules/**', 'dist/**', '.kilo/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // P1-03 scope — ukur hanya area yang ditargetkan agar gate jujur
      // (whole-app baseline cuma 15.66% karena admin/UI belum ber-table).
      // Realita nyata seluruh src/ dicatat di CHANGELOG [P1 Pilot] sebagai
      // backlog P2 (bukan target lulus sekarang).
      include: [
        'src/lib/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/pages/app/VotingPage.tsx',
      ],
      exclude: [
        'src/lib/__tests__/**',
        'src/hooks/__tests__/**',
        'src/**/*.test.{ts,tsx}',
      ],
      // Baseline aktual (2026-09-13) pada scope P1:
      //   src/lib 68.94 | src/hooks 51.41 | VotingPage 81.25 | sessions 85.71
      // Threshold GLOBAL = garis merah di bawah baseline agar CI stabil;
      // target peningkatan ≥70% tiap area dicatat sebagai target P1-03 paper.
      thresholds: {
        lines: 50,
        functions: 45,
        branches: 35,
        statements: 50,
      },
      all: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

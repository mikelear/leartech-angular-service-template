import { defineConfig } from 'playwright/test';

/**
 * Playwright config for end2end-ui browser tests.
 *
 * PREVIEW_URL is set by the catalog end2end-ui task (or locally via env).
 * Tests run headless Chromium against the live preview deploy.
 *
 * On failure: captures screenshots, videos, and traces.
 * CI uploads these to GCS and links them in the PR comment.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env['PREVIEW_URL'] || 'http://localhost:4200',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['list']],
  outputDir: 'test-results',
});

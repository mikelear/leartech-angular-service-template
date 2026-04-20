import { defineConfig } from 'playwright/test';

/**
 * Playwright config for end2end-ui browser tests.
 *
 * PREVIEW_URL is set by the catalog end2end-ui task (or locally via env).
 * Tests run headless Chromium against the live preview deploy.
 *
 * Captures screenshots, videos, and traces on every run.
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
    screenshot: 'on',
    video: 'on',
    trace: 'on',
  },
  reporter: [['list']],
  outputDir: 'test-results',
});

import { defineConfig } from 'playwright/test';

/**
 * Playwright config for end2end-ui browser tests.
 *
 * Base URL resolution (first non-empty wins):
 *   1. STAGING_URL — set by leartech-arrivals-observer when it dispatches
 *      a Job against a staging Arrival (POST-DEPLOY context).
 *   2. PREVIEW_URL — set by the catalog end2end-ui task for PR builds
 *      (PR-preview context).
 *   3. localhost:4200 — local dev against `ng serve`.
 *
 * The same static build is exercised in both PR-preview and post-deploy
 * arrival contexts; each context only differs in the base URL and the
 * env-var set the runner injects. Specs that require staging-only
 * infrastructure (Hydra, peer services) skip when STAGING_URL is unset;
 * specs that assert the prerender/SEO invariants of the deployed
 * artifact (spec 07) run against BOTH contexts.
 *
 * `timeout` is 60s (was 30s): staging's in-cluster chromium is software-
 * rendered (swiftshader) and each Hydra round-trip adds ~1-3s. Mirrors
 * leartech-auth-ui's 60s so consumers cloning this template stay
 * consistent with the fleet.
 *
 * `retries: 1` gives one automatic retry for transient staging flake
 * (network jitter, node under load, cold Chromium launch). The first-run
 * failure and the retry are BOTH captured in test-results/ so a "flaky"
 * verdict is visible to the arrival forensics view.
 *
 * Tests run headless Chromium. Captures screenshots, videos, and
 * traces on every run; CI uploads these to GCS and links them in
 * the PR comment / Arrival forensics output.
 */

const stagingUrl = process.env['STAGING_URL'] ?? '';
const previewUrl = process.env['PREVIEW_URL'] ?? '';
const baseURL = stagingUrl || previewUrl || 'http://localhost:4200';

// Bare cluster / preview host base (`jx-staging.jx.leartech.com` in
// staging, `pr<N>.jx.leartech.com` in preview). Exported by the
// arrivals-observer / catalog task; specs that need to compose peer
// URLs read the corresponding env var directly. Logged here for
// forensic visibility only.
const stagingHostBase = process.env['STAGING_HOST_BASE'] ?? '';
const previewHostBase = process.env['PREVIEW_HOST_BASE'] ?? '';
const hostBase = stagingHostBase || previewHostBase || '';

const mode = stagingUrl ? 'staging' : previewUrl ? 'preview' : 'local';

// One-line diagnostic — makes the mode + resolved base URL obvious in
// the arrival Job log, which is often the only artifact a human sees
// when the pod dies before Playwright writes test-results/.
// eslint-disable-next-line no-console
console.log(
  `[playwright] mode=${mode} baseURL=${baseURL} hostBase=${hostBase || '<unset>'}`,
);

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL,
    headless: true,
    screenshot: 'on',
    video: 'on',
    trace: 'on',
  },
  reporter: [['list']],
  outputDir: 'test-results',
});

import { test, expect } from 'playwright/test';

/**
 * Fleet-status SDK dogfood spec.
 *
 * Navigates to /fleet-status — the page calls each peer golden-template
 * service via direct HTTP (mirroring what the generated TS SDK does
 * under the hood). With no bearer, each peer's auth wiring should
 * respond 401.
 *
 * Renders pass for any row that gets 401 (=expected). Fail = any
 * unexpected status, CORS block, network error, etc.
 *
 * This is the runtime proof that:
 *   1. The Angular template builds + serves successfully ✓
 *   2. The browser can reach peer services on the same cluster ✓
 *   3. Each peer's auth middleware is wired correctly ✓
 *
 * Phase A.5b extends this with token-mint via Hydra + authed call
 * pattern, mirroring auth-ui's spec shape.
 *
 * Note on CORS: peers may not have CORS allowed for this origin
 * yet — Phase A.5c adds the CORS layer to backend templates. Until
 * that lands, this spec gracefully captures the CORS-block failure
 * with `Failed to fetch` in the message column, which is itself a
 * useful signal (network reached, auth wiring not yet validatable
 * because CORS is upstream of auth).
 */
test.describe('fleet status', () => {
  test('renders fleet-status table with each peer probed', async ({ page }) => {
    await page.goto('/fleet-status', { waitUntil: 'networkidle', timeout: 15_000 });

    // Table renders with header + 3 peer rows.
    const table = page.getByTestId('fleet-status-table');
    await expect(table, 'fleet-status-table not visible').toBeVisible({
      timeout: 5_000,
    });

    // Each peer row exists.
    for (const svc of [
      'leartech-rust-service-template',
      'leartech-dotnet-service-template',
      'leartech-go-service-template',
    ]) {
      const row = page.getByTestId(`fleet-row-${svc}`);
      await expect(row, `row for ${svc} not visible`).toBeVisible();
    }
  });

  test('every peer responds with the expected 401 status', async ({ page }) => {
    await page.goto('/fleet-status', { waitUntil: 'networkidle', timeout: 15_000 });

    // Wait for the page's async fleet check to settle. Each row's
    // status moves from `pending` → `pass`/`fail` once its fetch
    // completes. We wait for the overall verdict to leave `pending`.
    const overallPending = page.getByTestId('overall-pending');
    await expect(overallPending, 'fleet check still pending').toHaveCount(0, {
      timeout: 15_000,
    });

    // All 3 peers should report pass (HTTP 401 from auth wiring).
    for (const svc of [
      'leartech-rust-service-template',
      'leartech-dotnet-service-template',
      'leartech-go-service-template',
    ]) {
      const status = page.getByTestId(`status-${svc}`);
      await expect(status, `${svc} status should be pass`).toContainText('pass');
    }

    // Overall row reads pass.
    await expect(page.getByTestId('overall-pass')).toBeVisible();
  });
});

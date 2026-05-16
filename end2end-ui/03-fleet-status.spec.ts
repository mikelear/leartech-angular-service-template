import { test, expect } from 'playwright/test';

/**
 * Fleet-status SDK dogfood spec — STAGING-ONLY.
 *
 * Navigates to /fleet-status, which calls each peer golden-template
 * service via the published SDK (npm package from leartech-ts-packages).
 *
 * **Skips in PR preview**: PR-preview namespaces deploy only the
 * angular template's own service, not peers. The fleet-status page
 * would render a table where every row times out trying to reach a
 * non-existent peer URL. Per the observer 0.0.27 staging-vs-preview
 * contract, STAGING_URL presence is the discriminator — only staging
 * dispatches have it set.
 *
 * **In staging** (arrivals-observer dispatched Job): all peer
 * templates are deployed at predictable URLs, the page actually
 * calls them, and the test asserts each row reaches a terminal
 * state (pass or fail) with a non-pending verdict.
 *
 * The strict "every peer returns 200" assertion requires CORS to be
 * allowed on each backend template (Phase A.5c, separate workstream).
 * Until then, this spec asserts "call completed" not "call succeeded".
 */
test.describe('fleet status', () => {
  test.beforeEach(() => {
    // Skip-in-preview per observer 0.0.27 contract — fleet-status
    // requires all 3 peer templates deployed, which only happens in
    // staging (or local-dev pointed at staging URLs).
    if (!process.env['STAGING_URL']) {
      test.skip(true, 'fleet-status requires peer services — staging-only');
    }
  });


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

  test('every peer reaches a terminal state (call was attempted)', async ({ page }) => {
    await page.goto('/fleet-status', { waitUntil: 'networkidle', timeout: 15_000 });

    // Wait for the page's async fleet check to settle. Each row's
    // status moves from `pending` → `pass`/`fail` once its fetch
    // completes. Either outcome is acceptable signal that the SDK
    // call was attempted:
    //
    //   - `pass` = peer returned the expected 401 (CORS allowed +
    //     auth wiring on)
    //   - `fail` = peer returned a non-401 OR CORS blocked the fetch
    //     ('Failed to fetch'). Both still prove the page COMPOSED the
    //     right URL and FIRED the call — the SDK code path executes.
    //
    // The strict `must be 401` assertion comes back once the backend
    // templates ship CORS headers for this origin (Phase A.5c). Until
    // then, asserting non-pending is the load-bearing signal.
    const overallPending = page.getByTestId('overall-pending');
    await expect(overallPending, 'fleet check still pending').toHaveCount(0, {
      timeout: 15_000,
    });

    for (const svc of [
      'leartech-rust-service-template',
      'leartech-dotnet-service-template',
      'leartech-go-service-template',
    ]) {
      const status = page.getByTestId(`status-${svc}`);
      // Must not be pending — must have a terminal verdict.
      await expect(status, `${svc} should not be pending`).not.toContainText('pending');
    }

    // Overall row must reach a terminal verdict too (not pending).
    await expect(page.getByTestId('overall-pending')).toHaveCount(0);
  });
});

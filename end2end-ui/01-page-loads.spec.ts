import { test, expect } from 'playwright/test';

/**
 * Golden-standard smoke test: verifies the Angular app loads without
 * JS errors and renders the expected root element. Every Angular app
 * cloned from the template inherits this test.
 *
 * Runs in BOTH contexts (PR preview + post-deploy staging arrival) —
 * no `STAGING_URL` gate. Assertions must be render-mode-agnostic:
 * with `outputMode: "static"` the crawler view sees prerendered HTML
 * immediately, then the browser hydrates and the same DOM keeps
 * rendering. We wait on the DOM being ATTACHED (which is true from
 * the very first paint of the prerendered HTML) rather than
 * `networkidle`, which is finicky under hydration + long-lived
 * angular-auth-oidc-client polls and can time out on staging even
 * when the page is fully interactive.
 */
test.describe('page loads', () => {
  test('no JavaScript errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15_000 });

    // Wait for hydration to have a fair chance to run — spec 04's
    // sign-out flow is what covers post-hydration behaviour; here we
    // just want to know the initial paint didn't throw. `app-root`
    // being visible is a stronger signal than networkidle without
    // the flakiness.
    const appRoot = page.locator('app-root');
    await expect(appRoot, 'app-root missing on initial paint').toBeAttached({
      timeout: 10_000,
    });

    // Filter out expected errors (CORS on localhost, etc.).
    const unexpected = errors.filter(
      (e) => !e.includes('CORS') && !e.includes('net::ERR_FAILED'),
    );

    expect(unexpected, unexpected.join('\n')).toEqual([]);
  });

  test('app-root element renders', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    const appRoot = page.locator('app-root');
    await expect(appRoot).toBeAttached({ timeout: 10_000 });
  });

  test('page title is set', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    // Wait for the title to be populated — either the prerendered
    // <title> or the runtime-set one from AppTitleStrategy.
    await expect
      .poll(async () => (await page.title()).length, {
        timeout: 5_000,
        message: 'page title never populated',
      })
      .toBeGreaterThan(0);
  });
});

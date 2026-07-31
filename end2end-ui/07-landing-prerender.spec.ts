import { test, expect, request } from 'playwright/test';

/**
 * Landing + prerender crawlability spec.
 *
 * The `seo-preview` Tekton step (see `.lighthouse/jenkins-x/seo-preview.yaml`)
 * runs the fuller crawlability check against the deployed preview
 * URL and posts a PR comment; THIS spec is the browser-facing
 * equivalent for consumers who want a Playwright signal too. Both
 * checks assert the same core invariant: raw-HTML fetches of
 * Prerender-mode routes contain real, content-bearing HTML — NOT
 * an empty `<app-root>` CSR shell.
 *
 * `page.goto` runs JS after load, which would defeat the check
 * (Angular hydrates and fills the shell). We use Playwright's
 * `request` context to fetch raw HTML — the crawler / AI-client
 * view.
 */
test.describe('landing + prerender', () => {
  test('landing route renders in the browser', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    const heading = page.getByTestId('landing-heading');
    await expect(heading, 'landing-heading data-testid must render on /').toBeVisible({
      timeout: 5_000,
    });
    await expect(heading).toContainText('Leartech Angular service template');
    const lead = page.getByTestId('landing-lead');
    await expect(lead).toContainText('Golden Angular 20 SPA service template');
  });

  test('raw HTML fetch of `/` contains prerendered content (no-JS crawler view)', async ({ baseURL }) => {
    // `request.newContext()` gives us a bare HTTP client — no browser,
    // no JS execution. This is what OpenAI's / Perplexity's crawler
    // sees. If prerender is broken (or nginx serves the root
    // index.html for every route), this assertion catches it.
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get('/');
    expect(res.status(), 'raw GET / must return 2xx').toBeLessThan(400);
    const body = await res.text();

    // `<app-root>` must contain real content — not an empty shell.
    const appRootMatch = body.match(/<app-root[^>]*>([\s\S]*?)<\/app-root>/i);
    expect(appRootMatch, '<app-root> tag not found in served HTML').not.toBeNull();
    const inner = (appRootMatch?.[1] ?? '').trim();
    expect(
      inner.length,
      `<app-root> body is only ${inner.length} chars — prerender likely NOT delivered`,
    ).toBeGreaterThan(100);

    // Key SEO tags MUST be present in the served HTML.
    expect(body).toMatch(/<title[^>]*>[^<]{5,}<\/title>/i);
    expect(body).toMatch(/<meta[^>]*name=["']description["'][^>]*content=["'][^"']{10,}["']/i);
    expect(body).toMatch(/<link[^>]*rel=["']canonical["'][^>]*href=/i);
    expect(body).toMatch(/<script[^>]*type=["']application\/ld\+json["']/i);
    expect(body).toMatch(/<html[^>]*\blang=["'][a-z\-]+["']/i);

    await ctx.dispose();
  });

  test('raw HTML fetch of `/fleet-status` returns ITS OWN prerendered content', async ({ baseURL }) => {
    // Deep-link raw fetch — if nginx's default SPA-fallback is
    // serving the root index.html for every route, this spec fails
    // because the served <title> is the landing one, not fleet's.
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get('/fleet-status');
    expect(res.status(), 'raw GET /fleet-status must return 2xx').toBeLessThan(400);
    const body = await res.text();

    // Fleet-specific title from route data (`app.routes.ts`).
    expect(body).toMatch(/<title[^>]*>Fleet status\s*\|\s*Leartech<\/title>/i);

    await ctx.dispose();
  });

  test('robots.txt is served at the site root and lists a Sitemap directive', async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get('/robots.txt');
    expect(res.status()).toBeLessThan(400);
    const body = await res.text();
    expect(body).toMatch(/User-agent:\s*\*/i);
    expect(body).toMatch(/Sitemap:/i);
    await ctx.dispose();
  });

  test('sitemap.xml is served at the site root and is well-formed', async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get('/sitemap.xml');
    expect(res.status()).toBeLessThan(400);
    const body = await res.text();
    expect(body).toMatch(/<urlset\b/i);
    expect(body).toMatch(/<\/urlset>/i);
    await ctx.dispose();
  });
});

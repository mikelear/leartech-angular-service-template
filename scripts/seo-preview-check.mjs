#!/usr/bin/env node
// seo-preview-check.mjs
//
// Crawlability / SEO check that runs against a DEPLOYED preview URL —
// NOT at build time. A build-time grep of `dist/` can prove that
// prerender happened, but ONLY an HTTP GET against the serving layer
// can prove the runtime serves per-route prerendered HTML on deep
// links + rewrites the __CANONICAL_HOST__ placeholder + serves
// robots.txt + sitemap.xml. That's the whole reason this check lives
// in the preview-time pipeline.
//
// The check fetches with raw HTTP (Node's global fetch) so NO
// JavaScript executes — this is exactly the view an OpenAI /
// Perplexity / GoogleBot crawler sees. If the served HTML for a
// Prerender-mode route is just an empty `<app-root>` shell, this
// step fails.
//
// Output:
//   1. A PR comment (via `gh pr comment`) with a per-route table +
//      per-tag ✓/✗ + PASS/FAIL verdict — like the ai-review comment,
//      updated in place on re-runs via the marker below.
//   2. Raw fetched HTML + JSON report written to
//      `${ARTIFACTS_DIR}/seo-preview/` for the pipeline to upload to
//      GCS.
//   3. Non-zero exit code on hard failure so the Tekton step (and
//      therefore the GitHub status check) is marked failing.
//
// Env inputs:
//   PREVIEW_URL     — full https:// base URL of the deployed preview
//                     (required; catalog end2end tasks set this)
//   PR_NUMBER       — GitHub PR number for the comment (required)
//   REPO_OWNER      — GitHub repo owner  (required for `gh`)
//   REPO_NAME       — GitHub repo name   (required for `gh`)
//   ARTIFACTS_DIR   — where to write the report + raw HTML per route
//                     (default: /workspace/artifacts)
//   PREVIEW_ROUTES  — comma-separated list of Prerender routes to check
//                     (default: "/,/fleet-status")
//   AI_CLIENT_STUB  — set to "1" to include the advisory "AI-client
//                     perspective" section in the comment (a
//                     placeholder for a future model-judged verdict)

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// ---------------------------------------------------------------
// Assertion helpers. Each returns { ok: boolean, note: string }.
// ---------------------------------------------------------------

/** Assert the response is a 2xx. */
function assertOk(status, url) {
  return {
    ok: status >= 200 && status < 300,
    note: `HTTP ${status} ${url}`,
  };
}

/**
 * Assert the served HTML is not just an empty `<app-root>` shell —
 * i.e. prerender actually ran + the server delivered its output.
 * The check accepts ANY content between `<app-root>...</app-root>`
 * that isn't only whitespace.
 */
function assertNonEmptyAppRoot(html) {
  const m = html.match(/<app-root[^>]*>([\s\S]*?)<\/app-root>/i);
  if (!m) {
    return { ok: false, note: '<app-root> tag not found in served HTML' };
  }
  const inner = m[1].trim();
  if (inner.length < 32) {
    return {
      ok: false,
      note: `<app-root> body is empty (only ${inner.length} chars) — CSR shell served, prerender NOT delivered`,
    };
  }
  return { ok: true, note: `<app-root> body is ${inner.length} chars — prerendered content served` };
}

/** Assert a `<meta name="...">` (or property="...") tag is present with non-empty content. */
function assertMeta(html, kind, key) {
  const attr = kind === 'name' ? 'name' : 'property';
  const rx = new RegExp(
    `<meta[^>]*\\b${attr}=["']${key}["'][^>]*\\bcontent=["']([^"']*)["']`,
    'i',
  );
  const m = html.match(rx) || html.match(
    new RegExp(
      `<meta[^>]*\\bcontent=["']([^"']*)["'][^>]*\\b${attr}=["']${key}["']`,
      'i',
    ),
  );
  if (!m) return { ok: false, note: `<meta ${attr}="${key}"> not found` };
  if (!m[1].trim()) return { ok: false, note: `<meta ${attr}="${key}"> content is empty` };
  return { ok: true, note: m[1].slice(0, 80) };
}

/** Assert `<title>` is present with non-empty content. */
function assertTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return { ok: false, note: '<title> not found' };
  if (!m[1].trim()) return { ok: false, note: '<title> is empty' };
  return { ok: true, note: m[1].slice(0, 80) };
}

/** Assert `<html lang="...">` is set. */
function assertHtmlLang(html) {
  const m = html.match(/<html[^>]*\blang=["']([^"']+)["']/i);
  if (!m) return { ok: false, note: '<html lang="..."> not found' };
  return { ok: true, note: m[1] };
}

/**
 * Assert `<link rel="canonical" href="...">` is present with an
 * absolute URL OR with the `__CANONICAL_HOST__` placeholder that the
 * runtime rewrites at container start. Preview environments serve
 * the placeholder BY DESIGN — SEO discovery is prod-only; we assert
 * PRESENCE + well-formed structure here, not host equality (see
 * `README.md` § Preview crawlability check).
 */
function assertCanonical(html) {
  const m = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  if (!m) return { ok: false, note: '<link rel="canonical"> not found' };
  const href = m[1];
  const isAbsolute = /^https?:\/\//i.test(href);
  const isPlaceholder = href.startsWith('__CANONICAL_HOST__');
  if (!isAbsolute && !isPlaceholder) {
    return { ok: false, note: `canonical is neither an absolute URL nor a __CANONICAL_HOST__ placeholder: ${href}` };
  }
  return { ok: true, note: href };
}

/** Assert Organization JSON-LD is present. */
function assertJsonLd(html) {
  const m = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m) return { ok: false, note: 'application/ld+json script not found' };
  try {
    const parsed = JSON.parse(m[1]);
    const type = parsed['@type'] || (parsed['@graph']?.[0]?.['@type']);
    if (!type) return { ok: false, note: 'JSON-LD present but missing @type' };
    return { ok: true, note: `@type=${type}` };
  } catch (e) {
    return { ok: false, note: `JSON-LD is not valid JSON: ${e.message}` };
  }
}

// ---------------------------------------------------------------
// Runtime.
// ---------------------------------------------------------------

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'leartech-seo-preview-check/1.0' },
  });
  const body = await res.text();
  return { status: res.status, body };
}

function tick(ok) { return ok ? '✅' : '❌'; }

async function checkRoute(baseUrl, route) {
  const url = new URL(route.replace(/^\/+/, '/'), baseUrl).toString();
  const { status, body } = await fetchText(url);
  const httpAssert = assertOk(status, url);
  const results = {
    url,
    status,
    httpOk: httpAssert.ok,
    httpNote: httpAssert.note,
    html: body,
    assertions: httpAssert.ok
      ? {
          nonEmptyAppRoot: assertNonEmptyAppRoot(body),
          title: assertTitle(body),
          htmlLang: assertHtmlLang(body),
          description: assertMeta(body, 'name', 'description'),
          canonical: assertCanonical(body),
          ogTitle: assertMeta(body, 'property', 'og:title'),
          ogDescription: assertMeta(body, 'property', 'og:description'),
          ogImage: assertMeta(body, 'property', 'og:image'),
          ogSiteName: assertMeta(body, 'property', 'og:site_name'),
          twitterCard: assertMeta(body, 'name', 'twitter:card'),
          jsonLd: assertJsonLd(body),
        }
      : {},
  };
  return results;
}

async function checkStaticFile(baseUrl, path, contentTypeHint) {
  const url = new URL(path, baseUrl).toString();
  const { status, body } = await fetchText(url);
  const okStatus = status >= 200 && status < 300;
  let wellFormed = { ok: okStatus, note: `HTTP ${status}` };
  if (okStatus) {
    if (contentTypeHint === 'xml') {
      // Very light XML wellformedness check — full-content parse
      // would need a DOM lib; a stanza match is enough for the
      // pipeline signal.
      const hasUrlset = /<urlset\b/i.test(body);
      wellFormed = {
        ok: hasUrlset,
        note: hasUrlset ? 'urlset root present' : 'sitemap.xml does not contain <urlset>',
      };
    } else {
      const hasUserAgent = /User-agent:/i.test(body);
      wellFormed = {
        ok: hasUserAgent,
        note: hasUserAgent ? 'User-agent directive present' : 'robots.txt missing User-agent directive',
      };
    }
  }
  return { url, status, wellFormed, body };
}

function renderComment(previewUrl, routeReports, robotsReport, sitemapReport, verdict, aiClientStub) {
  const marker = '<!-- leartech-seo-preview-comment -->';
  const lines = [];
  lines.push(marker);
  lines.push('## 🔎 Crawlability / SEO preview');
  lines.push('');
  lines.push(`Preview: \`${previewUrl}\``);
  lines.push('');
  lines.push('| Route | HTTP | Content | Title | Description | Canonical | OG title | OG image | Twitter card | JSON-LD |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of routeReports) {
    const a = r.assertions;
    lines.push(
      `| \`${r.url}\` | ${tick(r.httpOk)} ${r.status} `
      + `| ${tick(a.nonEmptyAppRoot?.ok)} `
      + `| ${tick(a.title?.ok)} `
      + `| ${tick(a.description?.ok)} `
      + `| ${tick(a.canonical?.ok)} `
      + `| ${tick(a.ogTitle?.ok)} `
      + `| ${tick(a.ogImage?.ok)} `
      + `| ${tick(a.twitterCard?.ok)} `
      + `| ${tick(a.jsonLd?.ok)} |`,
    );
  }
  lines.push('');
  lines.push(`**robots.txt** — ${tick(robotsReport.wellFormed.ok)} ${robotsReport.wellFormed.note} (\`${robotsReport.url}\`)`);
  lines.push(`**sitemap.xml** — ${tick(sitemapReport.wellFormed.ok)} ${sitemapReport.wellFormed.note} (\`${sitemapReport.url}\`)`);
  lines.push('');
  lines.push(`> Preview runs on a wildcard host, so absolute URL fields (canonical / og:url / sitemap) carry the placeholder / prod domain — this check asserts PRESENCE + structure, not exact host match. Exact prod-domain correctness is a prod-only concern.`);
  lines.push('');
  lines.push(`**Verdict:** ${verdict.ok ? '✅ PASS' : '❌ FAIL'} — ${verdict.summary}`);
  if (aiClientStub) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('### 🤖 AI-client perspective (advisory, non-blocking)');
    lines.push('');
    lines.push('_Stub: this section will (later) feed the raw fetched HTML to a model and summarise "what an AI client understands from this page". Wiring pending; no verdict yet._');
  }
  return lines.join('\n');
}

function computeVerdict(routeReports, robotsReport, sitemapReport) {
  const problems = [];
  for (const r of routeReports) {
    if (!r.httpOk) problems.push(`${r.url} HTTP ${r.status}`);
    const a = r.assertions;
    for (const [k, v] of Object.entries(a)) {
      if (!v.ok) problems.push(`${r.url}: ${k} — ${v.note}`);
    }
  }
  if (!robotsReport.wellFormed.ok) problems.push(`robots.txt: ${robotsReport.wellFormed.note}`);
  if (!sitemapReport.wellFormed.ok) problems.push(`sitemap.xml: ${sitemapReport.wellFormed.note}`);
  if (problems.length === 0) {
    return { ok: true, summary: 'all crawlability / SEO checks passed against the deployed preview.' };
  }
  return { ok: false, summary: `${problems.length} issue(s): ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? '; …' : ''}` };
}

async function upsertPrComment(repoOwner, repoName, prNumber, body) {
  const marker = '<!-- leartech-seo-preview-comment -->';
  // List existing comments; find one bearing our marker; update it if
  // present, else create a new one. Uses `gh` which is available in
  // the pipeline images with the tekton-bot token wired.
  let comments;
  try {
    const raw = execFileSync(
      'gh',
      ['api', `repos/${repoOwner}/${repoName}/issues/${prNumber}/comments`, '--paginate'],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
    );
    comments = JSON.parse(raw);
  } catch (e) {
    console.error(`[seo-preview] failed to list PR comments: ${e.message} — will fall back to create-only.`);
    comments = [];
  }
  const existing = comments.find((c) => (c.body || '').includes(marker));
  if (existing) {
    execFileSync(
      'gh',
      ['api', '--method', 'PATCH', `repos/${repoOwner}/${repoName}/issues/comments/${existing.id}`, '-f', `body=${body}`],
      { encoding: 'utf8' },
    );
    console.log(`[seo-preview] updated existing PR comment ${existing.id}`);
  } else {
    execFileSync(
      'gh',
      ['pr', 'comment', String(prNumber), '--repo', `${repoOwner}/${repoName}`, '--body', body],
      { encoding: 'utf8' },
    );
    console.log(`[seo-preview] created new PR comment`);
  }
}

async function main() {
  const previewUrl = process.env.PREVIEW_URL;
  if (!previewUrl) {
    console.error('[seo-preview] PREVIEW_URL is not set — cannot check. Failing.');
    process.exit(1);
  }
  const prNumber = process.env.PR_NUMBER || process.env.PULL_NUMBER;
  const repoOwner = process.env.REPO_OWNER;
  const repoName = process.env.REPO_NAME;
  const artifactsDir = process.env.ARTIFACTS_DIR || '/workspace/artifacts';
  const routes = (process.env.PREVIEW_ROUTES || '/,/fleet-status').split(',').map((r) => r.trim()).filter(Boolean);
  const aiClientStub = process.env.AI_CLIENT_STUB === '1';

  console.log(`[seo-preview] baseUrl=${previewUrl} routes=${routes.join(',')}`);

  // 1. Per-route HTML fetch + assert.
  const routeReports = [];
  for (const route of routes) {
    const r = await checkRoute(previewUrl, route);
    routeReports.push(r);
    const safe = route.replace(/[^a-z0-9]/gi, '_') || 'root';
    const outDir = join(artifactsDir, 'seo-preview');
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `${safe}.html`), r.html, 'utf8');
  }

  // 2. robots + sitemap.
  const robotsReport = await checkStaticFile(previewUrl, '/robots.txt', 'txt');
  const sitemapReport = await checkStaticFile(previewUrl, '/sitemap.xml', 'xml');
  const outDir = join(artifactsDir, 'seo-preview');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'robots.txt'), robotsReport.body, 'utf8');
  writeFileSync(join(outDir, 'sitemap.xml'), sitemapReport.body, 'utf8');

  // 3. Verdict.
  const verdict = computeVerdict(routeReports, robotsReport, sitemapReport);

  // 4. Write JSON report.
  const report = {
    previewUrl,
    routes: routeReports.map((r) => ({
      url: r.url,
      status: r.status,
      httpOk: r.httpOk,
      assertions: Object.fromEntries(
        Object.entries(r.assertions).map(([k, v]) => [k, { ok: v.ok, note: v.note }]),
      ),
    })),
    robotsTxt: { url: robotsReport.url, status: robotsReport.status, wellFormed: robotsReport.wellFormed },
    sitemapXml: { url: sitemapReport.url, status: sitemapReport.status, wellFormed: sitemapReport.wellFormed },
    verdict,
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log(JSON.stringify(report, null, 2));

  // 5. PR comment (if we have PR context).
  if (prNumber && repoOwner && repoName) {
    const body = renderComment(previewUrl, routeReports, robotsReport, sitemapReport, verdict, aiClientStub);
    try {
      await upsertPrComment(repoOwner, repoName, prNumber, body);
    } catch (e) {
      console.error(`[seo-preview] failed to upsert PR comment: ${e.message}`);
    }
  } else {
    console.log('[seo-preview] PR context missing — skipping PR comment.');
  }

  if (!verdict.ok) {
    console.error(`[seo-preview] FAIL — ${verdict.summary}`);
    process.exit(1);
  }
  console.log('[seo-preview] PASS');
}

main().catch((e) => {
  console.error(`[seo-preview] uncaught: ${e.stack || e.message}`);
  process.exit(2);
});

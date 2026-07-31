# leartech-angular-service-template

Golden Angular SPA service template. Clone-and-rename for new Leartech Angular services. Satisfies `hub/shared-rules/golden-service-standard.md`.

> **Staging prerequisites** (one-time per cluster, when forking this template into a new Angular service):
>
> 1. Add `helmfiles/jx-staging/configs/<your-service>.yaml` to each gitops repo populating `config.auth.authority` + `config.peers.*` per cluster — auto-promote bumps versions but never adds per-env config wiring.
> 2. Run `leartech-auth-service/scripts/setup-auth.sh --env staging` once with your service's staging `/auth/callback` added to `EXTRA_REDIRECT_URIS` — Hydra needs the redirect_uri registered on `frontend-services` for the OIDC flow.

## Clone-and-rename

```bash
gh repo clone mikelear/leartech-angular-service-template leartech-my-ui
cd leartech-my-ui
git remote set-url origin git@github.com:mikelear/leartech-my-ui.git
grep -rl leartech-angular-service-template . --exclude-dir={node_modules,dist,.git} \
  | xargs sed -i '' 's/leartech-angular-service-template/leartech-my-ui/g'
# Seed bootstrap tag so jx-release-version has a base
git tag -fa v0.0.1 -m "bootstrap"
git push origin main v0.0.1
# Register in source-config.yaml on both clusters (see hub/CLAUDE.md)
```

## Local development

```bash
npm install --legacy-peer-deps

# Dev server (http://localhost:4200)
npm start

# Production build
npm run build

# Unit tests + coverage (ChromeHeadless)
npm test

# Lint
npm run lint
```

## Web vs App mode (prerendering + SEO)

The template ships with Angular SSR configured in **static-output**
mode (`outputMode: "static"` in `angular.json`) — the build emits a
prerendered `index.html` per route AND stays static-hostable (there
is no long-running Node/Express server in the deploy path). The same
template supports two consumer shapes:

### Web mode — a marketing / content site

Routes use `RenderMode.Prerender` (the default `**` entry in
`src/app/app.routes.server.ts`). Each route's `data.title` +
`data.description` in `src/app/app.routes.ts` drives the per-page
`<title>`, `<meta name="description">`, Open Graph, Twitter card,
and canonical link via `AppTitleStrategy` +
`src/app/core/seo/seo.service.ts`. `ng build` emits
`dist/…/browser/<route>/index.html` for every prerendered route;
crawlers and AI clients see fully rendered content.

Site-wide SEO defaults live in `src/index.html` (`<html lang>`,
default `<meta name="description">`, `og:site_name`, `theme-color`,
Organization JSON-LD). `public/robots.txt` + `public/sitemap.xml`
are copied to the site root. Absolute URLs (canonical / og:url /
sitemap) use the `__CANONICAL_HOST__` placeholder — the runtime
nginx entrypoint (`nginx/docker-entrypoint.d/40-canonical-host.sh`)
rewrites them at container start against the deployment's
`CANONICAL_HOST` env, set by the chart's `seo.canonicalHost` value.
Same static artifact, correct-per-deployment SEO URLs, reusable
across multiple ingress hosts.

### App mode — a behind-auth SPA front-end

Routes use `RenderMode.Client` (see the commented example in
`src/app/app.routes.server.ts`). The build emits a plain CSR shell
for each Client-mode route; the browser bootstraps and hydrates as
before. The build is STILL static — Client-mode is not a Node
server, just a directive to skip prerender for the route.

The template's own `/auth/callback` route uses Client mode because
its `ngOnInit` touches `sessionStorage` (which is browser-only) — a
useful reference for any app route that reads browser storage or
depends on runtime API responses that don't exist at build time.

### Per-page SEO via route data

```ts
{
  path: 'about',
  loadComponent: () => import('./about/about.component').then(m => m.AboutComponent),
  data: {
    title: 'About | Leartech',
    description: 'How the Leartech platform is built.',
    // optional: image, ogType, twitterCard, siteName, url
  },
}
```

`AppTitleStrategy` (registered in `app.config.ts`) reads this data
on every navigation and calls `SeoService.update(...)`.

### Multi-domain fronting + canonical host

A single deployment can be fronted by multiple domains via
`ingress.hosts:` (a list). `seo.canonicalHost` is a SINGLE domain
that crawlers should treat as the source of truth — with multiple
served hosts, one MUST be declared canonical or crawlers treat the
copies as duplicate content. See `charts/…/values.yaml` for the
shape.

### Preview crawlability check

`.lighthouse/jenkins-x/seo-preview.yaml` runs an SEO / crawlability
check against the deployed preview URL (raw HTTP fetch, no
JavaScript) and posts a markdown PR comment. See
`scripts/seo-preview-check.mjs` for the assertions.

## Release

Pushes to `main` fire the `release` pipeline in `.lighthouse/jenkins-x/release.yaml`, which uses `mikelear/leartech-pipeline-catalog/tasks/angular/release.yaml@main`:

1. `jx-release-version` computes the next semver (cluster-suffix aware)
2. `ng build --configuration production` produces the browser bundle
3. Kaniko builds the Dockerfile → publishes to the cluster's OCI registry
4. Cosign signs the image
5. Helm chart packaged + pushed
6. `jx promote` opens the gitops PR against `jx-build-cluster-{gsm,akv}`

## Dependencies

- `leartech-nginx` base image (runtime) — `ghcr.io/mikelear/leartech-nginx:X`
- `leartech-pipeline-catalog` — Tekton task catalog
- `leartech-helm-library` — shared chart helpers
- `jx-cluster-config` ConfigMap per cluster (`CLUSTER_ID=gcp` / `CLUSTER_ID=az`)

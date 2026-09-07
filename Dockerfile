# Golden Dockerfile — Node build stage, leartech-nginx runtime.
# Build stage: node:22-alpine for `ng build` (npm install already ran in
# the pipeline's build-npm-install step with GitHub Packages auth, so
# node_modules is in the kaniko build context — no `npm ci` here).
# Runtime: leartech-nginx (nginxinc/nginx-unprivileged + golden default.conf).
# Renovate bumps both tags on new releases.

# ---- build stage ----
FROM node:22-alpine AS build

WORKDIR /app
COPY . .
RUN npm run build

# ---- runtime stage ----
# leartech-nginx bakes in: port 8080, SPA try_files fallback to index.html,
# /health JSON probe, gzip, 1y cache on hashed static assets. Runs as uid 101.
FROM ghcr.io/mikelear/leartech-nginx:0.51.3

# ---------------------------------------------------------------
# SSR / prerender static output.
#
# Angular's `outputMode: "static"` emits a `browser/` tree that
# contains, for each Prerender-mode route, its OWN `index.html`
# (`/index.html`, `/fleet-status/index.html`, …). We serve these as
# real static files with a `$uri` -> `$uri/index.html` -> `/index.html`
# try_files chain so:
#
#   GET /                → browser/index.html            (prerendered)
#   GET /fleet-status    → browser/fleet-status/index.html (prerendered)
#   GET /app/dashboard   → browser/index.html            (SPA fallback,
#                                                          Client-mode)
#
# The default leartech-nginx `try_files $uri $uri/ /index.html`
# fallback would serve the ROOT index.html for `/fleet-status` and
# defeat prerender — hence the per-route conf below.
# ---------------------------------------------------------------
COPY --from=build /app/dist/leartech-angular-service-template/browser /usr/share/nginx/html

# Static-serving config: try file → try dir/index.html → SPA fallback.
COPY nginx/conf.d/leartech-spa.conf /etc/nginx/conf.d/default.conf

# ---------------------------------------------------------------
# Canonical-host substitution.
#
# `robots.txt`, `sitemap.xml`, `index.html`, and every prerendered
# route's `index.html` contain a `__CANONICAL_HOST__` token where the
# canonical URL / OG url / sitemap host should go. At container start
# we rewrite it to the value of the `CANONICAL_HOST` env var (set by
# the chart from `seo.canonicalHost`), keeping ONE static artifact
# reusable across preview / staging / prod.
#
# In preview the placeholder stays as the marketing/prod domain by
# design — the preview crawlability check asserts presence + well-
# formedness, not host equality. Exact prod-domain correctness is a
# prod-only concern.
# ---------------------------------------------------------------
COPY nginx/docker-entrypoint.d/40-canonical-host.sh /docker-entrypoint.d/40-canonical-host.sh
USER root
RUN chmod +x /docker-entrypoint.d/40-canonical-host.sh

# USER + EXPOSE inherited from base image. Declared explicitly here so
# security scanners that don't chase base-image layers (semgrep's
# missing-user rule, kyverno runAsNonRoot checks) are happy.
USER 101
EXPOSE 8080

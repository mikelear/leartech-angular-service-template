#!/bin/sh
# 40-canonical-host.sh — replaces the __CANONICAL_HOST__ token in every
# served HTML / robots.txt / sitemap.xml with the deployment's
# canonical host, at container start.
#
# WHY at container start (not at build time):
#   The prerender / build stage is domain-agnostic on purpose — the
#   same static artifact is reused across preview / staging / prod
#   deployments AND across multiple ingress hosts on the same
#   deployment. Baking the canonical URL at build would force a
#   rebuild per domain and break multi-domain fronting entirely.
#
# WHY as a nginx-unprivileged entrypoint (not app code):
#   The base image (leartech-nginx / nginxinc/nginx-unprivileged) runs
#   `/docker-entrypoint.d/*.sh` on start. This is the standard hook.
#   No Node/Express involved — the artifact remains static-hostable.
#
# HOW to set $CANONICAL_HOST:
#   The chart sets it via the deployment env from
#   `.Values.seo.canonicalHost`. Preview / staging / prod each supply
#   their own value; if unset, the placeholder stays in place (fine
#   for local `docker run`).

set -eu

CANONICAL_HOST="${CANONICAL_HOST:-}"

if [ -z "${CANONICAL_HOST}" ]; then
    echo "[canonical-host] CANONICAL_HOST unset — leaving __CANONICAL_HOST__ placeholder in place." >&2
    exit 0
fi

# Trim trailing slash so canonical URLs render as
# `https://example.com/`, not `https://example.com//`.
CANONICAL_HOST="${CANONICAL_HOST%/}"

echo "[canonical-host] rewriting __CANONICAL_HOST__ -> ${CANONICAL_HOST}" >&2

# Escape sed special chars in the substitution value ('/', '&').
esc=$(printf '%s' "${CANONICAL_HOST}" | sed 's/[&/\]/\\&/g')

# Files that carry the placeholder: every prerendered HTML file plus
# robots.txt + sitemap.xml. Also handles nested route index.html files.
find /usr/share/nginx/html \
    \( -name '*.html' -o -name 'robots.txt' -o -name 'sitemap.xml' \) \
    -type f \
    -exec sed -i "s|__CANONICAL_HOST__|${esc}|g" {} +

echo "[canonical-host] done." >&2

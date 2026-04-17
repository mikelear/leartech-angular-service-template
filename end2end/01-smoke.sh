#!/usr/bin/env bash
# 01-smoke.sh — golden-standard smoke test for the preview deploy.
#
# Exercises the preview URL: the SPA root returns 200 HTML, the nginx
# /health probe returns 200 JSON. Fails (exit 1) on the first
# unexpected status.
#
# Invoked by end2end/run.sh which captures exit status and last-3-lines
# of output for the PR sticky comment.

set -eo pipefail
: "${PREVIEW_URL:?PREVIEW_URL must be set by the end2end task}"

check() {
  local method="$1" path="$2" want="$3"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X "$method" -m 10 "${PREVIEW_URL}${path}" 2>/dev/null || true)
  [ -z "$code" ] && code="000"
  if [ "$code" = "$want" ]; then
    printf '[smoke] %-4s %-16s %s\n' "$method" "$path" "HTTP $code ✓"
  else
    printf '[smoke] %-4s %-16s %s\n' "$method" "$path" "HTTP $code (want $want) ✗"
    return 1
  fi
}

# SPA routes — leartech-nginx falls back to index.html for unknown paths.
check GET  /            200
check HEAD /            200
# Kube probe endpoint baked into leartech-nginx.
check GET  /health      200
check HEAD /health      200

echo "[smoke] all 4 checks passed"

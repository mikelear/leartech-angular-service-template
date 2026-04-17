# Golden Dockerfile — Node build stage, leartech-nginx runtime.
# Build stage: node:22-alpine for fast npm install + ng build.
# Runtime: leartech-nginx (nginxinc/nginx-unprivileged + golden default.conf).
# Renovate bumps both tags on new releases.

# ---- build stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Dependency layer — cached unless package-lock changes
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

# ---- runtime stage ----
# leartech-nginx bakes in: port 8080, SPA try_files fallback to index.html,
# /health JSON probe, gzip, 1y cache on hashed static assets. Runs as uid 101.
FROM ghcr.io/mikelear/leartech-nginx:0.19.0

COPY --from=build /app/dist/leartech-angular-service-template/browser /usr/share/nginx/html

# USER + EXPOSE inherited from base image. Declared explicitly here so
# security scanners that don't chase base-image layers (semgrep's
# missing-user rule, kyverno runAsNonRoot checks) are happy.
USER 101
EXPOSE 8080

# leartech-angular-service-template — Claude Context

Golden Angular SPA service template. Consumers clone-and-rename into new service repos.

## What this repo is

A minimal Angular 20 SPA that satisfies every rule in `~/leartech/hub/shared-rules/golden-service-standard.md`. It is the **first** thing cloned when creating a new Angular UI service. The template itself isn't deployed anywhere — `charts/leartech-angular-service-template/` is a reference chart, not a live one.

## Repo layout

| Path | Purpose |
|---|---|
| `src/main.ts` + `src/app/` | Minimal Angular 20 bootstrap with a single AppComponent |
| `src/index.html`, `src/styles.scss` | Host page + global styles |
| `src/app/app.component.spec.ts` | Example unit test — ensures `ng test` has something to run |
| `angular.json` | CLI config with build, serve, test (Karma), lint (@angular-eslint) targets |
| `tsconfig.{json,app.json,spec.json}` | Strict TypeScript config |
| `karma.conf.js` | ChromeHeadlessNoSandbox so CI doesn't need `--privileged` |
| `Dockerfile` | Multi-stage: node:22-alpine build → `ghcr.io/mikelear/leartech-nginx:X` runtime |
| `charts/leartech-angular-service-template/` | Helm chart with `leartech-helm-library` dependency |
| `preview/` | Per-PR preview helmfile |
| `end2end/` | Smoke tests run by the shared end2end Tekton task |
| `.lighthouse/jenkins-x/` | Full pipeline suite (thin `uses:` wrappers) |

## Pipeline triggers (Step 1 MVP)

- `pr` — npm install + ng build + kaniko + jx-preview
- `release` — postsubmit release chain (catalog orchestrator + `release/*` extracted steps)

**Still to add** (Step 2+): `lint`, `test`, `npm-audit`, `security-scan`, `image-scan`, `dynamic-scan`, `ai-review`, `end2end`, `ai-feedback`.

## Catalog references

- `tasks/angular/pullrequest.yaml@main` — PR build orchestrator
- `tasks/angular/release.yaml@main` — Release orchestrator (consumes `release/*` extracted steps)

Keep the template thin: every `uses:` in `.lighthouse/jenkins-x/*.yaml` points at a catalog task; zero pipeline logic lives here.

## Iteration mechanics

Per `feedback_template_main_push.md` — commit directly to `main`; exercise via PRs in a consumer repo (first consumer: `leartech-auth-ui` retrofit once this template is golden).

## Runtime base

Built from `ghcr.io/mikelear/leartech-nginx:0.19.0` which bakes in:
- Port 8080, uid 101 (nginx-unprivileged)
- SPA `try_files $uri $uri/ /index.html` fallback
- `/health` returning 200 JSON for kube probes
- gzip on text assets, 1y immutable cache on hashed static files

Consumers needing custom nginx config COPY their own `/etc/nginx/conf.d/default.conf` on top.

## Dependencies that must exist for this to work end-to-end

- `leartech-nginx` published to ghcr.io (✓ v0.19.0 cosign-signed)
- `leartech-pipeline-catalog/tasks/angular/{pullrequest,release}.yaml` — MVP
- `leartech-helm-library` on both cluster OCI chart registries
- `jx-cluster-config` ConfigMap with `CLUSTER_ID: gcp` / `CLUSTER_ID: az`
- Registration in `jx-build-cluster-{gsm,akv}/.jx/gitops/source-config.yaml` before pipelines fire

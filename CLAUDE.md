# leartech-angular-service-template — Claude Context

Golden Angular 20 SPA service template. Clone-and-rename starter for new
Leartech Angular UI services, fully wired into a Jenkins X / Lighthouse
multi-cluster CI/CD chain.

## Bootstrap a new service with Claude

Open Claude Code (or any capable coding agent) in a fresh clone of this
repo and feed it this prompt:

> Rename this template from `leartech-angular-service-template` to
> `leartech-<my-service>`. Touch `package.json`, `angular.json`,
> `README.md`, `charts/**/*.yaml`, `preview/helmfile.yaml.gotmpl`,
> `.lighthouse/jenkins-x/*.yaml`, and `src/index.html`'s `<title>`.
> Then seed a `v0.0.1` git tag and update `renovate.json`'s
> `matchPackageNames` if the nginx base image needs tracking. Leave
> the `.lighthouse/jenkins-x/*` files' `uses:` references pointing at
> `mikelear/leartech-pipeline-catalog` unchanged — those are shared.

Claude should be able to complete the rename in one pass by grepping
for `leartech-angular-service-template` and substituting. The only
file that needs manual attention is `src/index.html` where the
`<title>` is the user-visible page title.

After rename, run:

```bash
npm install --legacy-peer-deps    # generates package-lock.json
git tag -fa v0.0.1 -m "bootstrap: seed for jx-release-version"
git push origin main v0.0.1
```

Register the repo on each Lighthouse cluster's gitops source-config
(see **Cluster prerequisites** below), push a trivial PR, and the
full 10-check presubmit chain fires.

## Repo layout

| Path | Purpose |
|---|---|
| `src/main.ts` + `src/app/` | Angular 20 standalone app — AppComponent + app.config.ts + app.routes.ts |
| `src/index.html`, `src/styles.scss` | Host page + global styles (change `<title>` per service) |
| `src/app/app.component.spec.ts` | Minimal unit test so `ng test` has something to run |
| `angular.json` | CLI config — build, serve, test (Karma), lint (@angular-eslint) targets |
| `tsconfig.{json,app.json,spec.json}` | Strict TypeScript config |
| `karma.conf.js` | ChromeHeadlessNoSandbox so CI runs without `--privileged` |
| `eslint.config.mjs` | Flat ESLint config (typescript-eslint + angular-eslint) |
| `Dockerfile` | Multi-stage: `node:22-alpine` build → `ghcr.io/mikelear/leartech-nginx:X` runtime |
| `charts/leartech-angular-service-template/` | Helm chart — deployment, service, ingress, config ConfigMap |
| `preview/` | Per-PR preview helmfile (env-templated URLs) |
| `end2end/run.sh` + `end2end/01-smoke.sh` | Smoke tests run by shared end2end Tekton task |
| `.lighthouse/jenkins-x/` | 10-trigger presubmit + release suite (thin `uses:` wrappers) |
| `renovate.json` | Dependency bump automation (patch auto-merge, leartech-nginx auto-merge) |

## Pipeline triggers

All 10 checks below are thin wrappers over
[mikelear/leartech-pipeline-catalog](https://github.com/mikelear/leartech-pipeline-catalog)
tasks. Zero pipeline logic lives in this repo.

| Check | Catalog source |
|---|---|
| `pr` | `tasks/angular/pullrequest.yaml` — npm install + ng build + kaniko + jx-preview |
| `lint` | `tasks/ng-lint/pullrequest.yaml` |
| `test` | `tasks/ng-test/pullrequest.yaml` — Karma + LCOV coverage sticky comment |
| `npm-audit` | `tasks/npm-audit/pullrequest.yaml` |
| `security-scan` | `tasks/security-scan/pullrequest.yaml` — gitleaks + semgrep + grype |
| `image-scan` | `tasks/security-scan/image-scan.yaml` |
| `dynamic-scan` | `tasks/security-scan/dynamic/pullrequest.yaml` — nmap + egress-isolation |
| `ai-review` | `tasks/ai-review/pullrequest.yaml` — multi-LLM code review |
| `ai-feedback` | `tasks/ai-review/feedback.yaml` — comment-triggered on `/ai-feedback` |
| `end2end` | `tasks/end2end/pullrequest.yaml` — runs this repo's `end2end/run.sh` |
| `release` (postsubmit) | `tasks/angular/release.yaml` — cluster-suffixed tag, cosign, helm-release, jx-promote |

## Runtime base

Built from `ghcr.io/mikelear/leartech-nginx:0.19.0` which bakes in:

- Port 8080, uid 101 (nginx-unprivileged)
- SPA `try_files $uri $uri/ /index.html` fallback
- `/health` returning 200 JSON for Kubernetes probes
- gzip on text assets, 1y immutable cache on hashed static files

Consumers needing custom nginx routing (API reverse proxy, extra
headers) COPY their own `/etc/nginx/conf.d/default.conf` on top.

## Cluster prerequisites

Before pipelines fire on a new clone:

1. **Register** the repo in each Lighthouse cluster's gitops source-config:
   `.jx/gitops/source-config.yaml` → add `- name: leartech-<my-service>` under the `mikelear/` group.
2. **`jx-cluster-config` ConfigMap** must exist in each cluster's `jx` namespace with `CLUSTER_ID: gcp` or `CLUSTER_ID: az` so release pipelines know which cluster-suffixed tag to push.
3. **Container registry access**: Kaniko pushes to `$PUSH_CONTAINER_REGISTRY/$DOCKER_REGISTRY_ORG/<app>:$VERSION` (GCP AR or Azure ACR per cluster). tekton-bot needs push creds.
4. **`ghcr.io` visibility**: on first publish, the container package is private by default — flip to Public at `https://github.com/users/<owner>/packages/container/<app>/settings` so Kaniko on other clusters can pull it.
5. **`cosign-keys` secret** in `jx` namespace holding `cosign.key` for image signing.

## Release mechanics

- `jx-release-version --previous-version from-tag > VERSION`. Custom `--previous-version` logic in `tasks/release/next-version.yaml` is **cluster-suffix aware** — prevents GCP and Azure racing each other on parallel releases.
- Bootstrap: seed `v0.0.1` before the first automated release (otherwise `jx-release-version` has no base to read from).
- Git tag is cluster-suffixed: `v0.0.1-gcp` / `v0.0.1-az`.
- Image tag is plain `$VERSION` (per-cluster registries don't race).
- Cosign signs the cluster-registry image (+ ghcr.io tag).
- `jx promote` opens the auto-PR on each cluster's gitops repo.

## Iteration mechanics

Commit directly to `main` on this repo — it's a template, there's no
prod to break. Exercise pipeline changes via PRs opened **from a
consumer repo** that clones this template.

## Dependencies

- [`mikelear/leartech-pipeline-catalog`](https://github.com/mikelear/leartech-pipeline-catalog) — Tekton task catalog
- [`mikelear/leartech-dockerfiles`](https://github.com/mikelear/leartech-dockerfiles) — `leartech-nginx` base image source
- `ghcr.io/mikelear/leartech-nginx` — runtime base (cosign-signed, weekly rebuild)
- `leartech-helm-library` — shared chart helpers (published to each cluster's OCI chart registry)
- Jenkins X / Lighthouse + Tekton installed on each target cluster

## Running the chain elsewhere

If you're forking this to a new org, the full bill-of-materials is:

1. Fork or rebuild `leartech-dockerfiles` (for `leartech-nginx`)
2. Fork `leartech-pipeline-catalog` and adjust `uses:` references in this template's `.lighthouse/jenkins-x/*.yaml` to point at your fork
3. Fork `leartech-helm-library` (same adjustment on chart's `Chart.yaml` dependency)
4. Update every reference in this template from `mikelear/...` to `<your-org>/...`
5. Ensure Jenkins X is installed on your cluster(s) with Lighthouse + Tekton

# leartech-angular-service-template

Golden Angular SPA service template. Clone-and-rename for new Leartech Angular services. Satisfies `hub/shared-rules/golden-service-standard.md`.

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

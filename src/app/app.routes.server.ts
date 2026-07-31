import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Per-route render modes for the Angular SSR build.
 *
 * This file is the ONE mechanism a service cloned from this template
 * uses to opt each of its routes into the right rendering strategy.
 * The Angular builder reads it during the prerender step (see
 * `outputMode: "static"` in angular.json) and emits, for each
 * `RenderMode.Prerender` route, a real content-bearing `index.html`
 * (`/index.html`, `/<route>/index.html`, …). Crawlers + AI clients
 * that fetch these URLs receive fully rendered HTML — the whole point
 * of adding SSR to this template.
 *
 * Two render modes are supported here (do NOT use `RenderMode.Server`
 * — it would require a long-running Node/Express server, which
 * defeats the static-hostable design of this template):
 *
 *   RenderMode.Prerender
 *     Default for marketing / landing / anonymous routes. Angular
 *     renders the route at build time and writes a static
 *     `index.html` for it. This is what a "real website" needs.
 *
 *   RenderMode.Client
 *     Ship an empty CSR shell for this route; the browser hydrates
 *     it. Use this for authenticated / app-behind-login routes where
 *     the content is dynamic and there is nothing meaningful to bake
 *     at build time. The build artifact is STILL static — Client-mode
 *     routes just fall back to SPA index.html on their server, and
 *     the app.component bootstraps and takes over.
 *
 * Consuming services extend/replace this array to match their own
 * routes. Sensible defaults for the template:
 *
 *   /               → Prerender  (landing / marketing shell)
 *   /fleet-status   → Prerender  (public status page — content is
 *                                 wired at runtime but the shell +
 *                                 SEO tags render server-side; the
 *                                 dynamic peer calls hydrate in the
 *                                 browser exactly as before)
 *   /auth/callback  → Client     (OIDC redirect target; behind the
 *                                 auth flow, no useful HTML to bake)
 */
export const serverRoutes: ServerRoute[] = [
  // ---------------------------------------------------------------
  // Example: an authenticated / app-mode route. Ship a CSR shell;
  // the browser bootstraps and calls the API layer. Cloned services
  // that put app pages behind auth should copy this pattern for
  // each such route.
  //
  //   {
  //     path: 'app/**',
  //     renderMode: RenderMode.Client,
  //   },
  //
  // Kept commented (not applied) — the template's own routes below
  // are all public marketing/status pages and prerender fine.
  // ---------------------------------------------------------------

  {
    // OIDC redirect target — sessionStorage + oidc.checkAuth() are
    // browser-only, so ship a Client shell and let it hydrate. If
    // this were Prerender, `AuthCallbackComponent.ngOnInit` would
    // try to touch sessionStorage during build and crash.
    path: 'auth/callback',
    renderMode: RenderMode.Client,
  },
  {
    // Everything else — including '' (landing) and 'fleet-status' —
    // prerenders to a real HTML file. Marketing / SEO win.
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];

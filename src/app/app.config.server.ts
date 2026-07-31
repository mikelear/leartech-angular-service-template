import { ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { sharedProviders } from './app.providers.shared';
import { serverRoutes } from './app.routes.server';

/**
 * Server-side application config used ONLY during prerender (SSG) at
 * build time. We deliberately DO NOT import the browser `appConfig`
 * here — that config includes `provideLeartechAuth()` and the runtime
 * APP_INITIALIZER, both of which touch browser-only globals
 * (`window.location.origin`, an HTTP fetch of `/api.conf.json`) at
 * provider-creation / bootstrap time and crash prerender.
 *
 * Instead, we compose from `sharedProviders` (router + zone + http +
 * SEO title strategy) plus the SSR wiring:
 *
 *   provideServerRendering(withRoutes(serverRoutes))
 *
 * The result is a static output artifact: prerendered HTML files with
 * a full `<head>` (title / description / OG / Twitter / canonical /
 * JSON-LD) and the rendered `<app-root>` content. NO runtime Node /
 * Express server is required to serve them — `outputMode: "static"`
 * in `angular.json` ensures the output is directly static-hostable.
 *
 * Client-mode routes (`RenderMode.Client` in `app.routes.server.ts`)
 * ship an empty CSR shell; the browser bootstraps against the FULL
 * `appConfig` (including auth) and hydrates them exactly as before.
 */
export const config: ApplicationConfig = {
  providers: [
    ...sharedProviders,
    provideServerRendering(withRoutes(serverRoutes)),
  ],
};

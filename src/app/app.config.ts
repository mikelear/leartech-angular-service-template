import {
  APP_INITIALIZER,
  ApplicationConfig,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EnvironmentService, provideLeartechAuth } from '@mikelear/leartech-common';

import { sharedProviders } from './app.providers.shared';

/**
 * Browser application configuration.
 *
 * Composes `sharedProviders` (router + zone + http + SEO title
 * strategy — see `app.providers.shared.ts`) with the browser-only
 * pieces:
 *
 *   - leartech auth (OIDC against Hydra, audience-bound tokens per
 *     `audiences[]` in api.conf.json). `provideLeartechAuth` reads
 *     `window.location.origin` at provider-creation time, which is
 *     why we keep it OUT of the server config.
 *   - APP_INITIALIZER that loads `/api.conf.json` before any code
 *     reads from `EnvironmentService`. Guarded so it's a no-op during
 *     prerender.
 *
 * Real services cloning this template extend providers with their own
 * feature-area modules. The auth wiring above is identical across every
 * leartech Angular SPA — keep it in sync with the auth-ui template.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    ...sharedProviders,
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const env = inject(EnvironmentService);
        const platformId = inject(PLATFORM_ID);
        // SSR-safety: during prerender we're running server-side and
        // there is NO server serving `/api.conf.json` — the fetch would
        // hang until the build timeout and crash every route's
        // prerender. Marketing/Prerender routes don't need runtime
        // config anyway. Client-mode routes still call this in the
        // browser exactly as today.
        return () => (isPlatformBrowser(platformId) ? env.load() : Promise.resolve());
      },
      multi: true,
    },
    ...provideLeartechAuth(),
  ],
};

import { EnvironmentProviders, Provider, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideRouter, TitleStrategy } from '@angular/router';

import { routes } from './app.routes';
import { AppTitleStrategy } from './core/seo/app-title-strategy';

/**
 * SSR-safe base providers.
 *
 * Kept in this file (rather than in `app.config.ts`) so the server
 * bundle can `import { sharedProviders } from './app.providers.shared'`
 * without dragging in `provideLeartechAuth` — the leartech-common OIDC
 * wiring touches `window.location.origin` at provider-creation time
 * and crashes prerender. Importing this file does NOT import any
 * browser-only symbol.
 *
 * Both browser and server configurations spread this list into their
 * providers array and then layer their own extras on top:
 *
 *   Browser (`app.config.ts`)      — auth providers + runtime-config
 *                                    APP_INITIALIZER.
 *   Server  (`app.config.server.ts`) — SSR wiring + Prerender routes.
 */
export const sharedProviders: (Provider | EnvironmentProviders)[] = [
  provideZoneChangeDetection({ eventCoalescing: true }),
  provideRouter(routes),
  provideHttpClient(withInterceptorsFromDi()),
  { provide: TitleStrategy, useClass: AppTitleStrategy },
];

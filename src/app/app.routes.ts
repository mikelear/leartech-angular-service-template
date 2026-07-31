import { Routes } from '@angular/router';

/**
 * Route table.
 *
 * Each route's `data.title` + `data.description` drives the per-page
 * `<title>` + `<meta name="description">` + Open Graph + Twitter card
 * tags. See `./core/seo/app-title-strategy.ts` for the strategy that
 * consumes these fields.
 *
 * Placeholder titles + descriptions here — consuming services rename
 * them when they clone the template.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./landing/landing.component').then((m) => m.LandingComponent),
    data: {
      title: 'Leartech Angular service template',
      description:
        'Golden Angular 20 SPA service template with SSR prerendering, ' +
        'per-route SEO, and multi-cluster Jenkins X / Lighthouse CI/CD.',
    },
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./auth-callback/auth-callback.component').then(
        (m) => m.AuthCallbackComponent,
      ),
    data: {
      // Never indexed — the OIDC callback is behind the auth flow.
      title: 'Signing in… | Leartech',
      description: 'Completing the OIDC sign-in flow.',
    },
  },
  {
    path: 'fleet-status',
    loadComponent: () =>
      import('./fleet-status/fleet-status.component').then(
        (m) => m.FleetStatusComponent,
      ),
    data: {
      title: 'Fleet status | Leartech',
      description:
        'Live cross-service call verification: each peer template ' +
        'service is queried via HttpClient and the result summarised.',
    },
  },
];

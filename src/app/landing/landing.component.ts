import { Component } from '@angular/core';

/**
 * Landing page for the template's `/` route.
 *
 * Exists so that `outputMode: "static"` prerender emits a real,
 * content-bearing `index.html` at the site root — a crawler / AI
 * client GET-ing `/` receives fully rendered HTML rather than an
 * empty `<app-root>` CSR shell. See `app.routes.server.ts` for the
 * per-route render-mode wiring.
 *
 * Consuming services replace the copy here with their own marketing
 * / product content. The `<h1>` and lead paragraph are the primary
 * SEO surface for the landing route.
 */
@Component({
  selector: 'app-landing',
  template: `
    <section class="landing" data-testid="landing-page">
      <h1 data-testid="landing-heading">Leartech Angular service template</h1>
      <p class="lead" data-testid="landing-lead">
        Golden Angular 20 SPA service template — prerendered for
        crawlers and AI clients, hydrated in the browser, deployed
        static-hostable via Jenkins X / Lighthouse on any leartech
        cluster.
      </p>
      <p>
        Clone this repo, rename <code>leartech-angular-service-template</code>
        everywhere, and start building. See <code>CLAUDE.md</code> for the
        per-service wiring checklist.
      </p>
    </section>
  `,
  styles: [`
    .landing { padding: 1rem 0; max-width: 60ch; }
    .landing h1 { font-size: 1.75rem; margin: 0 0 0.5rem 0; }
    .landing .lead { font-size: 1.1rem; color: #333; margin: 0 0 1rem 0; }
    .landing p { line-height: 1.5; }
  `],
})
export class LandingComponent {}

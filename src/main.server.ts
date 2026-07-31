import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

/**
 * Server entry point used ONLY at build-time during prerender (SSG).
 * `angular.json` sets `outputMode: "static"` on the build target, so
 * this file is invoked by the Angular builder to render each
 * Prerender-mode route into its own static `index.html` file. The
 * resulting artifact is static-hostable — there is no runtime Node
 * server in the deploy path.
 *
 * The `BootstrapContext` argument (containing the server platformRef)
 * is passed by the route extractor + renderer at build time — see
 * `@angular/ssr` `getRoutesFromAngularRouterConfig`. Forgetting to
 * forward it to `bootstrapApplication` produces the opaque NG0401
 * (`Missing Platform`) failure.
 *
 * @returns Bootstrapped ApplicationRef for prerender.
 */
const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(AppComponent, config, context).catch((err) => {
    console.error('[main.server] bootstrap failed:', err);
    throw err;
  });

export default bootstrap;

import {
  Component,
  Injector,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';

interface TokenClaims {
  sub?: string;
  email?: string;
  aud?: string | string[];
  exp?: number;
  ext?: { email?: string; Permissions?: string[] };
  [key: string]: unknown;
}

/**
 * App shell with OIDC auth state. Mirrors leartech-auth-ui's HomeComponent
 * pattern — shows authenticated user info + token claims so the
 * login-flow Playwright spec can verify the round-trip succeeded.
 *
 * SSR / prerender safety:
 *   - `OidcSecurityService` is NOT provided in the server config
 *     (see `app.config.server.ts` — auth is browser-only), so we
 *     avoid calling `inject(OidcSecurityService)` at field-init time.
 *     Instead we inject it lazily inside `ngOnInit` via the parent
 *     `Injector`, guarded by `isPlatformBrowser(...)`.
 *   - The template's authenticated branch is gated by
 *     `isAuthenticated()`, which stays `false` on the server. The
 *     prerendered HTML therefore renders the anonymous shell (nav +
 *     `Sign in` button) — which is the correct crawler-visible view.
 */
@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterLink, RouterOutlet],
  template: `
    <main class="shell">
      <header>
        <h1>{{ title }}</h1>
        <p class="sub">Golden Angular SPA service template.</p>
        <nav>
          <a routerLink="/">Home</a>
          <a routerLink="/fleet-status">Fleet status</a>
          @if (isAuthenticated()) {
            <button type="button" (click)="logout()" class="link-button">Sign out</button>
          } @else {
            <button type="button" (click)="login()" class="link-button">Sign in</button>
          }
        </nav>
      </header>

      @if (isAuthenticated()) {
        <section class="auth-card" data-testid="authenticated-page">
          <h2>Authenticated</h2>
          <p>Signed in as <strong data-testid="user-email">{{ tokenPayload()?.ext?.email ?? tokenPayload()?.email ?? 'unknown' }}</strong></p>
          <p>User ID: <code data-testid="user-id">{{ tokenPayload()?.sub ?? 'unknown' }}</code></p>
          <h3>Token info</h3>
          <pre class="token-display" data-testid="token-payload">{{ tokenPayload() | json }}</pre>
        </section>
      }
      <router-outlet />
    </main>
  `,
  styles: [`
    nav { margin-top: 0.5rem; display: flex; gap: 1rem; align-items: center; }
    nav a, .link-button { color: #06c; text-decoration: none; background: none; border: 0; padding: 0; font: inherit; cursor: pointer; }
    nav a:hover, .link-button:hover { text-decoration: underline; }
    .auth-card { padding: 1rem; border: 1px solid #ddd; border-radius: 4px; margin-top: 1rem; max-width: 60ch; }
    .token-display { background: #f6f6f6; padding: 0.75rem; border-radius: 3px; font-size: 0.8em; overflow-x: auto; }
  `],
})
export class AppComponent implements OnInit {
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  private oidc: OidcSecurityService | null = null;
  title = 'leartech-angular-service-template';

  isAuthenticated = signal(false);
  tokenPayload = signal<TokenClaims | null>(null);

  ngOnInit(): void {
    // SSR-safety: skip OIDC on the server. `OidcSecurityService` is
    // NOT in the server DI graph (auth is browser-only per
    // `app.config.server.ts`), so we resolve it lazily via the parent
    // `Injector` — only in the browser.
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.oidc = this.injector.get(OidcSecurityService);
    this.oidc.isAuthenticated$.subscribe(({ isAuthenticated }) => {
      this.isAuthenticated.set(isAuthenticated);
      if (!isAuthenticated) {
        this.tokenPayload.set(null);
        return;
      }
      this.oidc?.getAccessToken().subscribe((token) => {
        if (!token) {
          this.tokenPayload.set(null);
          return;
        }
        try {
          const payload = token.split('.')[1];
          const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
          this.tokenPayload.set(JSON.parse(atob(normalized)) as TokenClaims);
        } catch {
          this.tokenPayload.set(null);
        }
      });
    });
  }

  login(): void {
    this.oidc?.authorize();
  }

  logout(): void {
    this.oidc?.logoff().subscribe();
  }
}

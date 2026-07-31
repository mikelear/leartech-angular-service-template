import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { of } from 'rxjs';
import { AppComponent } from './app.component';

/**
 * AppComponent is the app shell:
 *   - Header with title + nav (Home / Fleet status + Sign in|out)
 *   - Optional authenticated-user card (only when isAuthenticated())
 *   - Router-outlet — landing / fleet-status / etc. render here
 *
 * OidcSecurityService is resolved LAZILY via `Injector.get(...)` in
 * `ngOnInit` (only in the browser) so the server bundle (which does
 * NOT provide OidcSecurityService — see `app.config.server.ts`)
 * doesn't crash. In Karma the platform IS browser, so the injector
 * lookup hits the stub below exactly like a real bootstrap.
 */
describe('AppComponent', () => {
  const oidcStub: Partial<OidcSecurityService> = {
    isAuthenticated$: of({ isAuthenticated: false, allConfigsAuthenticated: [] }) as never,
    getAccessToken: () => of('') as never,
    authorize: () => undefined,
    logoff: () => of(null) as never,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OidcSecurityService, useValue: oidcStub },
      ],
    }).compileComponents();
  });

  it('renders the title in the header h1', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const h1 = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(h1?.textContent).toContain('leartech-angular-service-template');
  });

  it('sets the title property', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.title).toBe('leartech-angular-service-template');
  });

  it('renders the Sign in button + no auth card when unauthenticated', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="authenticated-page"]')).toBeNull();
    expect(root.textContent).toContain('Sign in');
  });

  it('renders nav links to Home and Fleet status', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const links = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('nav a'),
    ).map((el) => el.getAttribute('routerlink') ?? el.getAttribute('routerLink'));
    expect(links).toContain('/');
    expect(links).toContain('/fleet-status');
  });
});

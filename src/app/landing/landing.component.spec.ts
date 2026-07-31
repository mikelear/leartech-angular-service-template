import { TestBed } from '@angular/core/testing';
import { LandingComponent } from './landing.component';

/**
 * LandingComponent is the `/` route. Its ONLY job is to render
 * marketing-shaped, content-bearing HTML so prerender emits a real
 * `index.html` at the site root. The tests here assert the elements
 * a crawler / AI client cares about are present:
 *   - the primary heading (h1)
 *   - the lead paragraph
 *   - the `landing-page` test-id anchor
 */
describe('LandingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
    }).compileComponents();
  });

  it('renders the landing heading', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const h1 = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="landing-heading"]',
    );
    expect(h1?.textContent).toContain('Leartech Angular service template');
  });

  it('renders the lead paragraph', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const lead = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="landing-lead"]',
    );
    expect(lead?.textContent).toContain('Golden Angular 20 SPA service template');
  });

  it('marks the section with the landing-page test id', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const section = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="landing-page"]',
    );
    expect(section).not.toBeNull();
  });
});

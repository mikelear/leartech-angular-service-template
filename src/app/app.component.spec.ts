import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    // provideRouter([]) supplies the ActivatedRoute that RouterLink
    // injects. Without it Karma throws NG0201 because AppComponent now
    // renders a <a routerLink="/fleet-status"> in its template.
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const h1 = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(h1?.textContent).toContain('leartech-angular-service-template');
  });

  it('sets the title property', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.title).toBe('leartech-angular-service-template');
  });
});

import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  template: `
    <main class="shell">
      <header>
        <h1>{{ title }}</h1>
        <p class="sub">Golden Angular SPA service template.</p>
        <nav>
          <a routerLink="/fleet-status">Fleet status</a>
        </nav>
      </header>
      <section>
        <p>
          Clone this repo, rename <code>leartech-angular-service-template</code>
          everywhere, and start building. See <code>CLAUDE.md</code> for the
          per-service wiring checklist.
        </p>
      </section>
      <router-outlet />
    </main>
  `,
  styles: [`
    nav { margin-top: 0.5rem; }
    nav a { color: #06c; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
  `],
})
export class AppComponent {
  title = 'leartech-angular-service-template';
}

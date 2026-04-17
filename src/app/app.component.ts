import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <main class="shell">
      <header>
        <h1>{{ title }}</h1>
        <p class="sub">Golden Angular SPA service template.</p>
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
})
export class AppComponent {
  title = 'leartech-angular-service-template';
}

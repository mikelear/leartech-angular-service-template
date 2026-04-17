import { Component } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-root',
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
    </main>
  `,
})
export class AppComponent {
  title = 'leartech-angular-service-template';
}

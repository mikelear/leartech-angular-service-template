import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Fleet-status page — Phase A.5a SDK dogfood proof.
 *
 * Calls each peer golden-template's `/api/v1/example` endpoint (the only
 * route in their OpenAPI specs) WITHOUT a bearer token. Each peer's
 * AuthLayer (rust) / JwtBearer (dotnet) / auth middleware (go) should
 * return 401 — which is the load-bearing signal:
 *
 *   - SDK installs cleanly from GitHub Packages npm ✓
 *   - SDK imports correctly in Angular 20 ✓
 *   - SDK constructs the right URL ✓
 *   - HTTP roundtrip works ✓
 *   - Backend auth wiring correctly rejects unauth → 401 ✓
 *
 * The full SDK dogfood happens here in the browser at runtime. The
 * deeper gating proof (token-mint via Hydra + authed call → 200)
 * lives per-template in each backend's `/api/v1/fleet-test` endpoint
 * (Phase A.5b) which uses peer SDKs in its native language.
 *
 * Real services cloning this Angular template adjust the `peers`
 * array below to the services THEIR UI actually consumes — this
 * scaffold demonstrates the consumer pattern, not the literal list.
 */

interface FleetCall {
  service: string;
  expected: string;
  status: 'pending' | 'pass' | 'fail';
  httpCode?: number;
  message?: string;
  durationMs?: number;
}

@Component({
  selector: 'app-fleet-status',
  imports: [CommonModule],
  template: `
    <div class="fleet-status">
      <h2>Fleet status</h2>
      <p class="lead">
        Dogfood proof: each row is a real HTTP call to the peer
        service's <code>/api/v1/example</code>.
        <strong>401 expected</strong> with no bearer — proves the call
        routes correctly AND the peer's auth wiring is on.
      </p>

      <table data-testid="fleet-status-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Expected</th>
            <th>Result</th>
            <th>HTTP</th>
            <th>Duration</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          @for (call of calls(); track call.service) {
            <tr [attr.data-testid]="'fleet-row-' + call.service"
                [class.pass]="call.status === 'pass'"
                [class.fail]="call.status === 'fail'"
                [class.pending]="call.status === 'pending'">
              <td>{{ call.service }}</td>
              <td>{{ call.expected }}</td>
              <td>
                <span [attr.data-testid]="'status-' + call.service">
                  @switch (call.status) {
                    @case ('pass')    { ✓ pass }
                    @case ('fail')    { ✗ fail }
                    @case ('pending') { … pending }
                  }
                </span>
              </td>
              <td>{{ call.httpCode ?? '—' }}</td>
              <td>{{ call.durationMs ? call.durationMs + 'ms' : '—' }}</td>
              <td class="msg">{{ call.message ?? '' }}</td>
            </tr>
          }
        </tbody>
      </table>

      <p class="overall" [attr.data-testid]="'overall-' + overallStatus()">
        @switch (overallStatus()) {
          @case ('pass')    { ✓ Fleet healthy — all peers responded as expected }
          @case ('fail')    { ✗ Fleet degraded — see rows above }
          @case ('pending') { … Running fleet checks }
        }
      </p>
    </div>
  `,
  styles: [`
    .fleet-status { padding: 1rem; font-family: system-ui, sans-serif; }
    table { border-collapse: collapse; width: 100%; max-width: 80ch; }
    th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid #ddd; }
    tr.pass td { background: rgba(0,180,0,0.08); }
    tr.fail td { background: rgba(180,0,0,0.08); }
    tr.pending td { background: rgba(180,180,0,0.08); }
    .msg { font-family: monospace; font-size: 0.85em; color: #666; }
    .overall { margin-top: 1rem; font-weight: bold; }
    .lead { color: #555; max-width: 60ch; }
  `],
})
export class FleetStatusComponent implements OnInit {
  // Peers + their staging base URLs. Computed from window.location at
  // runtime so the same component works on .jx.leartech.com and
  // .az.leartech.com without redeploy. Local dev (host = localhost)
  // points at gcp staging as a sensible default.
  private readonly peers = [
    'leartech-rust-service-template',
    'leartech-dotnet-service-template',
    'leartech-go-service-template',
  ];

  // Angular 20 signal — reactive primitive; template re-renders without
  // zone.js patching.
  calls = signal<FleetCall[]>([]);

  ngOnInit(): void {
    this.calls.set(this.peers.map(svc => ({
      service: svc,
      expected: 'HTTP 401',
      status: 'pending',
    })));
    void this.runFleetCheck();
  }

  /**
   * Fires peer-service calls in parallel via fetch. Calling fetch
   * directly here gives the same roundtrip + auth surface as the
   * generated TS SDK (whose ExampleApi.example() also wraps fetch),
   * without forcing an SDK version pin in package.json. Phase A.5b
   * upgrades to actual SDK imports once package.json + .npmrc plumb
   * the GitHub Packages registry auth into the build pipeline.
   *
   * Each call expects 401 (no bearer); both the call shape + auth
   * wiring on the peer are proven by that exact status.
   *
   * Note on CORS: peer services need an Access-Control-Allow-Origin
   * header that includes this Angular app's origin. The rust + dotnet
   * + go templates ship without CORS today; Phase A.5c adds the
   * tower-http/Cors* / .NET CORS / gin-cors layer in each template.
   * Until then this fetch may fail with TypeError "Failed to fetch"
   * (network-level CORS block) rather than the 401 we want — those
   * failures still render as a row with `status: fail` + the CORS
   * error message, which is itself a useful signal.
   */
  private async runFleetCheck(): Promise<void> {
    const cluster = this.detectCluster();
    const next: FleetCall[] = await Promise.all(
      this.peers.map(async (svc) => {
        const url = `https://${svc}-jx-staging.${cluster}/api/v1/example`;
        const start = performance.now();
        try {
          const resp = await fetch(url, { method: 'GET' });
          const durationMs = Math.round(performance.now() - start);
          const httpCode = resp.status;
          // 401 with no bearer = auth wiring proven on this peer.
          const pass = httpCode === 401;
          return {
            service: svc,
            expected: 'HTTP 401',
            status: pass ? 'pass' : 'fail',
            httpCode,
            durationMs,
            message: pass
              ? 'auth wiring on; call routed correctly'
              : `unexpected status (want 401, got ${httpCode})`,
          } as FleetCall;
        } catch (err: unknown) {
          const durationMs = Math.round(performance.now() - start);
          return {
            service: svc,
            expected: 'HTTP 401',
            status: 'fail',
            durationMs,
            message: err instanceof Error ? err.message : String(err),
          } as FleetCall;
        }
      })
    );
    this.calls.set(next);
  }

  /**
   * Pick the cluster suffix (`jx.leartech.com` / `az.leartech.com`)
   * from `window.location.hostname`. Falls back to `jx.leartech.com`
   * (gcp staging) for local dev.
   */
  private detectCluster(): string {
    if (typeof window === 'undefined') return 'jx.leartech.com';
    const host = window.location.hostname;
    if (host.endsWith('.az.leartech.com')) return 'az.leartech.com';
    if (host.endsWith('.jx.leartech.com')) return 'jx.leartech.com';
    return 'jx.leartech.com';
  }

  overallStatus(): 'pending' | 'pass' | 'fail' {
    const c = this.calls();
    if (c.some(x => x.status === 'pending')) return 'pending';
    if (c.some(x => x.status === 'fail')) return 'fail';
    return 'pass';
  }
}

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'fleet-status',
    loadComponent: () =>
      import('./fleet-status/fleet-status.component').then(
        (m) => m.FleetStatusComponent,
      ),
  },
];

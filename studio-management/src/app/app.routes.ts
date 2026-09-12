import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  // TEMP: map harness, removed before commit.
  {
    path: 'dev/ui',
    loadComponent: () => import('./features/dev/dev-ui.component').then((m) => m.DevUiComponent)
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login)
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register)
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'sa/dashboard' },
      {
        path: 'sa/dashboard',
        canActivate: [roleGuard, permissionGuard],
        data: { roles: ['SA'], permission: 'dashboard.sa.view', pageTitle: 'Admin Dashboard' },
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.DashboardComponent)
      },
      {
        path: 'employee/dashboard',
        canActivate: [roleGuard, permissionGuard],
        data: { roles: ['A', 'U'], permission: 'dashboard.self.view', pageTitle: 'Employee Dashboard' },
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.DashboardComponent)
      },
      {
        path: 'sa/tickets',
        canActivate: [roleGuard, permissionGuard],
        data: { roles: ['SA'], permission: 'tickets.viewAll', pageTitle: 'Ticket Management' },
        loadComponent: () =>
          import('./features/tickets/tickets').then((m) => m.TicketsComponent)
      },
      {
        path: 'employee/tickets',
        canActivate: [roleGuard, permissionGuard],
        data: { roles: ['A', 'U'], permission: 'tickets.view', pageTitle: 'My Tickets' },
        loadComponent: () =>
          import('./features/tickets/tickets').then((m) => m.TicketsComponent)
      },
      {
        path: 'sa/users',
        canActivate: [roleGuard, permissionGuard],
        data: { roles: ['SA'], permission: 'users.view', pageTitle: 'User Management' },
        loadComponent: () =>
          import('./features/users/users.component').then((m) => m.UsersComponent)
      },
      {
        path: 'sa/permissions',
        canActivate: [roleGuard, permissionGuard],
        data: { roles: ['SA'], permission: 'users.permissions', pageTitle: 'Permissions' },
        loadComponent: () =>
          import('./features/permissions/permissions.component').then((m) => m.PermissionsComponent)
      },
      {
        path: 'sa/ticket-types',
        canActivate: [roleGuard, permissionGuard],
        data: { roles: ['SA'], permission: 'tickets.types.manage', pageTitle: 'Ticket Types' },
        loadComponent: () =>
          import('./features/ticket-types/ticket-types.component').then(
            (m) => m.TicketTypesComponent
          )
      },
      {
        path: 'sa/comparison',
        canActivate: [roleGuard, permissionGuard],
        data: { roles: ['SA'], permission: 'comparison.view', pageTitle: 'Comparison' },
        loadComponent: () =>
          import('./features/comparison/comparison.component').then((m) => m.ComparisonComponent)
      },
      {
        path: 'employee/account',
        canActivate: [roleGuard, permissionGuard],
        data: { roles: ['A', 'U'], permission: 'amounts.summary.self', pageTitle: 'My Account' },
        loadComponent: () =>
          import('./features/account/account.component').then((m) => m.AccountComponent)
      },
      {
        path: 'sa/clients',
        canActivate: [roleGuard, permissionGuard],
        data: { roles: ['SA'], permission: 'clients.view', pageTitle: 'Client Management' },
        loadComponent: () =>
          import('./features/clients/clients').then((m) => m.ClientsComponent)
      },
      {
        path: 'sa/ip',
        canActivate: [roleGuard, permissionGuard],
        data: { roles: ['SA'], permission: 'security.view', pageTitle: 'IP & Security' },
        loadComponent: () =>
          import('./features/ip/ip.component').then((m) => m.IpComponent)
      },
      {
        path: 'profile',
        canActivate: [permissionGuard],
        data: { permission: 'profile.view', pageTitle: 'Profile' },
        loadComponent: () =>
          import('./features/profile/profile').then((m) => m.ProfileComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'auth/login' }
];

import { UserRole } from '../core/models/user.model';

export type NavIcon =
  | 'grid'
  | 'tasks'
  | 'clients'
  | 'profile'
  | 'wallet'
  | 'shield'
  | 'key'
  | 'versus'
  | 'tags'
  | 'chat';

export interface NavItem {
  label: string;
  /** Shorter label for the bottom tab bar, where space is tight. */
  shortLabel?: string;
  path: string;
  roles: UserRole[];
  icon: NavIcon;
  /** Also hidden unless the user holds this permission (SA always sees it). */
  permission?: string;
  /**
   * Order in the mobile tab bar. The lowest four a user can see become tabs;
   * everything else lands in the "More" sheet. Items without it never appear
   * as a tab.
   */
  tabOrder?: number;
}

/**
 * One nav registry for both shells: the desktop sidebar and the mobile bottom
 * tab bar (see mobile-nav/mobile-nav.component.ts).
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    shortLabel: 'Home',
    path: '/sa/dashboard',
    roles: ['SA'],
    icon: 'grid',
    permission: 'dashboard.sa.view',
    tabOrder: 1
  },
  {
    label: 'Dashboard',
    shortLabel: 'Home',
    path: '/employee/dashboard',
    roles: ['A', 'U'],
    icon: 'grid',
    permission: 'dashboard.self.view',
    tabOrder: 1
  },
  {
    label: 'Tickets',
    path: '/sa/tickets',
    roles: ['SA'],
    icon: 'tasks',
    permission: 'tickets.viewAll',
    tabOrder: 2
  },
  {
    label: 'My Tickets',
    shortLabel: 'Tickets',
    path: '/employee/tickets',
    roles: ['A', 'U'],
    icon: 'tasks',
    permission: 'tickets.view',
    tabOrder: 2
  },
  {
    label: 'My Account',
    shortLabel: 'Account',
    path: '/employee/account',
    roles: ['A', 'U'],
    icon: 'wallet',
    permission: 'amounts.summary.self',
    tabOrder: 3
  },
  {
    label: 'Ticket Types',
    shortLabel: 'Types',
    path: '/sa/ticket-types',
    roles: ['SA'],
    icon: 'tags',
    permission: 'tickets.types.manage'
  },
  {
    label: 'Users',
    path: '/sa/users',
    roles: ['SA'],
    icon: 'clients',
    permission: 'users.view',
    tabOrder: 4
  },
  {
    label: 'Permissions',
    shortLabel: 'Perms',
    path: '/sa/permissions',
    roles: ['SA'],
    icon: 'key',
    permission: 'users.permissions'
  },
  {
    label: 'Comparison',
    shortLabel: 'Compare',
    path: '/sa/comparison',
    roles: ['SA'],
    icon: 'versus',
    permission: 'comparison.view'
  },
  {
    label: 'Clients',
    path: '/sa/clients',
    roles: ['SA'],
    icon: 'clients',
    permission: 'clients.view',
    tabOrder: 3
  },
  {
    label: 'IP & Security',
    shortLabel: 'Security',
    path: '/sa/ip',
    roles: ['SA'],
    icon: 'shield',
    permission: 'security.view'
  },
  {
    label: 'Messages',
    path: '/messages',
    roles: ['SA', 'A', 'U'],
    icon: 'chat'
  },
  {
    label: 'Profile',
    path: '/profile',
    roles: ['SA', 'A', 'U'],
    icon: 'profile',
    permission: 'profile.view',
    tabOrder: 5
  }
];

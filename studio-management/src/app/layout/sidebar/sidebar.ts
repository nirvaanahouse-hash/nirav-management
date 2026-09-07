import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { UserRole } from '../../core/models/user.model';

interface NavItem {
  label: string;
  path: string;
  roles: UserRole[];
  icon: 'grid' | 'tasks' | 'clients' | 'profile' | 'wallet' | 'shield' | 'key' | 'versus';
  /** Also hidden unless the user holds this permission (SA always sees it). */
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/sa/dashboard',
    roles: ['SA'],
    icon: 'grid',
    permission: 'dashboard.sa.view'
  },
  {
    label: 'Dashboard',
    path: '/employee/dashboard',
    roles: ['A', 'U'],
    icon: 'grid',
    permission: 'dashboard.self.view'
  },
  {
    label: 'Tickets',
    path: '/sa/tickets',
    roles: ['SA'],
    icon: 'tasks',
    permission: 'tickets.viewAll'
  },
  {
    label: 'My Tickets',
    path: '/employee/tickets',
    roles: ['A', 'U'],
    icon: 'tasks',
    permission: 'tickets.view'
  },
  {
    label: 'My Account',
    path: '/employee/account',
    roles: ['A', 'U'],
    icon: 'wallet',
    permission: 'amounts.summary.self'
  },
  {
    label: 'Users',
    path: '/sa/users',
    roles: ['SA'],
    icon: 'clients',
    permission: 'users.view'
  },
  {
    label: 'Permissions',
    path: '/sa/permissions',
    roles: ['SA'],
    icon: 'key',
    permission: 'users.permissions'
  },
  {
    label: 'Comparison',
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
    permission: 'clients.view'
  },
  {
    label: 'IP & Security',
    path: '/sa/ip',
    roles: ['SA'],
    icon: 'shield',
    permission: 'security.view'
  },
  {
    label: 'Profile',
    path: '/profile',
    roles: ['SA', 'A', 'U'],
    icon: 'profile',
    permission: 'profile.view'
  }
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Sidebar {

  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  private readonly _collapsed = signal(false);
  private readonly _mobileOpen = signal(false);

  readonly collapsed = this._collapsed.asReadonly();
  readonly mobileOpen = this._mobileOpen.asReadonly();

  readonly items = computed(() => {
    const role = this.authService.role();
    // touch the permission signal so the list re-filters when it loads
    this.permissionService.keys();

    if (!role) {
      return [];
    }

    return NAV_ITEMS.filter(
      (item) =>
        item.roles.includes(role) && this.permissionService.can(item.permission),
    );
  });

  readonly dashboardPath = computed(() => {
    const role = this.authService.role();
    if (role === 'A' || role === 'U') {
      return '/employee/dashboard';
    }
    return '/sa/dashboard';
  });

  toggleCollapsed(): void {
    this._collapsed.update(value => !value);
  }

  toggleMobileMenu(): void {
    this._mobileOpen.update(value => !value);
  }

  closeMobileMenu(): void {
    this._mobileOpen.set(false);
  }

  @HostListener('document:mousedown', ['$event'])
  onOutsideClick(event: MouseEvent): void {

    if (!this.mobileOpen()) {
      return;
    }

    const clickedInside = this.elementRef.nativeElement.contains(
      event.target as Node
    );

    if (!clickedInside) {
      this.closeMobileMenu();
    }
  }

}
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { NAV_ITEMS } from '../nav-items';
import { NavIconComponent } from '../nav-icon.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NavIconComponent],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Sidebar {

  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);

  private readonly _collapsed = signal(false);
  readonly collapsed = this._collapsed.asReadonly();

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

}

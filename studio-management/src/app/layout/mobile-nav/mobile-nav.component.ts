import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { ThemeService } from '../../core/services/theme.service';
import { ProfileService } from '../../core/services/profile.service';
import { NAV_ITEMS, NavItem } from '../nav-items';
import { NavIconComponent } from '../nav-icon.component';

/** How many destinations sit in the bar before the rest move into "More". */
const TAB_SLOTS = 4;

/**
 * The phone shell's primary navigation: a fixed bottom tab bar (the app is
 * shipped as an APK, so this is the main way around), plus a "More" sheet for
 * whatever does not fit. Hidden from 769px up, where the sidebar takes over.
 */
@Component({
  selector: 'app-mobile-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NavIconComponent],
  templateUrl: './mobile-nav.component.html',
  styleUrl: './mobile-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileNavComponent {
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.currentUser;
  readonly sheetOpen = signal(false);

  /** Everything this user may open, in sidebar order. */
  private readonly visible = computed<NavItem[]>(() => {
    const role = this.auth.role();
    // touch the permission signal so the list re-filters once it loads
    this.permissions.keys();
    if (!role) return [];
    return NAV_ITEMS.filter(
      (item) => item.roles.includes(role) && this.permissions.can(item.permission),
    );
  });

  /** The bar itself: the lowest `tabOrder` destinations this user can see. */
  readonly tabs = computed(() =>
    this.visible()
      .filter((i) => i.tabOrder !== undefined)
      .sort((a, b) => (a.tabOrder ?? 99) - (b.tabOrder ?? 99))
      .slice(0, TAB_SLOTS),
  );

  /** What "More" holds — everything the bar could not fit. */
  readonly overflow = computed(() => {
    const inBar = new Set(this.tabs().map((t) => t.path));
    return this.visible().filter((i) => !inBar.has(i.path));
  });

  readonly hasOverflow = computed(() => this.overflow().length > 0);

  label(item: NavItem): string {
    return item.shortLabel ?? item.label;
  }

  openSheet(): void {
    this.sheetOpen.set(true);
  }

  closeSheet(): void {
    this.sheetOpen.set(false);
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  cycleTheme(): void {
    const options = this.theme.options;
    const current = this.theme.activeTheme();
    const next = options[(options.findIndex((o) => o.id === current) + 1) % options.length];
    this.theme.setTheme(next.id);
  }

  logout(): void {
    this.closeSheet();
    this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.profile.clear();
      this.router.navigate(['/auth/login']);
    });
  }
}

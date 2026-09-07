import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

import { PermissionService } from '../../core/services/permission.service';
import { UserService } from '../../core/services/user.service';
import { User } from '../../core/models/user.model';
import { PermissionGroup } from '../../core/constants/permissions';
import { DEFAULT_USER_PERMISSIONS } from '../../core/constants/permissions';
import { ToastService } from '../../features/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../shared/components/button/button';

type GroupState = 'all' | 'some' | 'none';

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, ButtonComponent],
  templateUrl: './permissions.component.html',
  styleUrls: ['./permissions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionsComponent {
  private readonly permissions = inject(PermissionService);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly defaultKeys = DEFAULT_USER_PERMISSIONS;
  private readonly defaultSet = new Set(DEFAULT_USER_PERMISSIONS);

  readonly loading = signal(true);
  readonly groups = signal<PermissionGroup[]>([]);
  readonly users = signal<User[]>([]);
  userSearch = '';

  readonly selectedUser = signal<User | null>(null);
  readonly targetIsSA = signal(false);
  readonly permLoading = signal(false);
  readonly saving = signal(false);

  readonly selected = signal<Set<string>>(new Set());
  private original = new Set<string>();
  readonly expanded = signal<Set<string>>(new Set());

  readonly filteredUsers = computed(() => {
    const q = this.userSearch.trim().toLowerCase();
    const list = [...this.users()].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    );
    if (!q) return list;
    return list.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.userName} ${u.email ?? ''}`.toLowerCase().includes(q),
    );
  });

  readonly dirty = computed(() => {
    const s = this.selected();
    if (s.size !== this.original.size) return true;
    for (const k of s) if (!this.original.has(k)) return true;
    return false;
  });

  readonly totalGranted = computed(() => this.selected().size);
  readonly totalPossible = computed(
    () => this.groups().reduce((n, g) => n + g.permissions.length, 0),
  );

  constructor() {
    forkJoin({
      reg: this.permissions.getRegistry(),
      users: this.userService.list(),
    }).subscribe({
      next: ({ reg, users }) => {
        this.groups.set(reg.data.groups);
        this.expanded.set(new Set(reg.data.groups.map((g) => g.key)));
        this.users.set(users.data || []);
        this.loading.set(false);

        const wanted = this.route.snapshot.queryParamMap.get('user');
        if (wanted) {
          const u = this.users().find((x) => x._id === wanted);
          if (u) this.selectUser(u);
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load permissions');
      },
    });
  }

  selectUser(user: User): void {
    this.selectedUser.set(user);
    this.permLoading.set(true);
    this.targetIsSA.set(user.role === 'SA');
    this.permissions.getUserPermissions(user._id).subscribe({
      next: (res) => {
        this.targetIsSA.set(res.data.isSuperAdmin);
        this.original = new Set(res.data.permissions);
        this.selected.set(new Set(res.data.permissions));
        this.permLoading.set(false);
      },
      error: () => {
        this.permLoading.set(false);
        this.toast.error('Could not load this user’s permissions');
      },
    });
  }

  // ---- tree state ----
  isExpanded(groupKey: string): boolean {
    return this.expanded().has(groupKey);
  }

  toggleExpand(groupKey: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
      return next;
    });
  }

  isChecked(key: string): boolean {
    return this.selected().has(key);
  }

  isDefault(key: string): boolean {
    return this.defaultSet.has(key);
  }

  groupState(group: PermissionGroup): GroupState {
    const sel = this.selected();
    const on = group.permissions.filter((p) => sel.has(p.key)).length;
    if (on === 0) return 'none';
    if (on === group.permissions.length) return 'all';
    return 'some';
  }

  groupCountLabel(group: PermissionGroup): string {
    const sel = this.selected();
    const on = group.permissions.filter((p) => sel.has(p.key)).length;
    return `${on} / ${group.permissions.length}`;
  }

  toggleKey(key: string): void {
    this.selected.update((set) => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  toggleGroup(group: PermissionGroup): void {
    const state = this.groupState(group);
    this.selected.update((set) => {
      const next = new Set(set);
      if (state === 'all') {
        group.permissions.forEach((p) => next.delete(p.key));
      } else {
        group.permissions.forEach((p) => next.add(p.key));
      }
      return next;
    });
  }

  // ---- bulk actions ----
  selectAll(): void {
    const next = new Set<string>();
    this.groups().forEach((g) => g.permissions.forEach((p) => next.add(p.key)));
    this.selected.set(next);
  }

  clearAll(): void {
    this.selected.set(new Set());
  }

  resetToDefault(): void {
    this.selected.set(new Set(DEFAULT_USER_PERMISSIONS));
  }

  save(): void {
    const user = this.selectedUser();
    if (!user || this.targetIsSA()) return;
    this.saving.set(true);
    const keys = [...this.selected()];
    this.permissions.setUserPermissions(user._id, keys).subscribe({
      next: (res) => {
        this.original = new Set(res.data.permissions);
        this.selected.set(new Set(res.data.permissions));
        this.saving.set(false);
        this.toast.success('Permissions saved', `${user.firstName} ${user.lastName}`);
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.toast.error('Could not save permissions', err?.error?.message);
      },
    });
  }

  roleBadge(role: string): string {
    if (role === 'SA') return 'badge--danger';
    if (role === 'A') return 'badge--warning';
    return 'badge--neutral';
  }

  roleLabel(role: string): string {
    return role === 'SA' ? 'Super Admin' : role === 'A' ? 'Admin' : 'Employee';
  }

  trackUser = (_i: number, u: User) => u._id;
  trackGroup = (_i: number, g: PermissionGroup) => g.key;
  trackPerm = (_i: number, p: { key: string }) => p.key;
}

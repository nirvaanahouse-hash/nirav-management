import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { SocketService, NotificationData } from '../../core/services/socket.service';
import { ThemeService } from '../../core/services/theme.service';
import { ProfileService } from '../../core/services/profile.service';
import { BackupService } from '../../core/services/backup.service';
import { ThemeId } from '../../core/models/theme.model';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { NAV_ITEMS, NavIcon } from '../nav-items';
import { NavIconComponent } from '../nav-icon.component';
import { RemoteImageDirective } from '../../core/directives/remote-image.directive';
import { ConfirmDialogService } from '../../features/dialog/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../features/toast/toast.service';

type NotifTab = 'all' | 'unread';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CheckboxComponent, NavIconComponent, RemoteImageDirective],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Navbar {
  private readonly _userMenuOpen = signal(false);
  private readonly _notificationMenuOpen = signal(false);
  private readonly _pageTitle = signal('');
  private readonly _pageIcon = signal<NavIcon>('grid');

  readonly userMenuOpen = this._userMenuOpen.asReadonly();
  readonly notificationMenuOpen = this._notificationMenuOpen.asReadonly();
  readonly pageTitle = this._pageTitle.asReadonly();
  readonly pageIcon = this._pageIcon.asReadonly();

  readonly notifTab = signal<NotifTab>('all');
  readonly showDeleted = signal(false);

  readonly profileService = inject(ProfileService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly backupService = inject(BackupService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);

  readonly backupRunning = signal(false);
  readonly restoreRunning = signal(false);

  constructor(
    readonly authService: AuthService,
    readonly socketService: SocketService,
    readonly themeService: ThemeService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.updatePageTitle();
        this._notificationMenuOpen.set(false);
        this._userMenuOpen.set(false);
      });
    this.updatePageTitle();

    if (this.authService.isAuthenticated()) {
      this.profileService.getProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
    }
  }

  private updatePageTitle(): void {
    let snapshot = this.router.routerState.snapshot.root;
    while (snapshot.firstChild) {
      snapshot = snapshot.firstChild;
    }
    const title = snapshot.data['pageTitle'] as string | undefined;
    this._pageTitle.set(title ?? 'Studio');

    const url = this.router.url.split('?')[0].split('#')[0];
    const match = NAV_ITEMS.find((item) => url === item.path || url.startsWith(item.path + '/'));
    this._pageIcon.set(match?.icon ?? 'grid');
  }

  toggleUserMenu(): void {
    this._notificationMenuOpen.set(false);
    this._userMenuOpen.update((value) => !value);
  }

  toggleNotificationMenu(): void {
    this._userMenuOpen.set(false);
    const opening = !this._notificationMenuOpen();
    this._notificationMenuOpen.set(opening);
    if (opening) {
      this.socketService.loadNotifications(this.notifTab(), this.showDeleted());
    }
  }

  toggleTheme(): void {
    const next: ThemeId = this.themeService.activeTheme() === 'dark' ? 'light' : 'dark';
    this.themeService.setTheme(next);
  }

  // --- Notifications -------------------------------------------------------
  setNotifTab(tab: NotifTab): void {
    if (this.notifTab() === tab) return;
    this.notifTab.set(tab);
    this.socketService.loadNotifications(tab, this.showDeleted());
  }

  setShowDeleted(value: boolean): void {
    this.showDeleted.set(value);
    this.socketService.loadNotifications(this.notifTab(), value);
  }

  toggleNotificationRead(notif: NotificationData): void {
    this.socketService.toggleNotificationRead(notif._id);
  }

  deleteNotification(notif: NotificationData): void {
    this.socketService.deleteNotification(notif._id);
  }

  restoreNotification(notif: NotificationData): void {
    this.socketService.restoreNotification(notif._id);
  }

  markAllNotificationsRead(): void {
    this.socketService.markAllNotificationsRead();
  }

  closeMenus(): void {
    this._userMenuOpen.set(false);
    this._notificationMenuOpen.set(false);
  }

  private anyMenuOpen(): boolean {
    return this._userMenuOpen() || this._notificationMenuOpen();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.anyMenuOpen()) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeMenus();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.anyMenuOpen()) this.closeMenus();
  }

  formatNotificationTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  async runBackup(): Promise<void> {
    if (this.backupRunning()) return;

    const confirmed = await this.confirmDialogService.ask({
      title: 'Back up database?',
      message: 'This takes a full snapshot of the database, downloads it to this device, and uploads it to Google Drive if that\'s set up. It may take a moment.',
      confirmLabel: 'Back up now',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    this.backupRunning.set(true);
    this.backupService
      .run()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.backupRunning.set(false);
          const blob = res.body;
          if (blob) this.downloadBlob(blob, `nirvaana-backup-${new Date().toISOString().slice(0, 10)}.gz`);

          const driveStatus = res.headers.get('X-Drive-Status') || '';
          if (driveStatus === 'uploaded') {
            this.toastService.success('Backup complete', 'Downloaded, and uploaded to Google Drive.');
          } else if (driveStatus.startsWith('failed')) {
            this.toastService.error('Backup downloaded', `Drive upload failed: ${driveStatus.slice(8)}`);
          } else {
            this.toastService.success('Backup downloaded', "Google Drive isn't set up yet — upload it yourself for now.");
          }
        },
        error: async (err) => {
          this.backupRunning.set(false);
          this.toastService.error('Backup failed', await this.readBlobErrorMessage(err));
        },
      });
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async onRestoreFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // lets the same file be re-picked later
    if (!file || this.restoreRunning()) return;

    const confirmed = await this.confirmDialogService.ask({
      title: 'Restore from backup?',
      message: `Import "${file.name}" into the database. Existing records are never overwritten — only records that don't already exist get added. This may take a moment.`,
      confirmLabel: 'Restore now',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    this.restoreRunning.set(true);
    this.backupService
      .restore(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.restoreRunning.set(false);
          this.toastService.success('Restore complete', res.message);
        },
        error: (err) => {
          this.restoreRunning.set(false);
          this.toastService.error('Restore failed', err?.error?.message || 'Please try again.');
        },
      });
  }

  // responseType: 'blob' means a JSON error body arrives as a Blob too, not
  // a parsed object — read it back out as text ourselves.
  private async readBlobErrorMessage(err: { error?: Blob }): Promise<string> {
    try {
      if (err.error instanceof Blob) {
        const parsed = JSON.parse(await err.error.text());
        if (parsed?.message) return parsed.message;
      }
    } catch {
      // fall through to the generic message below
    }
    return 'Please try again.';
  }

  logout(): void {
    this.authService.logout().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.profileService.clear();
      this.router.navigate(['/auth/login']);
    });
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}

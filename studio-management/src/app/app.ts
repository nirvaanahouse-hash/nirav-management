import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { PermissionService } from './core/services/permission.service';
import { ToastContainerComponent } from './features/toast/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly permissions = inject(PermissionService);

  constructor(private readonly themeService: ThemeService) {
    // Refresh permissions for an already-restored session (no re-login needed).
    this.permissions.refreshMe();
  }
}

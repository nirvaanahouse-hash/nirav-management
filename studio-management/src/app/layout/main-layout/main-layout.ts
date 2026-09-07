import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Navbar } from '../navbar/navbar';
import { ConfirmDialogHostComponent } from '../../features/dialog/confirm-dialog/confirm-dialog-host.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Navbar, ConfirmDialogHostComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayout {
  @ViewChild(Sidebar) sidebar!: Sidebar;

  toggleMobileMenu(): void {
    this.sidebar.toggleMobileMenu();
  }
}

import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Sidebar } from '../sidebar/sidebar';
import { Navbar } from '../navbar/navbar';
import { ConfirmDialogHostComponent } from '../../features/dialog/confirm-dialog/confirm-dialog-host.component';
import { MobileNavComponent } from '../mobile-nav/mobile-nav.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Navbar, MobileNavComponent, ConfirmDialogHostComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayout {
  @ViewChild('pageScroll') private pageScroll?: ElementRef<HTMLElement>;

  private readonly router = inject(Router);

  constructor() {
    // The scroll container is a persistent DOM element, so it keeps its
    // scrollTop across navigations — reset it to the top on every page change.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.pageScroll?.nativeElement.scrollTo({ top: 0 }));
  }
}

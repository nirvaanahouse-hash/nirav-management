import { Component, inject, signal } from '@angular/core';
import { MapComponent } from '../../shared/components/map/map.component';
import { ModalComponent } from '../dialog/modal.component';
import { ButtonComponent } from '../../shared/components/button/button';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-dev-ui',
  standalone: true,
  imports: [MapComponent, ModalComponent, ButtonComponent],
  template: `
    <div class="main-layout">
      <div class="main-layout__content">
        <header class="navbar" style="display:flex;align-items:center;padding:0 16px;">
          <strong>Map</strong>
        </header>
        <main class="main-layout__page">
          <div class="main-layout__outlet" style="display:grid;gap:16px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              @for (t of theme.options; track t.id) {
                <button type="button" [attr.data-theme-btn]="t.id" (click)="theme.setTheme(t.id)" style="padding:8px 12px;">
                  {{ t.label }}
                </button>
              }
            </div>

            <!-- same frame the users dialog uses -->
            <div class="users-loc__map" id="map-frame">
              <app-map [lat]="21.17024" [lng]="72.83106" [accuracy]="35" label="Nirav Kanani" />
            </div>

            <app-button (clicked)="open.set(true)">Open in a dialog</app-button>
            <div style="height:500px"></div>

            @if (open()) {
              <app-modal title="Live location — Nirav Kanani" [maxWidth]="560" (close)="open.set(false)">
                <div class="users-loc">
                  <div class="users-loc__map">
                    <app-map [lat]="21.17024" [lng]="72.83106" [accuracy]="35" label="Nirav" />
                  </div>
                </div>
                <ng-container modal-footer>
                  <app-button variant="secondary" (clicked)="open.set(false)">Close</app-button>
                  <app-button>Refresh</app-button>
                </ng-container>
              </app-modal>
            }
          </div>
        </main>
      </div>
      <nav class="mnav" id="tabbar">
        @for (t of tabs; track t) { <span class="mnav__tab"><span class="mnav__label">{{ t }}</span></span> }
      </nav>
    </div>
  `,
  styleUrls: [
    '../../layout/main-layout/main-layout.scss',
    '../../layout/navbar/navbar.scss',
    '../../layout/mobile-nav/mobile-nav.component.scss',
    '../users/users.component.scss',
  ],
  styles: [':host { display: block !important; }'],
})
export class DevUiComponent {
  readonly theme = inject(ThemeService);
  readonly open = signal(false);
  readonly tabs = ['Home', 'Tickets', 'Clients', 'Users', 'More'];
}

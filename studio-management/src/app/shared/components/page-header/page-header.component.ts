import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * Consistent page heading: title + optional subtitle on the left,
 * an optional actions slot on the right. Project it with
 * `<span actions>…</span>` (usually an `app-button`).
 */
@Component({
  selector: "app-page-header",
  standalone: true,
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <h2 class="page-header__title">{{ title() }}</h2>
        @if (subtitle()) {
          <p class="page-header__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
  styleUrl: "./page-header.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  title = input.required<string>();
  subtitle = input<string>("");
}

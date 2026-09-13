import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * Kept only for the page's description + actions row — the page's name/icon
 * now lives solely in the navbar (see layout/navbar), so it isn't repeated
 * here. `title` stays as an accessible label for the section. Project a
 * subtitle via the `subtitle` input and actions with `<span actions>…</span>`
 * (usually an `app-button`).
 */
@Component({
  selector: "app-page-header",
  standalone: true,
  template: `
    <header class="page-header" [attr.aria-label]="title()">
      @if (subtitle()) {
        <p class="page-header__subtitle">{{ subtitle() }}</p>
      }
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

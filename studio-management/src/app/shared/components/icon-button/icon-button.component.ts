import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

/**
 * Compact square icon action button for table rows and toolbars.
 * Project a single inline SVG; sizing and alignment are handled here.
 */
@Component({
  selector: "app-icon-button",
  standalone: true,
  template: `
    <button
      type="button"
      class="icon-button"
      [class.icon-button--danger]="variant() === 'danger'"
      [class.icon-button--confirm]="variant() === 'confirm'"
      [disabled]="disabled()"
      [attr.title]="label()"
      [attr.aria-label]="label()"
      (click)="clicked.emit($event)"
    >
      <ng-content />
    </button>
  `,
  styleUrl: "./icon-button.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconButtonComponent {
  label = input<string>("");
  variant = input<"default" | "danger" | "confirm">("default");
  disabled = input(false);
  clicked = output<MouseEvent>();
}

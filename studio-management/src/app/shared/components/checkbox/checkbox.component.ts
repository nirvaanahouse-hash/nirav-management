import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Themed checkbox. The native box can't be restyled past `accent-color`, so
 * the real input is kept for semantics and focus, and the visible box is drawn
 * next to it from theme tokens.
 *
 * The label is projected, so it can hold markup:
 *   <app-checkbox [(ngModel)]="x">Show inactive</app-checkbox>
 */
@Component({
  selector: 'app-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="cbx" [class.cbx--disabled]="disabled()">
      <input
        type="checkbox"
        class="cbx__native"
        [checked]="isOn()"
        [indeterminate]="indeterminate()"
        [disabled]="disabled()"
        [attr.aria-label]="ariaLabel() || null"
        (change)="onToggle($event)"
        (blur)="onTouched()"
      />
      <span class="cbx__box" [class.cbx__box--mixed]="indeterminate()" aria-hidden="true">
        @if (indeterminate()) {
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
            <path d="M3.5 8h9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
          </svg>
        } @else {
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
            <path
              d="M3 8.5l3.2 3.2L13 5"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        }
      </span>
      <span class="cbx__label"><ng-content /></span>
    </label>
  `,
  styleUrl: './checkbox.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
})
export class CheckboxComponent implements ControlValueAccessor {
  ariaLabel = input('');
  /**
   * Drive the box from outside instead of a form control — for the places that
   * already track state themselves and just listen to (changed).
   */
  checked = input<boolean | undefined>(undefined);
  /** Half-state, e.g. a permission group where only some rows are on. */
  indeterminate = input(false);

  readonly changed = output<boolean>();

  private readonly state = signal(false);
  readonly disabled = signal(false);

  /** An explicit [checked] wins; otherwise the form control's value is used. */
  readonly isOn = computed(() => this.checked() ?? this.state());

  private onChangeFn: (value: boolean) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: unknown): void {
    this.state.set(value === true || value === 'true');
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onToggle(event: Event): void {
    const next = (event.target as HTMLInputElement).checked;
    this.state.set(next);
    this.onChangeFn(next);
    this.changed.emit(next);
  }
}

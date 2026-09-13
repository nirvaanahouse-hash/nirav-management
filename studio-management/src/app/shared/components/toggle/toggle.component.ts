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
 * Themed on/off switch — the one shared toggle for the whole app (previously
 * every page that needed one hand-rolled its own track/thumb markup at a
 * different size). The label is projected, so it can hold rich content:
 *   <app-toggle [(ngModel)]="x">
 *     Share my location
 *     <small>On — updates every couple of minutes.</small>
 *   </app-toggle>
 */
@Component({
  selector: 'app-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="tgl" [class.tgl--disabled]="disabled()">
      <input
        type="checkbox"
        class="tgl__native"
        role="switch"
        [checked]="isOn()"
        [disabled]="disabled()"
        [attr.aria-label]="ariaLabel() || null"
        (change)="onToggle($event)"
        (blur)="onTouched()"
      />
      <span class="tgl__track" aria-hidden="true"><span class="tgl__thumb"></span></span>
      <span class="tgl__label"><ng-content /></span>
    </label>
  `,
  styleUrl: './toggle.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ToggleComponent),
      multi: true,
    },
  ],
})
export class ToggleComponent implements ControlValueAccessor {
  ariaLabel = input('');
  /**
   * Drive the switch from outside instead of a form control — for the places
   * that already track state themselves and just listen to (changed).
   */
  checked = input<boolean | undefined>(undefined);
  /** Same idea as [checked] — an explicit override for non-form usage. */
  disabledInput = input(false, { alias: 'disabled' });

  readonly changed = output<boolean>();

  private readonly state = signal(false);
  private readonly formDisabled = signal(false);

  /** An explicit [checked] wins; otherwise the form control's value is used. */
  readonly isOn = computed(() => this.checked() ?? this.state());
  readonly disabled = computed(() => this.disabledInput() || this.formDisabled());

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
    this.formDisabled.set(isDisabled);
  }

  onToggle(event: Event): void {
    const next = (event.target as HTMLInputElement).checked;
    this.state.set(next);
    this.onChangeFn(next);
    this.changed.emit(next);
  }
}

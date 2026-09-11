import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent } from '../select/select.component';
import { DatepickerComponent } from '../datepicker/datepicker.component';
import { CheckboxComponent } from '../checkbox/checkbox.component';

/**
 * Reusable labeled form field. Wraps a Reactive Forms control, shows
 * validation errors automatically, and keeps every form in the app
 * visually consistent (label, hint, error state, required marker).
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [ReactiveFormsModule, SelectComponent, DatepickerComponent, CheckboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl:'./form-field.component.html',
  styleUrl: './form-field.component.scss',
})
export class FormFieldComponent {
  label = input.required<string>();
  control = input.required<FormControl>();
  type = input<
    'text' | 'email' | 'number' | 'password' | 'textarea' | 'select' | 'date' | 'time' | 'checkbox'
  >('text');
  placeholder = input<string>('');
  hint = input<string>('');
  required = input(false);
  options = input<{ value: string; label: string; disabled?: boolean; hint?: string }[]>([]);
  /** Select only — lets the field hold several values (value becomes string[]). */
  multiple = input(false);
  /** Date only — both are yyyy-MM-dd. */
  min = input('');
  max = input('');
  errorMessages = input<Record<string, string>>({});
  readonly = input(false);

  showError(): boolean {
    const c = this.control();
    return c.invalid && (c.dirty || c.touched);
  }

  errorMessage(): string {
    const errors = this.control().errors;
    if (!errors) return '';
    const key = Object.keys(errors)[0];
    return this.errorMessages()[key] ?? this.defaultMessage(key, errors[key]);
  }

  private defaultMessage(key: string, err: unknown): string {
    switch (key) {
      case 'required':
        return `${this.label()} is required.`;
      case 'email':
        return 'Enter a valid email address.';
      case 'minlength':
        return `Must be at least ${(err as { requiredLength: number }).requiredLength} characters.`;
      case 'maxlength':
        return `Must be at most ${(err as { requiredLength: number }).requiredLength} characters.`;
      case 'pattern':
        return `${this.label()} format is invalid.`;
      case 'min':
        return `Must be at least ${(err as { min: number }).min}.`;
      case 'max':
        return `Must be at most ${(err as { max: number }).max}.`;
      case 'passwordMismatch':
        return `Passwords do not match.`;
      default:
        return `${this.label()} is invalid.`;
    }
  }
}

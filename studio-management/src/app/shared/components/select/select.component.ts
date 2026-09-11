import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { PopoverDirective } from '../../directives/popover.directive';
import { SelectItem, SelectValue } from './select.model';

/**
 * Themed replacement for the native <select>. The browser's own dropdown can't
 * be styled, so this renders its own listbox: a popover on a desktop, a bottom
 * sheet on a phone.
 *
 * Works with both reactive forms and ngModel (it is a ControlValueAccessor).
 * Set `multiple` to let it hold several values — in that mode the control value
 * is a string[] and the list stays open while you pick.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PopoverDirective],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
  host: { class: 'sel' },
})
export class SelectComponent implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  options = input<SelectItem[]>([]);
  placeholder = input('Select…');
  /** Hold several values. The control value becomes a string[]. */
  multiple = input(false);
  invalid = input(false);
  ariaLabel = input('');
  /** Shown above the list on a phone, where the sheet has no field label. */
  sheetTitle = input('');

  readonly opened = output<void>();

  readonly isOpen = signal(false);
  readonly disabled = signal(false);
  /** Keyboard cursor — which row Enter would choose. */
  readonly activeIndex = signal(-1);

  private readonly selected = signal<string[]>([]);

  private onChange: (value: SelectValue) => void = () => {};
  private onTouched: () => void = () => {};

  /** Options that can actually be chosen, in display order. */
  readonly rows = computed(() => this.options());

  readonly selectedValues = this.selected.asReadonly();

  readonly selectedLabels = computed(() => {
    const chosen = new Set(this.selected());
    return this.options()
      .filter((o) => chosen.has(o.value))
      .map((o) => o.label);
  });

  /** What the closed trigger shows. */
  readonly triggerText = computed(() => {
    const labels = this.selectedLabels();
    if (!labels.length) return this.placeholder();
    if (!this.multiple()) return labels[0];
    return labels.length === 1 ? labels[0] : `${labels.length} selected`;
  });

  readonly hasValue = computed(() => this.selectedLabels().length > 0);

  // --- ControlValueAccessor ------------------------------------------------

  writeValue(value: SelectValue): void {
    if (Array.isArray(value)) {
      this.selected.set(value.map(String).filter((v) => v !== ''));
    } else if (value === null || value === undefined || value === '') {
      this.selected.set([]);
    } else {
      this.selected.set([String(value)]);
    }
  }

  registerOnChange(fn: (value: SelectValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    if (isDisabled) this.close();
  }

  // --- Opening / closing ---------------------------------------------------

  toggle(): void {
    this.isOpen() ? this.close() : this.open();
  }

  open(): void {
    if (this.disabled()) return;
    this.isOpen.set(true);
    // Start the cursor on the first selected row, else the first row.
    const rows = this.rows();
    const first = rows.findIndex((o) => this.isSelected(o.value));
    this.activeIndex.set(first >= 0 ? first : rows.findIndex((o) => !o.disabled));
    this.opened.emit();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.activeIndex.set(-1);
    this.onTouched();
  }

  // --- Choosing ------------------------------------------------------------

  isSelected(value: string): boolean {
    return this.selected().includes(value);
  }

  pick(option: SelectItem): void {
    if (option.disabled) return;

    if (this.multiple()) {
      const next = this.isSelected(option.value)
        ? this.selected().filter((v) => v !== option.value)
        : [...this.selected(), option.value];
      this.selected.set(next);
      this.onChange(next);
      return; // the list stays open so more can be picked
    }

    this.selected.set([option.value]);
    this.onChange(option.value);
    this.close();
  }

  clear(event: Event): void {
    event.stopPropagation();
    this.selected.set([]);
    this.onChange(this.multiple() ? [] : '');
  }

  // --- Keyboard ------------------------------------------------------------

  onTriggerKeydown(event: KeyboardEvent): void {
    const key = event.key;

    if (!this.isOpen()) {
      if (key === 'Enter' || key === ' ' || key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault();
        this.open();
      }
      return;
    }

    switch (key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.step(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.step(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.activeIndex.set(this.rows().findIndex((o) => !o.disabled));
        break;
      case 'End':
        event.preventDefault();
        this.activeIndex.set(this.lastEnabledIndex());
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const option = this.rows()[this.activeIndex()];
        if (option) this.pick(option);
        break;
      }
      case 'Tab':
        this.close();
        break;
      default:
        if (key.length === 1) this.typeahead(key);
    }
  }

  private step(delta: number): void {
    const rows = this.rows();
    if (!rows.length) return;
    let i = this.activeIndex();
    for (let n = 0; n < rows.length; n++) {
      i = (i + delta + rows.length) % rows.length;
      if (!rows[i].disabled) break;
    }
    this.activeIndex.set(i);
  }

  private lastEnabledIndex(): number {
    const rows = this.rows();
    for (let i = rows.length - 1; i >= 0; i--) if (!rows[i].disabled) return i;
    return -1;
  }

  /** Jump to the next row starting with the typed letter. */
  private typeahead(char: string): void {
    const rows = this.rows();
    const lower = char.toLowerCase();
    const start = this.activeIndex() + 1;
    for (let n = 0; n < rows.length; n++) {
      const i = (start + n) % rows.length;
      if (!rows[i].disabled && rows[i].label.toLowerCase().startsWith(lower)) {
        this.activeIndex.set(i);
        return;
      }
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentDown(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const target = event.target as HTMLElement;
    // The panel is portalled to <body>, so it is no longer inside the host.
    const insidePanel = !!target.closest?.('[data-popover]');
    if (!insidePanel && !this.elementRef.nativeElement.contains(target)) this.close();
  }
}

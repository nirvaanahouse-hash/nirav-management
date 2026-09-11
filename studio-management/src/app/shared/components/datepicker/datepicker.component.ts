import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { PopoverDirective } from '../../directives/popover.directive';

interface DayCell {
  /** ISO yyyy-MM-dd — also what the control stores. */
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  disabled: boolean;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Local yyyy-MM-dd — never via toISOString(), which shifts across timezones. */
function toIso(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function fromIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Themed date field. The native date input renders a browser-specific control
 * that can't be themed, so this draws its own month grid — a popover on a
 * desktop, a bottom sheet on a phone.
 *
 * The control value stays a `yyyy-MM-dd` string, which is what the API already
 * stores, so it drops in wherever `type="date"` was used.
 */
@Component({
  selector: 'app-datepicker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PopoverDirective],
  templateUrl: './datepicker.component.html',
  styleUrl: './datepicker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatepickerComponent),
      multi: true,
    },
  ],
  host: { class: 'dp' },
})
export class DatepickerComponent implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  placeholder = input('Select a date');
  /** Both are yyyy-MM-dd, matching the value format. */
  min = input('');
  max = input('');
  invalid = input(false);
  ariaLabel = input('');

  readonly weekdays = WEEKDAYS;
  readonly isOpen = signal(false);
  readonly disabled = signal(false);

  private readonly value = signal('');
  /** First of the month currently on screen. */
  private readonly cursor = signal(this.startOfMonth(new Date()));

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  readonly selected = this.value.asReadonly();

  readonly triggerText = computed(() => {
    const date = fromIso(this.value());
    if (!date) return this.placeholder();
    return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
  });

  readonly hasValue = computed(() => !!fromIso(this.value()));

  readonly monthLabel = computed(() => {
    const c = this.cursor();
    return `${MONTHS[c.getMonth()]} ${c.getFullYear()}`;
  });

  /** Six weeks of cells, Monday-first, so the grid never reflows. */
  readonly weeks = computed<DayCell[][]>(() => {
    const first = this.cursor();
    const todayIso = toIso(new Date());
    const selectedIso = this.value();

    // getDay(): 0 = Sunday. Shift so Monday starts the week.
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - lead);

    const weeks: DayCell[][] = [];
    const cursor = new Date(start);

    for (let w = 0; w < 6; w++) {
      const row: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const iso = toIso(cursor);
        row.push({
          iso,
          day: cursor.getDate(),
          inMonth: cursor.getMonth() === first.getMonth(),
          isToday: iso === todayIso,
          disabled: this.outOfRange(iso),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(row);
    }

    void selectedIso; // selection is read per-cell by isSelected()
    return weeks;
  });

  // --- ControlValueAccessor ------------------------------------------------

  writeValue(value: unknown): void {
    const iso = typeof value === 'string' ? value.slice(0, 10) : '';
    this.value.set(fromIso(iso) ? iso : '');
    const date = fromIso(this.value());
    if (date) this.cursor.set(this.startOfMonth(date));
  }

  registerOnChange(fn: (value: string) => void): void {
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
    const date = fromIso(this.value()) ?? new Date();
    this.cursor.set(this.startOfMonth(date));
    this.isOpen.set(true);
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.onTouched();
  }

  // --- Picking -------------------------------------------------------------

  isSelected(iso: string): boolean {
    return this.value() === iso;
  }

  pick(cell: DayCell): void {
    if (cell.disabled) return;
    this.value.set(cell.iso);
    this.onChange(cell.iso);
    this.close();
  }

  today(): void {
    const iso = toIso(new Date());
    if (this.outOfRange(iso)) return;
    this.value.set(iso);
    this.onChange(iso);
    this.close();
  }

  clear(): void {
    this.value.set('');
    this.onChange('');
    this.close();
  }

  shiftMonth(delta: number): void {
    const c = this.cursor();
    this.cursor.set(new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.open();
    } else if (event.key === 'Escape') {
      this.close();
    }
  }

  private outOfRange(iso: string): boolean {
    const min = this.min();
    const max = this.max();
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentDown(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const target = event.target as HTMLElement;
    // The panel is portalled to <body>, so it is no longer inside the host.
    if (target.closest?.('[data-popover]')) return;
    if (!this.elementRef.nativeElement.contains(target)) this.close();
  }
}

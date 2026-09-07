import { ChangeDetectionStrategy, Component, computed, input, output, signal, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TableColumn, SortState } from './table.model';

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table.html',
  styleUrl: './table.scss',
})
export class TableComponent<T> {
  columns = input.required<TableColumn<T>[]>();
  rows = input.required<T[]>();
  pageSize = input<number>(10);
  emptyMessage = input<string>('No records found.');
  hasActions = input<boolean>(false);
  rowActionsTemplate = input<TemplateRef<{ $implicit: T }> | null>(null);
  trackByFn = input<(row: T) => unknown>((row: T) => row);

  sortChange = output<SortState<T>>();

  private readonly _page = signal(1);
  page = this._page.asReadonly();

  private readonly _sort = signal<SortState<T>>({ key: null, direction: null });
  sort = this._sort.asReadonly();

  sortedRows = computed<T[]>(() => {
    const { key, direction } = this._sort();
    const list = this.rows();
    if (!key || !direction) return list;
    return [...list].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null || bv == null) return 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        return direction === 'asc' ? av - bv : bv - av;
      }
      return direction === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.sortedRows().length / this.pageSize())));
  startIndex = computed(() => (this.page() - 1) * this.pageSize());
  endIndex = computed(() => Math.min(this.startIndex() + this.pageSize(), this.rows().length));
  pagedRows = computed(() => this.sortedRows().slice(this.startIndex(), this.startIndex() + this.pageSize()));


  /** Cell text with a "-" fallback for null / undefined / empty values. */
  cellText(col: TableColumn<T>, row: T): string {
    const raw = col.format ? col.format(row) : (row[col.key] as unknown);
    if (raw === null || raw === undefined || raw === "") return "-";
    return String(raw);
  }

  toggleSort(key: keyof T & string): void {
    const current = this._sort();
    if (current.key !== key) {
      this._sort.set({ key, direction: 'asc' });
    } else if (current.direction === 'asc') {
      this._sort.set({ key, direction: 'desc' });
    } else {
      this._sort.set({ key: null, direction: null });
    }
    this.sortChange.emit(this._sort());
  }

  goToPage(target: number): void {
    const clamped = Math.min(Math.max(1, target), this.totalPages());
    this._page.set(clamped);
  }
}


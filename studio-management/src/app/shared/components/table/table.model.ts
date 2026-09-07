export type SortDirection = 'asc' | 'desc' | null;

export interface TableColumn<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Optional custom render — return plain text/number for the cell. */
  format?: (row: T) => string;
  /** Whether this column renders as a pill badge. */
  badge?: boolean;
  /** Semantic badge variant (neutral | accent | success | warning | danger | info). */
  badgeVariant?: (row: T) => string;
  /** Optional style for the cell content. */
  cellClass?: (row: T) => string;
}

export interface SortState<T> {
  key: (keyof T & string) | null;
  direction: SortDirection;
}

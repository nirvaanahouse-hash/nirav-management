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
  /**
   * Renders a round photo before the cell text — return a ready-to-use image
   * URL, or an empty value to fall back to the text's initials. Shows in the
   * table cell and, when this is the card heading, on the phone card too.
   */
  avatar?: (row: T) => string | null | undefined;
  /** Semantic badge variant (neutral | accent | success | warning | danger | info). */
  badgeVariant?: (row: T) => string;
  /** Optional style for the cell content. */
  cellClass?: (row: T) => string;
  /**
   * Phone layout (the table becomes a card list under 769px):
   * `primary` makes this the card heading — otherwise the first non-badge
   * column is used; `hideOnMobile` leaves the field off the card entirely.
   */
  primary?: boolean;
  hideOnMobile?: boolean;
}

export interface SortState<T> {
  key: (keyof T & string) | null;
  direction: SortDirection;
}

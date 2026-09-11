/** One row in a select. `value` is what the control stores. */
export interface SelectItem {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional secondary line, e.g. a company under a client name. */
  hint?: string;
}

/**
 * What a select writes back to its form control:
 *  - single mode → the chosen value, or '' when nothing is chosen
 *  - multiple mode → an array of chosen values
 */
export type SelectValue = string | string[] | null;

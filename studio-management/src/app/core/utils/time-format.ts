import { AbstractControl, ValidationErrors } from "@angular/forms";

/**
 * Parses an hours/minutes duration into decimal hours. Accepts three shapes
 * so existing habits keep working while the field moves to clock-style entry:
 *   - "H:MM"  e.g. "1:30" -> 1.5   (minutes must be 0-59; exactly 60 rolls
 *                                   over into the next hour, e.g. "1:60" -> 2)
 *   - "H"     e.g. "8"    -> 8
 *   - "H.h"   e.g. "1.5"  -> 1.5   (plain decimal, unchanged from before)
 * Returns null for anything else, including a minute part over 60 (e.g.
 * "2:61") — the caller treats that as invalid input.
 */
export function timeStringToHours(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  const str = String(input).trim();
  if (!str) return null;

  const timeMatch = /^(\d+):(\d{1,2})$/.exec(str);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    if (minutes > 60) return null;
    return minutes === 60 ? hours + 1 : hours + minutes / 60;
  }

  if (/^\d+(\.\d+)?$/.test(str)) {
    return parseFloat(str);
  }

  return null;
}

/** Formats decimal hours as a "H:MM" duration string, e.g. 1.5 -> "1:30". */
export function hoursToTimeString(hours: number | string | null | undefined): string {
  const n = Number(hours);
  if (!Number.isFinite(n) || n < 0) return "0:00";
  const totalMinutes = Math.round(n * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Reactive-forms validator: blank passes (pair with Validators.required when needed); otherwise the value must parse via timeStringToHours. */
export function timeFormatValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === "") return null;
  return timeStringToHours(value) === null ? { invalidTime: true } : null;
}

/**
 * The multiplier a decimal-hours duration prices at: under an hour (i.e. the
 * "H" part was 0) prices by raw minutes, an hour or more prices by decimal
 * hours — e.g. "0:03" -> 3, "1:30" -> 1.5. A duration under 1 always came
 * from "0:MM" (M is 0-59, so H=0 caps the decimal at 59/60), so this is
 * reconstructable from the decimal alone without the original string.
 */
export function pricingMultiplier(decimalHours: number): number {
  if (!Number.isFinite(decimalHours) || decimalHours <= 0) return 0;
  return decimalHours < 1 ? Math.round(decimalHours * 60) : decimalHours;
}

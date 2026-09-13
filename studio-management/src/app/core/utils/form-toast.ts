import { AbstractControl, FormGroup } from "@angular/forms";
import { ToastService } from "../../features/toast/toast.service";

function controlLabel(name: string, labels?: Record<string, string>): string {
  return labels?.[name] || name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function messageFor(control: AbstractControl, name: string, labels?: Record<string, string>): string {
  const errors = control.errors;
  if (!errors) return "";
  const label = controlLabel(name, labels);
  if (errors["required"]) return `${label} is required.`;
  if (errors["email"]) return "Enter a valid email address.";
  if (errors["minlength"]) {
    return `${label} must be at least ${errors["minlength"].requiredLength} characters.`;
  }
  if (errors["maxlength"]) {
    return `${label} must be at most ${errors["maxlength"].requiredLength} characters.`;
  }
  if (errors["min"]) return `${label} must be at least ${errors["min"].min}.`;
  if (errors["max"]) return `${label} must be at most ${errors["max"].max}.`;
  if (errors["pattern"]) return `${label} format is invalid.`;
  if (errors["passwordMismatch"]) return "Passwords do not match.";
  return `${label} is invalid.`;
}

export function collectFormErrors(
  control: AbstractControl,
  labels?: Record<string, string>,
  parentKey = "",
): string[] {
  const messages: string[] = [];

  if (control instanceof FormGroup) {
    if (control.errors?.["passwordMismatch"]) {
      messages.push("Passwords do not match.");
    }
    for (const [key, child] of Object.entries(control.controls)) {
      messages.push(...collectFormErrors(child, labels, key));
    }
    return messages;
  }

  if (control.invalid && control.errors) {
    const msg = messageFor(control, parentKey || "Field", labels);
    if (msg) messages.push(msg);
  }

  return messages;
}

export function toastIfInvalid(
  form: AbstractControl,
  toast: ToastService,
  labels?: Record<string, string>,
): boolean {
  if (form.valid) {
    return false;
  }

  form.markAllAsTouched();
  const messages = collectFormErrors(form, labels);
  toast.error(
    "Please fix the highlighted fields",
    messages.slice(0, 4).join(" · ") || "Check the form and try again.",
  );
  return true;
}

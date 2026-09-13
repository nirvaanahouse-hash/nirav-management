import { HttpErrorResponse } from "@angular/common/http";

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ParsedApiError {
  message: string;
  detail?: string;
  errors: ApiFieldError[];
}

export function parseApiError(error: unknown): ParsedApiError {
  const fallback: ParsedApiError = {
    message: "Request failed",
    errors: [],
  };

  if (!(error instanceof HttpErrorResponse)) {
    if (error instanceof Error && error.message) {
      return { message: error.message, errors: [] };
    }
    return fallback;
  }

  const body = error.error;
  const errors: ApiFieldError[] = Array.isArray(body?.errors) ? body.errors : [];
  const message =
    body?.message ||
    error.message ||
    (error.status === 0 ? "Cannot reach the server." : fallback.message);
  const detail = errors.map((e) => e.message).filter(Boolean).join(" · ") || undefined;

  return { message, detail, errors };
}

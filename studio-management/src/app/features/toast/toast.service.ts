import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
}

/**
 * Reusable, app-wide toast notification service. Any feature module can
 * inject this instead of rolling its own notification UI.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(kind: ToastKind, message: string, detail?: string, durationMs = 4000): void {
    const toast: Toast = { id: this.nextId++, kind, message, detail };
    this._toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  success(message: string, detail?: any): void {
    this.show('success', message, detail);
  }

  error(message: string, detail?: string): void {
    this.show('error', message, detail, 6000);
  }

  warning(message: string, detail?: string): void {
    this.show('warning', message, detail);
  }

  info(message: string, detail?: string): void {
    this.show('info', message, detail);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}

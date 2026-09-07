import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (result: boolean) => void;
}

/**
 * App-wide confirmation dialog. Any feature calls `confirmDialogService.ask(...)`
 * and awaits a boolean — no feature needs to build its own confirm modal.
 * Rendered once by <app-confirm-dialog-host> mounted in the root shell.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly _pending = signal<PendingConfirm | null>(null);
  readonly pending = this._pending.asReadonly();

  ask(request: ConfirmRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this._pending.set({ ...request, resolve });
    });
  }

  resolve(result: boolean): void {
    this._pending()?.resolve(result);
    this._pending.set(null);
  }
}

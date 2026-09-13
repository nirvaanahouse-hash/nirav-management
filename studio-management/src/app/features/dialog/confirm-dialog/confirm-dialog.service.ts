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

  // Only one confirm dialog can be shown at a time; a request that arrives
  // while another is still awaiting an answer waits in line instead of
  // silently replacing it (which orphaned the first caller's promise forever
  // — e.g. two destructive actions double-clicked in quick succession before
  // the first dialog rendered).
  private readonly queue: PendingConfirm[] = [];

  ask(request: ConfirmRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const entry: PendingConfirm = { ...request, resolve };
      if (this._pending()) {
        this.queue.push(entry);
      } else {
        this._pending.set(entry);
      }
    });
  }

  resolve(result: boolean): void {
    this._pending()?.resolve(result);
    const next = this.queue.shift();
    this._pending.set(next ?? null);
  }
}

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../dialog/modal.component';
import { ButtonComponent } from '../../shared/components/button/button';
import { FinancialRevealService } from '../../core/services/financial-reveal.service';
import { ToastService } from '../toast/toast.service';

/**
 * Email-OTP gate for the financial figures hidden behind <app-masked-value>.
 * Verifying here flips FinancialRevealService.isRevealed for 5 minutes,
 * which every masked value across the app reads from the same signal.
 */
@Component({
  selector: 'app-reveal-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Show financial figures" [maxWidth]="400" (close)="reveal.closeDialog()">
      @if (!sent()) {
        <p class="reveal-dialog__copy">
          Sends a one-time code to your registered email. Enter it to reveal Main Amount,
          profit, earnings and balance figures across the app for 5 minutes.
        </p>
      } @else {
        <p class="reveal-dialog__copy">{{ sentMessage() }}</p>
        <input
          class="reveal-dialog__input"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="6-digit code"
          [(ngModel)]="otp"
          (keydown.enter)="verify()"
        />
      }
      <ng-container modal-footer>
        <app-button variant="secondary" (clicked)="reveal.closeDialog()">Cancel</app-button>
        @if (!sent()) {
          <app-button [loading]="sending()" (clicked)="send()">Send code</app-button>
        } @else {
          <app-button variant="secondary" [loading]="sending()" (clicked)="send()">Resend</app-button>
          <app-button [loading]="verifying()" (clicked)="verify()">Verify</app-button>
        }
      </ng-container>
    </app-modal>
  `,
  styles: [
    `
      .reveal-dialog__copy {
        color: var(--text-secondary);
        font-size: var(--fs-sm);
        margin: 0 0 var(--sp-3);
      }
      .reveal-dialog__input {
        width: 100%;
        padding: var(--sp-3);
        border: 1px solid var(--border-subtle);
        border-radius: var(--r-sm);
        background: var(--surface-1);
        color: var(--text-primary);
        font-size: var(--fs-lg);
        letter-spacing: 0.3em;
        text-align: center;
      }
    `,
  ],
})
export class RevealDialogComponent {
  protected readonly reveal = inject(FinancialRevealService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sending = signal(false);
  readonly verifying = signal(false);
  readonly sent = signal(false);
  readonly sentMessage = signal('');
  otp = '';

  send(): void {
    this.sending.set(true);
    this.reveal.requestOtp().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.sent.set(true);
        this.sentMessage.set(res.message);
      },
      error: () => {
        this.sending.set(false);
      },
    });
  }

  verify(): void {
    if (!this.otp.trim()) {
      this.toast.error('Enter the code', 'Check your email for the 6-digit code.');
      return;
    }
    this.verifying.set(true);
    this.reveal.verifyOtp(this.otp.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.verifying.set(false);
        this.toast.success('Revealed', 'Financial figures are visible for 5 minutes.');
        this.reveal.closeDialog();
      },
      error: () => {
        this.verifying.set(false);
      },
    });
  }
}

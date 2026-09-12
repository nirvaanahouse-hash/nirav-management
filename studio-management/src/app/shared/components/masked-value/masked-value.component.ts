import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FinancialRevealService } from '../../../core/services/financial-reveal.service';

/**
 * Wraps a financial figure (Main Amount, profit, earnings, balance due, ...)
 * and hides it behind a click-to-reveal lock until the SA verifies an email
 * OTP (see FinancialRevealService) — a screen-privacy gate, not a security
 * boundary. Every instance across the app shares the same reveal state.
 */
@Component({
  selector: 'app-masked-value',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (reveal.isRevealed()) {
      <span>{{ value() }}</span>
    } @else {
      <button
        type="button"
        class="masked-value"
        [attr.aria-label]="'Hidden — click to reveal ' + label()"
        (click)="reveal.openDialog()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <span>••••</span>
      </button>
    }
  `,
  styles: [
    `
      .masked-value {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: none;
        background: none;
        padding: 0;
        color: var(--text-muted);
        cursor: pointer;
        font: inherit;
        letter-spacing: 0.15em;
      }
      .masked-value:hover {
        color: var(--accent);
      }
    `,
  ],
})
export class MaskedValueComponent {
  protected readonly reveal = inject(FinancialRevealService);

  value = input.required<string>();
  /** For the aria-label, e.g. "Main Amount". */
  label = input('figure');
}

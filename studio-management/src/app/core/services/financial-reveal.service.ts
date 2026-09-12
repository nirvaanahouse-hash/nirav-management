import { Injectable, computed, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { environment } from "../../../environments/environment";

const STORAGE_KEY = "financialRevealUntil";

interface RevealResponse {
  success: boolean;
  message: string;
  data: { revealUntil: number };
}

/**
 * SA-only screen-privacy gate for financial figures (Main Amount, profit,
 * earnings, balance due, ...). This is not a security boundary — an SA who
 * can call the API already has this data — it just keeps it off-screen by
 * default so it isn't casually visible, until an email OTP unlocks it for a
 * few minutes across every page that uses <app-masked-value>.
 */
@Injectable({ providedIn: "root" })
export class FinancialRevealService {
  private readonly http = inject(HttpClient);

  private readonly _revealUntil = signal<number | null>(this.readStored());
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isRevealed = computed(() => {
    const until = this._revealUntil();
    return !!until && until > Date.now();
  });

  readonly revealUntil = this._revealUntil.asReadonly();

  /** One shared dialog instance (mounted in MainLayout) reacts to this,
   *  so every masked value across the app opens the same dialog. */
  private readonly _dialogOpen = signal(false);
  readonly dialogOpen = this._dialogOpen.asReadonly();

  constructor() {
    this.scheduleAutoHide();
  }

  openDialog(): void {
    this._dialogOpen.set(true);
  }

  closeDialog(): void {
    this._dialogOpen.set(false);
  }

  private readStored(): number | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    const until = raw ? Number(raw) : null;
    return until && until > Date.now() ? until : null;
  }

  requestOtp(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${environment.apiUrl}api/financial-reveal/request`,
      {},
      { withCredentials: true },
    );
  }

  verifyOtp(otp: string): Observable<RevealResponse> {
    return this.http
      .post<RevealResponse>(
        `${environment.apiUrl}api/financial-reveal/verify`,
        { otp },
        { withCredentials: true },
      )
      .pipe(tap((res) => this.setRevealed(res.data.revealUntil)));
  }

  /** Re-hides immediately, without waiting for the 5-minute window. */
  hideNow(): void {
    this.setRevealed(null);
  }

  private setRevealed(until: number | null): void {
    this._revealUntil.set(until);
    if (until) {
      localStorage.setItem(STORAGE_KEY, String(until));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.scheduleAutoHide();
  }

  private scheduleAutoHide(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    const until = this._revealUntil();
    if (!until) return;
    const ms = until - Date.now();
    if (ms <= 0) {
      this._revealUntil.set(null);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    this.hideTimer = setTimeout(() => {
      this._revealUntil.set(null);
      localStorage.removeItem(STORAGE_KEY);
    }, ms);
  }
}

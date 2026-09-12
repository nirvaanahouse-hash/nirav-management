import { Injectable, computed, effect, inject, signal } from "@angular/core";
import { HttpClient, HttpContext } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { AuthService } from "./auth.service";
import { SKIP_ERROR_TOAST } from "../http/error-toast.context";

export interface UserLocationView {
  userId: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  updatedAt: string | null;
  /** false = the user has turned sharing off. */
  sharing: boolean;
}

interface LocationStateResponse {
  success: boolean;
  data: { sharing: boolean };
}

interface UserLocationResponse {
  success: boolean;
  data: UserLocationView;
}

const PREF_KEY = "locationSharing";
const PING_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes while the tab is open
const NO_TOAST = { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };

/**
 * Shares the current user's browser location with the backend on a slow timer
 * while they are logged in, so an admin can see where staff are. The user can
 * switch it off (persisted server-side); the browser's own permission prompt
 * still gates the very first fix.
 */
@Injectable({ providedIn: "root" })
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  /** User's toggle (optimistic; confirmed from the server after login). */
  private readonly _sharing = signal<boolean>(this.readPref());
  /** Browser blocked us (permission denied or no geolocation support). */
  private readonly _blocked = signal(false);

  readonly sharing = this._sharing.asReadonly();
  readonly blocked = this._blocked.asReadonly();
  /** Location is actually being sent right now. */
  readonly active = computed(() => this._sharing() && !this._blocked());

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start when a session appears, stop when it goes away.
    effect(() => {
      const session = this.authService.session();
      if (session?.user) {
        this.syncFromServer();
        if (this._sharing()) this.start();
      } else {
        this.stop();
      }
    });

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && this._sharing() && !this._blocked()) this.pushOnce();
      });
    }
  }

  /** Toggle handler for the profile switch. */
  setSharing(on: boolean): void {
    this._sharing.set(on);
    this.writePref(on);
    if (on) this._blocked.set(false);

    this.http
      .put(`${environment.apiUrl}api/location/sharing`, { sharing: on }, NO_TOAST)
      .subscribe({ error: () => {} });

    if (on) this.start();
    else this.stop();
  }

  /** SA / users.location — read one user's last known location. */
  getUserLocation(userId: string): Observable<UserLocationResponse> {
    return this.http.get<UserLocationResponse>(`${environment.apiUrl}api/location/${userId}`);
  }

  // --- internals -----------------------------------------------------------

  private syncFromServer(): void {
    this.http
      .get<LocationStateResponse>(`${environment.apiUrl}api/location/me`, NO_TOAST)
      .subscribe({
        next: (res) => {
          if (!res?.success || typeof res.data?.sharing !== "boolean") return;
          this._sharing.set(res.data.sharing);
          this.writePref(res.data.sharing);
          if (res.data.sharing) this.start();
          else this.stop();
        },
        error: () => {},
      });
  }

  private start(): void {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      this._blocked.set(true);
      return;
    }
    if (this.timer) return;
    this.pushOnce();
    this.timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      this.pushOnce();
    }, PING_INTERVAL_MS);
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private pushOnce(): void {
    if (!this._sharing()) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this._blocked.set(false);
        const { latitude, longitude, accuracy } = pos.coords;
        this.http
          .put(
            `${environment.apiUrl}api/location`,
            { lat: latitude, lng: longitude, accuracy },
            NO_TOAST,
          )
          .subscribe({ error: () => {} });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this._blocked.set(true);
          this.stop();
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }

  private readPref(): boolean {
    try {
      const v = localStorage.getItem(PREF_KEY);
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  }

  private writePref(on: boolean): void {
    try {
      localStorage.setItem(PREF_KEY, on ? "1" : "0");
    } catch {
      /* private mode / storage disabled — non-fatal */
    }
  }
}

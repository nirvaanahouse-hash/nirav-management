import { Injectable, computed, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, catchError, of, tap } from "rxjs";
import {
  AuthCredentials,
  AuthResponse,
  AuthSession,
  RegisterPayload,
  RegisterResponse,
  User,
  UserRole,
} from "../models/user.model";
import { StorageService } from "./storage.service";
import { environment } from "../../../environments/environment";

const TOKEN_KEY = "authToken";

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);

  private readonly _session = signal<AuthSession | null>(null);

  readonly session = this._session.asReadonly();
  readonly currentUser = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly isActive = computed(() => this._session()?.user?.isActive ?? false);
  readonly role = computed<UserRole | null>(
    () => this._session()?.user?.role ?? null
  );
  readonly isSuperAdmin = computed(() => this.role() === "SA");
  readonly isAdmin = computed(() => this.role() === "A" || this.role() === "SA");
  readonly isEmployee = computed(() => this.role() === "U");

  constructor() {
    const storedUser = this.storage.get<User>("authData");
    if (storedUser) {
      this._session.set({ user: storedUser });
    }
  }

  login(credentials: AuthCredentials): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}api/auth/login`, credentials)
      .pipe(
        tap((response) => {
          const session: AuthSession = { user: response.user };
          this._session.set(session);
          this.storage.set("authData", response.user);
          this.storage.set(TOKEN_KEY, response.token);
        })
      );
  }

  /** Read by the HTTP interceptor to attach `Authorization: Bearer <token>`. */
  getToken(): string | null {
    return this.storage.get<string>(TOKEN_KEY);
  }

  register(payload: RegisterPayload): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${environment.apiUrl}api/auth/register`, payload);
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${environment.apiUrl}api/auth/logout`, {})
      .pipe(
        tap(() => {
          this._session.set(null);
          this.storage.remove("authData");
          this.storage.remove(TOKEN_KEY);
          window.dispatchEvent(new CustomEvent("auth-logout"));
        }),
        // The server call is best-effort (logout is stateless — see BE
        // auth.controller.js); if it fails for any reason (network blip,
        // 500), still clear the client-side session so the user isn't left
        // looking logged out (toast shown) but still holding a valid token.
        catchError(() => {
          this._session.set(null);
          this.storage.remove("authData");
          this.storage.remove(TOKEN_KEY);
          window.dispatchEvent(new CustomEvent("auth-logout"));
          return of(void 0);
        }),
      );
  }

  forceLogout(): void {
    this._session.set(null);
    this.storage.remove("authData");
    this.storage.remove(TOKEN_KEY);
    // Every cached-list service (chat/client/employee/amount/ticket-meta/
    // financial-reveal/task/profile) listens for this so a same-tab user
    // switch — or the interceptor's 401 forceLogout — can never leak the
    // previous user's data into the next session. See each service's own
    // "auth-logout" listener.
    window.dispatchEvent(new CustomEvent("auth-logout"));
  }

  updateUser(user: User): void {
    this._session.set({ user });
    this.storage.set("authData", user);
  }
}

import { Injectable, computed, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";
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
      .post<AuthResponse>(`${environment.apiUrl}api/auth/login`, credentials, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          const session: AuthSession = { user: response.user };
          this._session.set(session);
          this.storage.set("authData", response.user);
        })
      );
  }

  register(payload: RegisterPayload): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(
      `${environment.apiUrl}api/auth/register`,
      payload,
      { withCredentials: true }
    );
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${environment.apiUrl}api/auth/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => {
          this._session.set(null);
          this.storage.remove("authData");
        })
      );
  }

  forceLogout(): void {
    this._session.set(null);
    this.storage.remove("authData");
  }

  updateUser(user: User): void {
    this._session.set({ user });
    this.storage.set("authData", user);
  }
}

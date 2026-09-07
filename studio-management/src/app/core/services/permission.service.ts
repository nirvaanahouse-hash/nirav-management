import { Injectable, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../env/env';
import { AuthService } from './auth.service';
import {
  MyPermissionsResponse,
  PermissionRegistryResponse,
  SetPermissionsResponse,
  UserPermissionsResponse,
} from '../models/permission.model';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly isSuperAdmin = this.auth.isSuperAdmin;

  /** The current user's granted keys as a Set (recomputed only when the session changes). */
  readonly keys = computed(
    () => new Set(this.auth.currentUser()?.permissions ?? []),
  );

  /** Does the current user hold this permission? SA always → true. Empty/undefined key → true. */
  can(key?: string | null): boolean {
    if (!key) return true;
    return this.isSuperAdmin() || this.keys().has(key);
  }

  canAny(keys: readonly string[] = []): boolean {
    if (this.isSuperAdmin() || keys.length === 0) return true;
    const owned = this.keys();
    return keys.some((k) => owned.has(k));
  }

  canAll(keys: readonly string[] = []): boolean {
    if (this.isSuperAdmin()) return true;
    const owned = this.keys();
    return keys.every((k) => owned.has(k));
  }

  /** Pull the caller's effective permissions and fold them into the stored session. */
  refreshMe(): void {
    if (!this.auth.isAuthenticated()) return;
    this.http
      .get<MyPermissionsResponse>(`${environment.apiUrl}api/permissions/me`, {
        withCredentials: true,
      })
      .subscribe({
        next: (res) => {
          const user = this.auth.currentUser();
          if (user) {
            this.auth.updateUser({ ...user, permissions: res.data.permissions });
          }
        },
        error: () => {},
      });
  }

  getRegistry(): Observable<PermissionRegistryResponse> {
    return this.http.get<PermissionRegistryResponse>(
      `${environment.apiUrl}api/permissions`,
      { withCredentials: true },
    );
  }

  getUserPermissions(userId: string): Observable<UserPermissionsResponse> {
    return this.http.get<UserPermissionsResponse>(
      `${environment.apiUrl}api/employees/${userId}/permissions`,
      { withCredentials: true },
    );
  }

  setUserPermissions(userId: string, permissions: string[]): Observable<SetPermissionsResponse> {
    return this.http.put<SetPermissionsResponse>(
      `${environment.apiUrl}api/employees/${userId}/permissions`,
      { permissions },
      { withCredentials: true },
    );
  }
}

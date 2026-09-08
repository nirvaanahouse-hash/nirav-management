import { Injectable, computed, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { environment } from "../../../environments/environment";

export interface ProfileData {
  _id?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  userName?: string;
  email?: string;
  mobileNumber?: string;
  referName?: string;
  role?: string;
  image?: string;
  gender?: string;
  homeAddress?: string;
  dob?: string;
  percentage?: number;
  password?: string;
}

export interface ProfileResponse {
  success: boolean;
  message?: string;
  data: ProfileData;
}

@Injectable({ providedIn: "root" })
export class ProfileService {
  private readonly http = inject(HttpClient);

  private readonly _profile = signal<ProfileData | null>(null);
  readonly profile = this._profile.asReadonly();

  /** Current user's profile photo (data URL), shared with the navbar avatar. */
  readonly photo = computed(() => this._profile()?.image || "");

  getProfile(): Observable<ProfileResponse> {
    return this.http
      .get<ProfileResponse>(`${environment.apiUrl}api/profile`, {
        withCredentials: true,
      })
      .pipe(tap((res) => res?.success && this._profile.set(res.data)));
  }

  updateProfile(data: Partial<ProfileData>): Observable<ProfileResponse> {
    return this.http
      .put<ProfileResponse>(`${environment.apiUrl}api/profile`, data, {
        withCredentials: true,
      })
      .pipe(
        tap(() =>
          this._profile.update((prev) => (prev ? { ...prev, ...data } : prev)),
        ),
      );
  }

  clear(): void {
    this._profile.set(null);
  }
}

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

  /** Current user's profile photo as a ready-to-use <img> URL, shared with the navbar avatar. */
  readonly photo = computed(() => this.resolveImageUrl(this._profile()?.image));

  /**
   * Resolve a stored `image` value to something an <img> can load.
   * Photos are now files served by the API (`uploads/profile/…`); legacy base64
   * data URLs and absolute URLs are passed through untouched.
   */
  resolveImageUrl(value: string | null | undefined): string {
    if (!value) return "";
    if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
    return `${environment.apiUrl}${value.replace(/^\/+/, "")}`;
  }

  getProfile(): Observable<ProfileResponse> {
    return this.http
      .get<ProfileResponse>(`${environment.apiUrl}api/profile`)
      .pipe(tap((res) => res?.success && this._profile.set(res.data)));
  }

  updateProfile(data: Partial<ProfileData>): Observable<ProfileResponse> {
    return this.http
      .put<ProfileResponse>(`${environment.apiUrl}api/profile`, data)
      .pipe(
        tap(() =>
          this._profile.update((prev) => (prev ? { ...prev, ...data } : prev)),
        ),
      );
  }

  /** Upload / replace the profile photo. Sends the raw file as multipart/form-data. */
  uploadPhoto(file: File): Observable<ProfileResponse> {
    const body = new FormData();
    body.append("image", file);
    return this.http
      .post<ProfileResponse>(`${environment.apiUrl}api/profile/image`, body)
      .pipe(
        tap(
          (res) =>
            res?.success &&
            this._profile.update((prev) =>
              prev ? { ...prev, image: res.data.image } : prev,
            ),
        ),
      );
  }

  /** Remove the profile photo (clears the field and deletes the file server-side). */
  deletePhoto(): Observable<ProfileResponse> {
    return this.http
      .delete<ProfileResponse>(`${environment.apiUrl}api/profile/image`)
      .pipe(
        tap(
          (res) =>
            res?.success &&
            this._profile.update((prev) =>
              prev ? { ...prev, image: "" } : prev,
            ),
        ),
      );
  }

  clear(): void {
    this._profile.set(null);
  }
}

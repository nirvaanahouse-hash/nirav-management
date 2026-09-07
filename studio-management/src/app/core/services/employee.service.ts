import { Injectable, inject, signal } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { User, EmployeeSummary } from "../../core/models/user.model";
import { environment } from "../../env/env";

export interface EmployeeResponse {
  success: boolean;
  message?: string;
  data: User[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface EmployeeStatsResponse {
  success: boolean;
  data: EmployeeSummary;
}

export interface EmployeeActionResponse {
  success: boolean;
  message: string;
  data: User;
}

@Injectable({ providedIn: "root" })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly _employees = signal<User[]>([]);
  private readonly _stats = signal<EmployeeSummary | null>(null);

  readonly employees = this._employees.asReadonly();
  readonly stats = this._stats.asReadonly();

  list(params?: { search?: string; isActive?: boolean; page?: string; limit?: string }): Observable<EmployeeResponse> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.search) httpParams = httpParams.set("search", params.search);
      if (params.isActive !== undefined) httpParams = httpParams.set("isActive", params.isActive.toString());
      if (params.page) httpParams = httpParams.set("page", params.page);
      if (params.limit) httpParams = httpParams.set("limit", params.limit);
    }

    return this.http
      .get<EmployeeResponse>(`${environment.apiUrl}api/employees`, {
        params: httpParams,
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          this._employees.set(response.data);
        })
      );
  }

  getStats(): Observable<EmployeeStatsResponse> {
    return this.http
      .get<EmployeeStatsResponse>(`${environment.apiUrl}api/employees/stats`, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          this._stats.set(response.data);
        })
      );
  }

  deactivate(id: string): Observable<EmployeeActionResponse> {
    return this.http
      .put<EmployeeActionResponse>(
        `${environment.apiUrl}api/employees/${id}/status`,
        { isActive: false },
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          this._employees.update((list) =>
            list.map((e) => (e._id === response.data._id ? response.data : e))
          );
          this.refreshStats();
        })
      );
  }

  activate(id: string): Observable<EmployeeActionResponse> {
    return this.http
      .put<EmployeeActionResponse>(
        `${environment.apiUrl}api/employees/${id}/status`,
        { isActive: true },
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          this._employees.update((list) =>
            list.map((e) => (e._id === response.data._id ? response.data : e))
          );
          this.refreshStats();
        })
      );
  }

  refreshStats(): void {
    this.getStats().subscribe({
      error: () => {},
    });
  }

  setPassword(id: string, password: string): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${environment.apiUrl}api/employees/${id}/password`,
      { password },
      { withCredentials: true },
    );
  }

  setPercentage(id: string, percentage: number): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${environment.apiUrl}api/employees/${id}/percentage`,
      { percentage },
      { withCredentials: true },
    );
  }

  /** Full record incl. profile fields — used to pre-fill the SA edit form. */
  getById(id: string): Observable<{ success: boolean; data: User }> {
    return this.http.get<{ success: boolean; data: User }>(
      `${environment.apiUrl}api/employees/${id}`,
      { withCredentials: true },
    );
  }

  /** SA updates a user's full details (User doc + Profile doc). */
  updateDetails(
    id: string,
    payload: {
      firstName: string;
      lastName: string;
      userName: string;
      email: string;
      mobileNumber: string;
      role: string;
      homeAddress: string;
      gender: string;
      dob: string;
      percentage: number;
    },
  ): Observable<EmployeeActionResponse> {
    return this.http
      .put<EmployeeActionResponse>(`${environment.apiUrl}api/employees/${id}/details`, payload, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          this._employees.update((list) =>
            list.map((e) => (e._id === response.data._id ? { ...e, ...response.data } : e)),
          );
        }),
      );
  }
}

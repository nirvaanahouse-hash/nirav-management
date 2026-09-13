import { Injectable, inject, signal } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { User, EmployeeSummary } from "../../core/models/user.model";
import { environment } from "../../../environments/environment";

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

  constructor() {
    // Same in-place upsert/remove pattern as TaskService/ClientService — see
    // TaskService's constructor for why this never disturbs the Users
    // table's own pagination page.
    window.addEventListener('employee-event', ((
      e: CustomEvent<{ type: string; employee: Partial<User> & { _id: string } }>
    ) => {
      const { type, employee } = e.detail;
      if (type === 'employee-deleted') {
        this._employees.update((list) => list.filter((u) => u._id !== employee._id));
      } else {
        this.upsert(employee as User);
      }
    }) as EventListener);

    // Without this, a same-tab user switch keeps the previous user's
    // employee list/stats cached until this page happens to reload them.
    window.addEventListener('auth-logout', () => {
      this._employees.set([]);
      this._stats.set(null);
    });
  }

  private upsert(employee: User): void {
    this._employees.update((list) => {
      const exists = list.some((u) => u._id === employee._id);
      return exists ? list.map((u) => (u._id === employee._id ? employee : u)) : [employee, ...list];
    });
  }

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
      })
      .pipe(
        tap((response) => {
          this._employees.set(response.data);
        })
      );
  }

  getStats(): Observable<EmployeeStatsResponse> {
    return this.http
      .get<EmployeeStatsResponse>(`${environment.apiUrl}api/employees/stats`)
      .pipe(
        tap((response) => {
          this._stats.set(response.data);
        })
      );
  }

  deactivate(id: string): Observable<EmployeeActionResponse> {
    return this.http
      .put<EmployeeActionResponse>(`${environment.apiUrl}api/employees/${id}/status`, { isActive: false })
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
      .put<EmployeeActionResponse>(`${environment.apiUrl}api/employees/${id}/status`, { isActive: true })
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
      { password }
    );
  }

  setPercentage(
    id: string,
    percentage: number,
  ): Observable<{ success: boolean; message: string; data: { _id: string; percentage: number } }> {
    return this.http
      .put<{ success: boolean; message: string; data: { _id: string; percentage: number } }>(
        `${environment.apiUrl}api/employees/${id}/percentage`,
        { percentage }
      )
      .pipe(
        tap((response) => {
          this._employees.update((list) =>
            list.map((e) => (e._id === response.data._id ? { ...e, percentage: response.data.percentage } : e)),
          );
        }),
      );
  }

  /** Full record incl. profile fields — used to pre-fill the SA edit form. */
  getById(id: string): Observable<{ success: boolean; data: User }> {
    return this.http.get<{ success: boolean; data: User }>(
      `${environment.apiUrl}api/employees/${id}`
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
      .put<EmployeeActionResponse>(`${environment.apiUrl}api/employees/${id}/details`, payload)
      .pipe(
        tap((response) => {
          this._employees.update((list) =>
            list.map((e) => (e._id === response.data._id ? { ...e, ...response.data } : e)),
          );
        }),
      );
  }
}

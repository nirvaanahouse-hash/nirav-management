import { Injectable, signal, inject } from "@angular/core";
import { HttpClient, HttpContext, HttpParams } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import {
  TicketCreateResponse,
  TicketDraft,
  TicketRecord,
  TicketResponse,
} from "../models/task.model";
import { environment } from "../../../environments/environment";
import { SKIP_ERROR_TOAST } from "../http/error-toast.context";

@Injectable({ providedIn: "root" })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly _tickets = signal<TicketRecord[]>([]);
  private readonly _currentTicket = signal<TicketRecord | null>(null);

  readonly tickets = this._tickets.asReadonly();
  readonly currentTicket = this._currentTicket.asReadonly();

  list(params?: Record<string, string>): Observable<TicketResponse> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        httpParams = httpParams.set(key, value);
      });
    }

    return this.http
      .get<TicketResponse>(`${environment.apiUrl}api/ticket`, {
        params: httpParams,
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          this._tickets.set(response.data);
        })
      );
  }

  getById(id: string): Observable<TicketCreateResponse> {
    return this.http
      .get<TicketCreateResponse>(`${environment.apiUrl}api/ticket/${id}`, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          this._currentTicket.set(response.data);
        })
      );
  }

  create(draft: TicketDraft): Observable<TicketCreateResponse> {
    return this.http
      .post<TicketCreateResponse>(
        `${environment.apiUrl}api/ticket`,
        draft,
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          this._tickets.update((list) => [response.data, ...list]);
        })
      );
  }

  update(id: string, changes: Partial<TicketRecord>): Observable<TicketCreateResponse> {
    return this.http
      .put<TicketCreateResponse>(
        `${environment.apiUrl}api/ticket/${id}`,
        changes,
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          this._tickets.update((list) =>
            list.map((t) => (t._id === response.data._id ? response.data : t))
          );

          const current = this._currentTicket();
          if (current && current._id === response.data._id) {
            this._currentTicket.set(response.data);
          }
        })
      );
  }

  assignEmployee(id: string, employeeId: string): Observable<TicketCreateResponse> {
    return this.http
      .put<TicketCreateResponse>(
        `${environment.apiUrl}api/ticket/${id}/assign`,
        { assignedEmployee: employeeId },
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          this._tickets.update((list) =>
            list.map((t) => (t._id === response.data._id ? response.data : t))
          );
        })
      );
  }

  complete(id: string): Observable<TicketCreateResponse> {
    return this.http
      .put<TicketCreateResponse>(
        `${environment.apiUrl}api/ticket/${id}/complete`,
        {},
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          this._tickets.update((list) =>
            list.map((t) => (t._id === response.data._id ? response.data : t))
          );
        })
      );
  }

  finalize(id: string, isFinalized: boolean): Observable<TicketCreateResponse> {
    return this.http
      .put<TicketCreateResponse>(
        `${environment.apiUrl}api/ticket/${id}/finalize`,
        { isFinalized },
        // The caller already shows a tailored toast for every failure case
        // (permission / not-completed-yet / missing pricing) — skip the
        // global interceptor's toast so it isn't shown twice.
        { withCredentials: true, context: new HttpContext().set(SKIP_ERROR_TOAST, true) }
      )
      .pipe(
        tap((response) => {
          this._tickets.update((list) =>
            list.map((t) => (t._id === response.data._id ? response.data : t))
          );
        })
      );
  }

  delete(id: string): Observable<{ success: boolean; message: string; data: { _id: string } }> {
    return this.http
      .delete<{ success: boolean; message: string; data: { _id: string } }>(
        `${environment.apiUrl}api/ticket/${id}`,
        { withCredentials: true }
      )
      .pipe(
        tap(() => {
          this._tickets.update((list) => list.filter((t) => t._id !== id));
        })
      );
  }
}

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

  constructor() {
    // Every mutation already patches `_tickets` from its own HTTP response
    // (below) — this is what makes a *different* session's edit show up
    // here live, via the socket broadcast socket.service.ts re-dispatches
    // as this DOM event. Always an in-place upsert/remove on the existing
    // array, never a full list replace, so an open table's current page
    // (shared/components/table's own `page` signal) is never disturbed.
    window.addEventListener("ticket-event", ((e: CustomEvent<{ type: string; ticket: TicketRecord | { _id: string } }>) => {
      const { type, ticket } = e.detail;
      if (type === "ticket-deleted") {
        this.remove(ticket._id);
      } else {
        this.upsert(ticket as TicketRecord);
      }
    }) as EventListener);

    // Without this, a same-tab user switch keeps the previous user's ticket
    // list/current-ticket cached until this page happens to reload them.
    window.addEventListener("auth-logout", () => {
      this._tickets.set([]);
      this._currentTicket.set(null);
    });
  }

  private upsert(ticket: TicketRecord): void {
    this._tickets.update((list) => {
      const exists = list.some((t) => t._id === ticket._id);
      return exists ? list.map((t) => (t._id === ticket._id ? ticket : t)) : [ticket, ...list];
    });
    if (this._currentTicket()?._id === ticket._id) {
      this._currentTicket.set(ticket);
    }
  }

  private remove(id: string): void {
    this._tickets.update((list) => list.filter((t) => t._id !== id));
    if (this._currentTicket()?._id === id) {
      this._currentTicket.set(null);
    }
  }

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
      })
      .pipe(
        tap((response) => {
          this._tickets.set(response.data);
        })
      );
  }

  getById(id: string): Observable<TicketCreateResponse> {
    return this.http
      .get<TicketCreateResponse>(`${environment.apiUrl}api/ticket/${id}`)
      .pipe(
        tap((response) => {
          this._currentTicket.set(response.data);
        })
      );
  }

  create(draft: TicketDraft): Observable<TicketCreateResponse> {
    return this.http
      .post<TicketCreateResponse>(`${environment.apiUrl}api/ticket`, draft)
      .pipe(
        tap((response) => {
          this._tickets.update((list) => [response.data, ...list]);
        })
      );
  }

  update(id: string, changes: Partial<TicketRecord>): Observable<TicketCreateResponse> {
    return this.http
      .put<TicketCreateResponse>(`${environment.apiUrl}api/ticket/${id}`, changes)
      .pipe(tap((response) => this.upsert(response.data)));
  }

  assignEmployee(id: string, employeeId: string): Observable<TicketCreateResponse> {
    return this.http
      .put<TicketCreateResponse>(`${environment.apiUrl}api/ticket/${id}/assign`, { assignedEmployee: employeeId })
      .pipe(tap((response) => this.upsert(response.data)));
  }

  complete(id: string): Observable<TicketCreateResponse> {
    return this.http
      .put<TicketCreateResponse>(`${environment.apiUrl}api/ticket/${id}/complete`, {})
      .pipe(tap((response) => this.upsert(response.data)));
  }

  finalize(id: string, isFinalized: boolean): Observable<TicketCreateResponse> {
    return this.http
      .put<TicketCreateResponse>(
        `${environment.apiUrl}api/ticket/${id}/finalize`,
        { isFinalized },
        // The caller already shows a tailored toast for every failure case
        // (permission / not-completed-yet / missing pricing) — skip the
        // global interceptor's toast so it isn't shown twice.
        { context: new HttpContext().set(SKIP_ERROR_TOAST, true) }
      )
      .pipe(tap((response) => this.upsert(response.data)));
  }

  delete(id: string): Observable<{ success: boolean; message: string; data: { _id: string } }> {
    return this.http
      .delete<{ success: boolean; message: string; data: { _id: string } }>(`${environment.apiUrl}api/ticket/${id}`)
      .pipe(tap(() => this.remove(id)));
  }
}

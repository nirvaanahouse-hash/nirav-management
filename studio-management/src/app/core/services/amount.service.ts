import { Injectable, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { AmountEntry, AmountEntryDraft } from "../models/amountEntry.model";
import { environment } from "../../../environments/environment";

export interface AmountEntryResponse {
  success: boolean;
  message: string;
  data: AmountEntry[];
}

export interface DashboardSummaryResponse {
  success: boolean;
  data: {
    employeeSummary: EmployeeSummaryItem[];
    clientSummary: ClientSummaryItem[];
    saTotals: SATotals;
  };
}

export interface EmployeeSummaryItem {
  _id: string;
  firstName: string;
  lastName: string;
  userName: string;
  totalTickets: number;
  totalAmount: number;
  completedFinalized: number;
}

export interface ClientSummaryItem {
  _id: string;
  name: string;
  sortName?: string;
  company?: string;
  totalWorkAmount: number;
  paidAmount: number;
  balanceDue: number;
}

export interface SATotals {
  totalEmployeeAmount: number;
  totalMainAmount: number;
  profit: number;
  totalSentToEmployees: number;
  pendingFromEmployees: number;
  totalClientAmount: number;
  totalReceivedFromClients: number;
  pendingFromClients: number;
}

export interface EmployeeSummaryResponse {
  success: boolean;
  data: {
    totalTickets: number;
    completedFinalizedCount: number;
    totalEarnings: number;
    totalAmountReceived: number;
    pendingAmount: number;
  };
}

@Injectable({ providedIn: "root" })
export class AmountService {
  private readonly http = inject(HttpClient);
  private readonly _entries = signal<AmountEntry[]>([]);

  readonly entries = this._entries.asReadonly();

  constructor() {
    // Same in-place upsert/remove pattern as TaskService/ClientService/
    // EmployeeService — see TaskService's constructor for the rationale.
    // The backend only targets sockets that could already see this entry
    // (its own recipient, or amounts.summary.sa/role-SA), so merging by id
    // here never introduces a row outside what this session is allowed to
    // view.
    window.addEventListener('amount-event', ((
      e: CustomEvent<{ type: string; entry: Partial<AmountEntry> & { _id: string } }>
    ) => {
      const { type, entry } = e.detail;
      if (type === 'amount-deleted') {
        this._entries.update((list) => list.filter((e) => e._id !== entry._id));
      } else {
        this.upsert(entry as AmountEntry);
      }
    }) as EventListener);

    // Without this, a same-tab user switch keeps the previous user's
    // financial ledger entries cached until this page happens to reload them.
    window.addEventListener('auth-logout', () => this._entries.set([]));
  }

  private upsert(entry: AmountEntry): void {
    this._entries.update((list) => {
      const exists = list.some((e) => e._id === entry._id);
      return exists ? list.map((e) => (e._id === entry._id ? entry : e)) : [entry, ...list];
    });
  }

  list(): Observable<AmountEntryResponse> {
    return this.http
      .get<AmountEntryResponse>(`${environment.apiUrl}api/amount-entries`)
      .pipe(
        tap((response) => {
          this._entries.set(response.data);
        })
      );
  }

  /** Entries for one recipient (e.g. a specific user / employee). */
  listFor(recipient: string, recipientType: "employee" | "client"): Observable<AmountEntryResponse> {
    return this.http.get<AmountEntryResponse>(`${environment.apiUrl}api/amount-entries`, {
      params: { recipient, recipientType },
    });
  }

  create(draft: AmountEntryDraft): Observable<{ success: boolean; message: string; data: AmountEntry }> {
    return this.http
      .post<{ success: boolean; message: string; data: AmountEntry }>(
        `${environment.apiUrl}api/amount-entries`,
        draft
      )
      .pipe(tap((response) => this.upsert(response.data)));
  }

  update(id: string, changes: { amount?: number; description?: string }): Observable<{ success: boolean; message: string; data: AmountEntry }> {
    return this.http
      .put<{ success: boolean; message: string; data: AmountEntry }>(
        `${environment.apiUrl}api/amount-entries/${id}`,
        changes
      )
      .pipe(
        tap((response) => {
          this._entries.update((list) =>
            list.map((e) => (e._id === response.data._id ? response.data : e))
          );
        }),
      );
  }

  delete(id: string): Observable<{ success: boolean; message: string; data: { _id: string } }> {
    return this.http
      .delete<{ success: boolean; message: string; data: { _id: string } }>(
        `${environment.apiUrl}api/amount-entries/${id}`
      )
      .pipe(
        tap(() => {
          this._entries.update((list) => list.filter((e) => e._id !== id));
        }),
      );
  }

  getDashboardSummary(): Observable<DashboardSummaryResponse> {
    return this.http.get<DashboardSummaryResponse>(
      `${environment.apiUrl}api/dashboard/summary`
    );
  }

  getEmployeeSummary(): Observable<EmployeeSummaryResponse> {
    return this.http.get<EmployeeSummaryResponse>(
      `${environment.apiUrl}api/employee/summary`
    );
  }
}

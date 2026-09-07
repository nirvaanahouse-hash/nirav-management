import { Injectable, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, map, tap } from "rxjs";
import { environment } from "../../env/env";

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
  /** For employee options: the user's SA-set profit share (%). */
  percentage?: number;
}

export interface TicketFormMeta {
  ticketTypes: SelectOption[];
  priorities: SelectOption[];
  statuses: SelectOption[];
  clients: SelectOption[];
  employees: SelectOption[];
}

interface TicketFormMetaResponse {
  success: boolean;
  message: string;
  data: TicketFormMeta;
}

const EMPTY_META: TicketFormMeta = {
  ticketTypes: [],
  priorities: [],
  statuses: [],
  clients: [],
  employees: [],
};

/**
 * Single source for every ticket-form dropdown. The backend
 * (`GET /api/ticket/form-meta`) returns enum options plus the active
 * clients and employees in one payload.
 */
@Injectable({ providedIn: "root" })
export class TicketMetaService {
  private readonly http = inject(HttpClient);

  private readonly _meta = signal<TicketFormMeta>(EMPTY_META);
  readonly meta = this._meta.asReadonly();

  loadFormMeta(): Observable<TicketFormMeta> {
    return this.http
      .get<TicketFormMetaResponse>(`${environment.apiUrl}api/ticket/form-meta`, {
        withCredentials: true,
      })
      .pipe(
        map((res) => res.data ?? EMPTY_META),
        tap((meta) => this._meta.set(meta)),
      );
  }
}

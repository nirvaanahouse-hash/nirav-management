import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Client, ClientDraft } from '../models/client.model';
import { environment } from '../../../environments/environment';

export interface ClientListResponse {
  success: boolean;
  message?: string;
  data: Client[];
}

export interface ClientSingleResponse {
  success: boolean;
  message: string;
  data: Client;
}

export type BillingMode = 'all' | 'current' | 'custom';

export interface BillingRow {
  _id: string;
  coupleName: string;
  ticketType: string;
  deleveryDate: string;
  mainAmount: number;
  isPdf: boolean;
}

export interface BillingSummary {
  /** Sum of the tickets shown on this statement. */
  statementTotal: number;
  /** All work the client has been invoiced for (isPdf tickets + a current run). */
  invoicedTotal: number;
  /** All payments received from the client. */
  received: number;
  /** max(0, invoicedTotal − received) — only invoiced work counts. */
  pending: number;
  /** New work this statement adds to the bill (= statementTotal for a current run, else 0). */
  newWork: number;
  /** priorInvoiced − received: what was owed before this statement (negative = client credit). */
  previousBalance: number;
}

export interface ClientBillingResponse {
  success: boolean;
  message: string;
  data: {
    client: { _id: string; name: string; company: string };
    mode: BillingMode;
    from: string;
    to: string;
    tickets: BillingRow[];
    summary: BillingSummary;
  };
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly http = inject(HttpClient);
  private readonly _clients = signal<Client[]>([]);
  readonly clients = this._clients.asReadonly();

  constructor() {
    // Mirrors TaskService's socket listener (see its constructor for why this
    // is always an in-place upsert, never a full-list `.set()` — it keeps the
    // shared TableComponent's own pagination page untouched).
    window.addEventListener('client-event', ((
      e: CustomEvent<{ type: string; client: Partial<Client> & { _id: string } }>
    ) => {
      const { type, client } = e.detail;
      if (type === 'client-image') {
        this.patchImage(client._id, client.image ?? '');
      } else {
        this.upsert(client as Client);
      }
    }) as EventListener);
  }

  private upsert(client: Client): void {
    this._clients.update((list) => {
      const exists = list.some((c) => c._id === client._id);
      return exists ? list.map((c) => (c._id === client._id ? client : c)) : [client, ...list];
    });
  }

  list(params?: { search?: string; status?: string; page?: string; limit?: string }): Observable<ClientListResponse> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.page) httpParams = httpParams.set('page', params.page);
      if (params.limit) httpParams = httpParams.set('limit', params.limit);
    }

    return this.http
      .get<ClientListResponse>(`${environment.apiUrl}api/client`, {
        params: httpParams,
        withCredentials: true,
      })
      .pipe(tap((response) => this._clients.set(response.data)));
  }

  getById(id: string): Observable<ClientSingleResponse> {
    return this.http.get<ClientSingleResponse>(`${environment.apiUrl}api/client/${id}`, {
      withCredentials: true,
    });
  }

  create(draft: ClientDraft): Observable<ClientSingleResponse> {
    return this.http
      .post<ClientSingleResponse>(`${environment.apiUrl}api/client`, draft, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          this._clients.update((list) => [response.data, ...list]);
        })
      );
  }

  update(id: string, draft: ClientDraft): Observable<ClientSingleResponse> {
    return this.http
      .put<ClientSingleResponse>(`${environment.apiUrl}api/client/${id}`, draft, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          this._clients.update((list) =>
            list.map((c) => (c._id === response.data._id ? response.data : c))
          );
        })
      );
  }

  delete(id: string): Observable<{ success: boolean; message: string; data: Client; hasTickets?: boolean }> {
    return this.http
      .delete<{ success: boolean; message: string; data: Client; hasTickets?: boolean }>(`${environment.apiUrl}api/client/${id}`, {
        withCredentials: true,
      })
      .pipe(
        tap(() => {
          this._clients.update((list) => list.filter((c) => c._id !== id));
        })
      );
  }

  deactivate(id: string): Observable<{ success: boolean; message: string; data: Client }> {
    return this.http
      .put<{ success: boolean; message: string; data: Client }>(
        `${environment.apiUrl}api/client/${id}`,
        { isActive: false },
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          this._clients.update((list) =>
            list.map((c) => (c._id === response.data._id ? response.data : c))
          );
        })
      );
  }

  reactivate(id: string): Observable<{ success: boolean; message: string; data: Client }> {
    return this.http
      .put<{ success: boolean; message: string; data: Client }>(
        `${environment.apiUrl}api/client/${id}`,
        { isActive: true },
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          this._clients.update((list) =>
            list.map((c) => (c._id === response.data._id ? response.data : c))
          );
        })
      );
  }

  /** Upload / replace a client's photo. Sends the raw file as multipart/form-data. */
  uploadImage(id: string, file: File): Observable<{ success: boolean; data: { image: string } }> {
    const body = new FormData();
    body.append('image', file);
    return this.http
      .post<{ success: boolean; data: { image: string } }>(
        `${environment.apiUrl}api/client/${id}/image`,
        body,
        { withCredentials: true },
      )
      .pipe(tap((res) => this.patchImage(id, res.data.image)));
  }

  /** Remove a client's photo (clears the field and deletes the file server-side). */
  deleteImage(id: string): Observable<{ success: boolean; data: { image: string } }> {
    return this.http
      .delete<{ success: boolean; data: { image: string } }>(
        `${environment.apiUrl}api/client/${id}/image`,
        { withCredentials: true },
      )
      .pipe(tap(() => this.patchImage(id, '')));
  }

  private patchImage(id: string, image: string): void {
    this._clients.update((list) => list.map((c) => (c._id === id ? { ...c, image } : c)));
  }

  /** Resolve a stored `image` path to something an <img> can load. */
  imageUrl(image?: string | null): string {
    const value = (image || '').trim();
    if (!value) return '';
    if (/^(https?:\/\/|data:)/i.test(value)) return value;
    return `${environment.apiUrl}${value.replace(/^\/+/, '')}`;
  }

  getPayments(clientId: string): Observable<{ success: boolean; message: string; data: any[] }> {
    return this.http.get<{ success: boolean; message: string; data: any[] }>(
      `${environment.apiUrl}api/client/${clientId}/payments`,
      { withCredentials: true }
    );
  }

  /** Billing preview: completed + finalised tickets for a client, by mode. */
  getBilling(
    clientId: string,
    mode: BillingMode,
    from?: string,
    to?: string
  ): Observable<ClientBillingResponse> {
    let httpParams = new HttpParams().set('mode', mode);
    if (from) httpParams = httpParams.set('from', from);
    if (to) httpParams = httpParams.set('to', to);
    return this.http.get<ClientBillingResponse>(
      `${environment.apiUrl}api/client/${clientId}/billing`,
      { params: httpParams, withCredentials: true }
    );
  }

  /** Download the invoice PDF. A "current" run also flags the billed tickets. */
  downloadBillingPdf(
    clientId: string,
    mode: BillingMode,
    from?: string,
    to?: string
  ): Observable<Blob> {
    return this.http.post(
      `${environment.apiUrl}api/client/${clientId}/billing/pdf`,
      { mode, from: from || '', to: to || '' },
      { responseType: 'blob', withCredentials: true }
    );
  }
}

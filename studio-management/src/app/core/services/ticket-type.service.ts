import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import {
  TicketTypeDraft,
  TicketTypePatch,
  TicketTypeRecord,
} from '../models/ticketType.model';
import { environment } from '../../../environments/environment';

interface ListResponse {
  success: boolean;
  message: string;
  data: TicketTypeRecord[];
}

interface SingleResponse {
  success: boolean;
  message: string;
  data: TicketTypeRecord;
}

/**
 * The SA-only ticket type registry (`/sa/ticket-types`). Everyone else reads
 * the active types through TicketMetaService (`GET /api/ticket/form-meta`).
 */
@Injectable({ providedIn: 'root' })
export class TicketTypeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}api/ticket-type`;

  private readonly _types = signal<TicketTypeRecord[]>([]);
  readonly types = this._types.asReadonly();

  list(): Observable<ListResponse> {
    return this.http
      .get<ListResponse>(this.base)
      .pipe(tap((res) => this._types.set(res.data ?? [])));
  }

  create(draft: TicketTypeDraft): Observable<SingleResponse> {
    return this.http
      .post<SingleResponse>(this.base, draft)
      .pipe(tap((res) => this._types.update((list) => [...list, res.data])));
  }

  update(id: string, patch: TicketTypePatch): Observable<SingleResponse> {
    return this.http
      .put<SingleResponse>(`${this.base}/${id}`, patch)
      .pipe(
        tap((res) =>
          this._types.update((list) =>
            list.map((t) => (t._id === res.data._id ? res.data : t)),
          ),
        ),
      );
  }

  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .delete<{ success: boolean; message: string }>(`${this.base}/${id}`)
      .pipe(tap(() => this._types.update((list) => list.filter((t) => t._id !== id))));
  }
}

import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../env/env";
import { NotificationData } from "../../core/services/socket.service";

export type NotificationFilter = "all" | "unread";

export interface NotificationListResponse {
  success: boolean;
  data: NotificationData[];
  unreadCount: number;
}

export interface NotificationMutationResponse {
  success: boolean;
  message: string;
  data?: NotificationData;
}

@Injectable({ providedIn: "root" })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}api/notifications`;

  list(opts?: { filter?: NotificationFilter; includeDeleted?: boolean }): Observable<NotificationListResponse> {
    let params = new HttpParams();
    if (opts?.filter) params = params.set("filter", opts.filter);
    if (opts?.includeDeleted) params = params.set("includeDeleted", "true");
    return this.http.get<NotificationListResponse>(this.base, { params });
  }

  /** Toggle read state — WhatsApp-style: read on, read off. */
  setRead(id: string, isRead: boolean): Observable<NotificationMutationResponse> {
    return this.http.put<NotificationMutationResponse>(`${this.base}/read/${id}`, { isRead });
  }

  markAllRead(): Observable<NotificationMutationResponse> {
    return this.http.put<NotificationMutationResponse>(`${this.base}/read-all`, {});
  }

  /** Soft delete — hides it from the list until restored. */
  remove(id: string): Observable<NotificationMutationResponse> {
    return this.http.delete<NotificationMutationResponse>(`${this.base}/${id}`);
  }

  restore(id: string): Observable<NotificationMutationResponse> {
    return this.http.put<NotificationMutationResponse>(`${this.base}/${id}/restore`, {});
  }
}

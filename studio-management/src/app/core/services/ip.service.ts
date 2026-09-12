import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  IpRule,
  IpRuleDraft,
  IpSettings,
  IpStats,
  LoginEvent,
  PagedResponse,
  RequestLog,
} from '../models/ip.model';

interface Ok<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface LoginQuery {
  userId?: string;
  ip?: string;
  success?: 'true' | 'false';
  limit?: number;
  skip?: number;
}

export interface RequestQuery {
  userId?: string;
  ip?: string;
  method?: string;
  statusClass?: '1' | '2' | '3' | '4' | '5';
  path?: string;
  limit?: number;
  skip?: number;
}

@Injectable({ providedIn: 'root' })
export class IpService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}api/ip`;

  private toParams(q: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(q as Record<string, unknown>)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  whoami(): Observable<Ok<{ ip: string; userAgent: string }>> {
    return this.http.get<Ok<{ ip: string; userAgent: string }>>(`${this.base}/whoami`);
  }

  stats(): Observable<Ok<IpStats>> {
    return this.http.get<Ok<IpStats>>(`${this.base}/stats`);
  }

  listRules(): Observable<Ok<IpRule[]>> {
    return this.http.get<Ok<IpRule[]>>(`${this.base}/rules`);
  }

  createRule(draft: IpRuleDraft): Observable<Ok<IpRule>> {
    return this.http.post<Ok<IpRule>>(`${this.base}/rules`, draft);
  }

  updateRule(id: string, patch: Partial<IpRuleDraft>): Observable<Ok<IpRule>> {
    return this.http.put<Ok<IpRule>>(`${this.base}/rules/${id}`, patch);
  }

  deleteRule(id: string): Observable<Ok<IpRule>> {
    return this.http.delete<Ok<IpRule>>(`${this.base}/rules/${id}`);
  }

  getSettings(): Observable<Ok<IpSettings>> {
    return this.http.get<Ok<IpSettings>>(`${this.base}/settings`);
  }

  updateSettings(patch: Partial<IpSettings>): Observable<Ok<IpSettings>> {
    return this.http.put<Ok<IpSettings>>(`${this.base}/settings`, patch);
  }

  listLogins(query: LoginQuery = {}): Observable<PagedResponse<LoginEvent>> {
    return this.http.get<PagedResponse<LoginEvent>>(`${this.base}/logins`, {
      params: this.toParams(query),
    });
  }

  listRequests(query: RequestQuery = {}): Observable<PagedResponse<RequestLog>> {
    return this.http.get<PagedResponse<RequestLog>>(`${this.base}/requests`, {
      params: this.toParams(query),
    });
  }
}

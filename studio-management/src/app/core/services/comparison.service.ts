import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../env/env';
import { EmployeeComparisonResponse } from '../models/comparison.model';

@Injectable({ providedIn: 'root' })
export class ComparisonService {
  private readonly http = inject(HttpClient);

  getEmployees(from?: string, to?: string): Observable<EmployeeComparisonResponse> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<EmployeeComparisonResponse>(
      `${environment.apiUrl}api/comparison/employees`,
      { params, withCredentials: true },
    );
  }
}

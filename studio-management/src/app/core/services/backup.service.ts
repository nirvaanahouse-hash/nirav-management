import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface BackupResponse {
  success: boolean;
  message: string;
  data?: { name: string; link?: string; sizeBytes?: number };
}

@Injectable({ providedIn: "root" })
export class BackupService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  run(): Observable<BackupResponse> {
    return this.http.post<BackupResponse>(`${this.base}api/backup/run`, {});
  }
}

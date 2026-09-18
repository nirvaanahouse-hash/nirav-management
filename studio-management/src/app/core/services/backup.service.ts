import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpResponse } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface RestoreResponse {
  success: boolean;
  message: string;
  data?: { restoredCount: number; skippedCount: number };
}

@Injectable({ providedIn: "root" })
export class BackupService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /**
   * Full DB dump, sent back as a downloadable file. When Drive is set up
   * (see BE/config/google-drive.js) it's also uploaded there server-side —
   * the X-Drive-Status response header says whether that happened.
   */
  run(): Observable<HttpResponse<Blob>> {
    return this.http.post(`${this.base}api/backup/run`, {}, { responseType: "blob", observe: "response" });
  }

  /** A document whose _id already exists is left untouched, never overwritten. */
  restore(file: File): Observable<RestoreResponse> {
    const form = new FormData();
    form.append("backup", file);
    return this.http.post<RestoreResponse>(`${this.base}api/backup/restore`, form);
  }
}

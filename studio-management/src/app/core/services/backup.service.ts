import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class BackupService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /** Full DB dump, sent back as a downloadable file (not yet auto-uploaded to Drive). */
  run(): Observable<Blob> {
    return this.http.post(`${this.base}api/backup/run`, {}, { responseType: "blob" });
  }
}

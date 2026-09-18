import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpResponse } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

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
}

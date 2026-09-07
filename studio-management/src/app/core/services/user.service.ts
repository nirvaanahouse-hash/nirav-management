import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../env/env";
import { User } from "../../core/models/user.model";

export interface UserListResponse {
  success: boolean;
  data: User[];
}

export interface UserSelectOption {
  value: string;
  label: string;
}

@Injectable({ providedIn: "root" })
export class UserService {
  private readonly http = inject(HttpClient);

  list(params?: { search?: string; role?: string }): Observable<UserListResponse> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set("search", params.search);
    if (params?.role) httpParams = httpParams.set("role", params.role);
    return this.http.get<UserListResponse>(`${environment.apiUrl}api/users`, {
      params: httpParams,
      withCredentials: true,
    });
  }

  toSelectOptions(users: User[]): UserSelectOption[] {
    return users.map((u) => ({
      value: u._id,
      label: `${u.firstName} ${u.lastName} (${u.userName})`,
    }));
  }
}

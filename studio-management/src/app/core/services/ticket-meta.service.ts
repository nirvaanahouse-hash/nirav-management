import { Injectable, computed, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, map, tap } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  BadgeVariant,
  TICKET_TYPES,
  TICKET_TYPE_VARIANT,
} from "../constants/app.constants";

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
  /** For employee options: the user's SA-set profit share (%). */
  percentage?: number;
  /** For ticket-type options: the badge variant the SA picked. */
  variant?: BadgeVariant;
  /** For ticket-type options: hour-wise (JOB) pricing. */
  isJob?: boolean;
}

export interface TicketFormMeta {
  ticketTypes: SelectOption[];
  priorities: SelectOption[];
  statuses: SelectOption[];
  clients: SelectOption[];
  employees: SelectOption[];
}

interface TicketFormMetaResponse {
  success: boolean;
  message: string;
  data: TicketFormMeta;
}

const EMPTY_META: TicketFormMeta = {
  ticketTypes: [],
  priorities: [],
  statuses: [],
  clients: [],
  employees: [],
};

/**
 * Single source for every ticket-form dropdown. The backend
 * (`GET /api/ticket/form-meta`) returns the SA-managed ticket types plus the
 * enum options, active clients and employees in one payload.
 *
 * It is also the lookup for ticket-type labels and badge variants anywhere
 * they are displayed — the built-in constants are only the fallback for a
 * type that has since been deleted.
 */
@Injectable({ providedIn: "root" })
export class TicketMetaService {
  private readonly http = inject(HttpClient);

  private readonly _meta = signal<TicketFormMeta>(EMPTY_META);
  readonly meta = this._meta.asReadonly();

  /** Active ticket types, in the order the SA arranged them. */
  readonly ticketTypes = computed(() => this._meta().ticketTypes);

  private readonly typeIndex = computed(() => {
    const index = new Map<string, SelectOption>();
    this._meta().ticketTypes.forEach((t) => index.set(t.value, t));
    return index;
  });

  private loadedOnce = false;

  loadFormMeta(): Observable<TicketFormMeta> {
    return this.http
      .get<TicketFormMetaResponse>(`${environment.apiUrl}api/ticket/form-meta`, {
        withCredentials: true,
      })
      .pipe(
        map((res) => res.data ?? EMPTY_META),
        tap((meta) => {
          this._meta.set(meta);
          this.loadedOnce = true;
        }),
      );
  }

  /**
   * Fire-and-forget load for pages that only need labels / badge colours.
   * Runs once per session; a failure (e.g. no ticket permission) just leaves
   * the built-in fallbacks in place.
   */
  ensureLoaded(): void {
    if (this.loadedOnce) return;
    this.loadedOnce = true;
    this.loadFormMeta().subscribe({
      error: () => {
        this.loadedOnce = false;
      },
    });
  }

  /** Re-fetch after the SA changes the ticket type registry. */
  refresh(): void {
    this.loadFormMeta().subscribe({ error: () => {} });
  }

  typeLabel(key: string): string {
    return (
      this.typeIndex().get(key)?.label ??
      (TICKET_TYPES as Record<string, string>)[key] ??
      key
    );
  }

  typeVariant(key: string): BadgeVariant {
    return this.typeIndex().get(key)?.variant ?? TICKET_TYPE_VARIANT[key] ?? "neutral";
  }

  /** Hour-wise (JOB) types are priced HR × HR price. */
  isJobType(key: string): boolean {
    const option = this.typeIndex().get(key);
    return option ? !!option.isJob : key.endsWith("Job");
  }
}

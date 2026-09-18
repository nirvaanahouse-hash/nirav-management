import { DestroyRef, Injectable, inject, signal, computed, effect } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { io, Socket } from "socket.io-client";
import { AuthService } from "./auth.service";
import { environment } from "../../../environments/environment";
import { NotificationService } from "./notification.service";
import { TicketRecord } from "../models/task.model";
import { Client } from "../models/client.model";
import { User } from "../models/user.model";
import { AmountEntry } from "../models/amountEntry.model";
import { ChatMessage } from "../models/chat.model";

export interface NotificationData {
  _id: string;
  recipient: string;
  type: string;
  title: string;
  message: string;
  ticketId?: string;
  actorId?: string;
  isRead: boolean;
  /** false = soft-deleted (hidden unless "Show deleted" is on). */
  isView?: boolean;
  createdAt: string;
}

export type NotificationFilter = "all" | "unread";

export type TicketEvent =
  | "ticket-created"
  | "ticket-assigned"
  | "ticket-updated"
  | "ticket-completed"
  | "ticket-finalized"
  | "ticket-deleted";

export type ClientEvent = "client-created" | "client-updated" | "client-image";
export type EmployeeEvent = "employee-created" | "employee-updated" | "employee-deleted";
export type AmountEvent = "amount-created" | "amount-updated" | "amount-deleted";

@Injectable({ providedIn: "root" })
export class SocketService {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  private socket: Socket | null = null;

  private readonly _notifications = signal<NotificationData[]>([]);
  private readonly _unreadCount = signal(0);
  private readonly _loading = signal(false);

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly hasUnread = computed(() => this._unreadCount() > 0);
  readonly notificationsLoading = this._loading.asReadonly();

  /** Current dropdown view — the socket push respects this when prepending. */
  private viewFilter: NotificationFilter = "all";
  private viewIncludeDeleted = false;

  private readonly _connected = signal(false);
  readonly connected = this._connected.asReadonly();

  private connectEffect = effect(() => {
    const session = this.authService.session();
    if (session?.user) {
      this.connect();
    } else {
      this.disconnect();
    }
  });

  private connect(): void {
    if (this.socket?.connected) return;
    if (this.socket) this.socket.disconnect();

    // Token passed explicitly — no cookie-based auth exists anymore
    // (backend no longer reads a cookie at all, see server.js), so there's
    // nothing for the handshake to carry credentials for.
    this.socket = io(environment.apiUrl, {
      withCredentials: false,
      auth: { token: this.authService.getToken() },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      // Same ngrok free-tier interstitial bypass as auth.interceptor.ts — a
      // no-op against a normal host.
      extraHeaders: { "ngrok-skip-browser-warning": "true" },
    });

    this.socket.on("connect", () => {
      this._connected.set(true);
      this.fetchNotifications();
    });

    this.socket.on("disconnect", () => {
      this._connected.set(false);
    });

    this.socket.on("notification", (data: NotificationData) => {
      // A fresh push is always live (isView) and, on first arrival, unread —
      // so it belongs in both the "All" and "Unread" views.
      this._notifications.update((list) => {
        if (list.some((n) => n._id === data._id)) return list;
        return [{ ...data, isView: data.isView ?? true }, ...list].slice(0, 100);
      });
      if (!data.isRead) this._unreadCount.update((n) => n + 1);
    });

    // BE also emits this alongside every "notification" — the line above already
    // bumped the count, so this handler must not bump it again.
    this.socket.on("notification-count", () => {});

    (
      ["ticket-created", "ticket-assigned", "ticket-updated", "ticket-completed", "ticket-finalized", "ticket-deleted"] as TicketEvent[]
    ).forEach((event) => {
      this.socket?.on(event, (ticket: TicketRecord | { _id: string }) => {
        window.dispatchEvent(
          new CustomEvent("ticket-event", {
            detail: { type: event, ticket },
          })
        );
      });
    });

    (["client-created", "client-updated", "client-image"] as ClientEvent[]).forEach((event) => {
      this.socket?.on(event, (client: Partial<Client> & { _id: string }) => {
        window.dispatchEvent(new CustomEvent("client-event", { detail: { type: event, client } }));
      });
    });

    (["employee-created", "employee-updated", "employee-deleted"] as EmployeeEvent[]).forEach((event) => {
      this.socket?.on(event, (employee: Partial<User> & { _id: string }) => {
        window.dispatchEvent(new CustomEvent("employee-event", { detail: { type: event, employee } }));
      });
    });

    (["amount-created", "amount-updated", "amount-deleted"] as AmountEvent[]).forEach((event) => {
      this.socket?.on(event, (entry: Partial<AmountEntry> & { _id: string }) => {
        window.dispatchEvent(new CustomEvent("amount-event", { detail: { type: event, entry } }));
      });
    });

    // SA revoked/changed this user's permissions — the frontend's permission
    // cache (permission.service.ts) otherwise only refreshes at app
    // bootstrap, so a revoked permission would stay visible in the UI until
    // logout/refresh even though the backend already enforces it.
    this.socket.on("permissions-updated", () => {
      window.dispatchEvent(new CustomEvent("permissions-event"));
    });

    this.socket.on("message-new", (message: ChatMessage) => {
      window.dispatchEvent(new CustomEvent("message-event", { detail: { type: "message-new", message } }));
    });
    this.socket.on("message-read", (data: { withUserId: string }) => {
      window.dispatchEvent(new CustomEvent("message-event", { detail: { type: "message-read", withUserId: data.withUserId } }));
    });
  }

  private fetchNotifications(): void {
    this.loadNotifications(this.viewFilter, this.viewIncludeDeleted);
  }

  /** (Re)load the dropdown list for a given tab + "show deleted" state. */
  loadNotifications(filter: NotificationFilter = "all", includeDeleted = false): void {
    this.viewFilter = filter;
    this.viewIncludeDeleted = includeDeleted;
    this._loading.set(true);
    this.notificationService.list({ filter, includeDeleted }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this._notifications.set(response.data ?? []);
        if (response.unreadCount !== undefined) {
          this._unreadCount.set(response.unreadCount);
        }
        this._loading.set(false);
      },
      error: () => {
        this._notifications.set([]);
        this._loading.set(false);
      },
    });
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this._connected.set(false);
  }

  joinTicket(ticketId: string): void {
    this.socket?.emit("join-ticket", ticketId);
  }

  leaveTicket(ticketId: string): void {
    this.socket?.emit("leave-ticket", ticketId);
  }

  markAllNotificationsRead(): void {
    this.notificationService.markAllRead().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this._notifications.update((list) => list.map((n) => ({ ...n, isRead: true })));
        this._unreadCount.set(0);
      },
      error: () => {},
    });
  }

  /** WhatsApp-style read toggle — click marks read, click again marks unread. */
  toggleNotificationRead(id: string): void {
    const current = this._notifications().find((n) => n._id === id);
    if (!current) return;
    const next = !current.isRead;

    // Optimistic — keep the row visible in both tabs so it can be toggled back.
    this._notifications.update((list) =>
      list.map((n) => (n._id === id ? { ...n, isRead: next } : n)),
    );
    if (current.isView !== false) {
      this._unreadCount.update((n) => Math.max(0, n + (next ? -1 : 1)));
    }

    this.notificationService.setRead(id, next).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: () => {
        this._notifications.update((list) =>
          list.map((n) => (n._id === id ? { ...n, isRead: current.isRead } : n)),
        );
        if (current.isView !== false) {
          this._unreadCount.update((n) => Math.max(0, n + (next ? 1 : -1)));
        }
      },
    });
  }

  deleteNotification(id: string): void {
    const current = this._notifications().find((n) => n._id === id);
    if (!current) return;

    if (current.isView !== false && !current.isRead) {
      this._unreadCount.update((n) => Math.max(0, n - 1));
    }
    this._notifications.update((list) =>
      this.viewIncludeDeleted
        ? list.map((n) => (n._id === id ? { ...n, isView: false } : n))
        : list.filter((n) => n._id !== id),
    );

    this.notificationService.remove(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: () => this.loadNotifications(this.viewFilter, this.viewIncludeDeleted),
    });
  }

  restoreNotification(id: string): void {
    const current = this._notifications().find((n) => n._id === id);
    if (!current) return;

    if (!current.isRead) this._unreadCount.update((n) => n + 1);
    this._notifications.update((list) =>
      list.map((n) => (n._id === id ? { ...n, isView: true } : n)),
    );

    this.notificationService.restore(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: () => this.loadNotifications(this.viewFilter, this.viewIncludeDeleted),
    });
  }
}

import { Injectable, inject, signal, computed, effect } from "@angular/core";
import { io, Socket } from "socket.io-client";
import { AuthService } from "./auth.service";
import { environment } from "../../../environments/environment";
import { NotificationService } from "./notification.service";
import { TicketRecord } from "../models/task.model";

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
  | "ticket-assigned"
  | "ticket-updated"
  | "ticket-completed"
  | "ticket-finalized";

@Injectable({ providedIn: "root" })
export class SocketService {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

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

    // Passed explicitly rather than relying on the handshake's cookie —
    // Safari's ITP blocks that cookie once frontend/backend are cross-site.
    // The backend already checks socket.handshake.auth.token first.
    this.socket = io(environment.apiUrl, {
      withCredentials: true,
      auth: { token: this.authService.getToken() },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
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

    (["ticket-assigned", "ticket-updated", "ticket-completed", "ticket-finalized"] as TicketEvent[]).forEach(
      (event) => {
        this.socket?.on(event, (ticket: TicketRecord) => {
          window.dispatchEvent(
            new CustomEvent("ticket-event", {
              detail: { type: event, ticket },
            })
          );
        });
      }
    );
  }

  private fetchNotifications(): void {
    this.loadNotifications(this.viewFilter, this.viewIncludeDeleted);
  }

  /** (Re)load the dropdown list for a given tab + "show deleted" state. */
  loadNotifications(filter: NotificationFilter = "all", includeDeleted = false): void {
    this.viewFilter = filter;
    this.viewIncludeDeleted = includeDeleted;
    this._loading.set(true);
    this.notificationService.list({ filter, includeDeleted }).subscribe({
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
    this.notificationService.markAllRead().subscribe({
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

    this.notificationService.setRead(id, next).subscribe({
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

    this.notificationService.remove(id).subscribe({
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

    this.notificationService.restore(id).subscribe({
      error: () => this.loadNotifications(this.viewFilter, this.viewIncludeDeleted),
    });
  }
}

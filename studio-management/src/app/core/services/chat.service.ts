import { Injectable, computed, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { environment } from "../../../environments/environment";
import { AuthService } from "./auth.service";
import { ChatContact, ChatMessage } from "../models/chat.model";

export interface ContactsResponse {
  success: boolean;
  data: ChatContact[];
}

export interface ThreadResponse {
  success: boolean;
  data: ChatMessage[];
}

export interface SendMessageResponse {
  success: boolean;
  message: string;
  data: ChatMessage;
}

/**
 * SA <-> employee chat. Holds the contact list (with live last-message/unread
 * previews) and whichever thread is currently open, both kept live by the
 * "message-event" DOM event socket.service.ts dispatches — same in-place
 * upsert pattern as TaskService/ClientService, see TaskService's constructor
 * for why that matters for pagination (not applicable here, but the "always
 * merge, never refetch" rule is the same).
 */
@Injectable({ providedIn: "root" })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiUrl}api/messages`;

  private readonly _contacts = signal<ChatContact[]>([]);
  private readonly _thread = signal<ChatMessage[]>([]);
  private readonly _activeContactId = signal<string | null>(null);

  readonly contacts = this._contacts.asReadonly();
  readonly thread = this._thread.asReadonly();
  readonly activeContactId = this._activeContactId.asReadonly();
  readonly totalUnread = computed(() => this._contacts().reduce((sum, c) => sum + c.unreadCount, 0));

  constructor() {
    window.addEventListener("message-event", ((
      e: CustomEvent<{ type: string; message?: ChatMessage; withUserId?: string }>,
    ) => {
      const { type, message, withUserId } = e.detail;
      if (type === "message-new" && message) {
        this.onIncoming(message);
      } else if (type === "message-read" && withUserId) {
        this.onRead(withUserId);
      }
    }) as EventListener);
  }

  private get myId(): string | null {
    return this.auth.currentUser()?._id ?? null;
  }

  private onIncoming(msg: ChatMessage): void {
    const myId = this.myId;
    const otherId = msg.sender === myId ? msg.recipient : msg.sender;
    const fromThem = msg.sender === otherId && msg.sender !== myId;

    if (this._activeContactId() === otherId) {
      this._thread.update((list) => (list.some((m) => m._id === msg._id) ? list : [...list, msg]));
      if (fromThem) this.markRead(otherId);
    }

    this._contacts.update((list) =>
      list.map((c) =>
        c._id === otherId
          ? {
              ...c,
              lastMessage: msg.text,
              lastMessageAt: msg.createdAt,
              lastMessageFromMe: msg.sender === myId,
              unreadCount: fromThem && this._activeContactId() !== otherId ? c.unreadCount + 1 : c.unreadCount,
            }
          : c,
      ),
    );
  }

  private onRead(withUserId: string): void {
    if (this._activeContactId() === withUserId) {
      this._thread.update((list) => list.map((m) => ({ ...m, isRead: true })));
    }
  }

  loadContacts(): Observable<ContactsResponse> {
    return this.http
      .get<ContactsResponse>(`${this.base}/contacts`)
      .pipe(tap((res) => this._contacts.set(res.data)));
  }

  /** Open a thread: loads its history and marks incoming messages read. */
  openThread(contactId: string): Observable<ThreadResponse> {
    this._activeContactId.set(contactId);
    this._thread.set([]);
    return this.http.get<ThreadResponse>(`${this.base}/${contactId}`).pipe(
      tap((res) => {
        this._thread.set(res.data);
        if (res.data.some((m) => m.sender === contactId && !m.isRead)) {
          this.markRead(contactId);
        }
      }),
    );
  }

  closeThread(): void {
    this._activeContactId.set(null);
    this._thread.set([]);
  }

  send(recipient: string, text: string): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>(this.base, { recipient, text }).pipe(
      tap((res) => {
        this._thread.update((list) => (list.some((m) => m._id === res.data._id) ? list : [...list, res.data]));
        this._contacts.update((list) =>
          list.map((c) =>
            c._id === recipient
              ? { ...c, lastMessage: res.data.text, lastMessageAt: res.data.createdAt, lastMessageFromMe: true }
              : c,
          ),
        );
      }),
    );
  }

  markRead(contactId: string): void {
    this.http.put(`${this.base}/read/${contactId}`, {}).subscribe({
      next: () => {
        this._contacts.update((list) => list.map((c) => (c._id === contactId ? { ...c, unreadCount: 0 } : c)));
      },
      error: () => {},
    });
  }

  /** Resolve a stored `image` path to something an <img> can load. */
  imageUrl(image?: string | null): string {
    if (!image) return "";
    if (/^(data:|blob:|https?:\/\/)/i.test(image)) return image;
    return `${environment.apiUrl}${image.replace(/^\/+/, "")}`;
  }
}

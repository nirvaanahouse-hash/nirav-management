import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { AvatarComponent } from "../../shared/components/avatar/avatar.component";
import { ButtonComponent } from "../../shared/components/button/button";
import { ChatService } from "../../core/services/chat.service";
import { AuthService } from "../../core/services/auth.service";
import { ToastService } from "../toast/toast.service";
import { ChatContact } from "../../core/models/chat.model";

@Component({
  selector: "app-messages",
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, AvatarComponent, ButtonComponent],
  templateUrl: "./messages.component.html",
  styleUrl: "./messages.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagesComponent {
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly scrollAnchor = viewChild<ElementRef<HTMLDivElement>>("scrollAnchor");

  readonly loading = signal(true);
  readonly threadLoading = signal(false);
  readonly sending = signal(false);
  readonly draft = signal("");

  readonly contacts = this.chat.contacts;
  readonly thread = this.chat.thread;
  readonly activeContactId = this.chat.activeContactId;
  readonly myId = computed(() => this.auth.currentUser()?._id ?? "");
  readonly isSA = computed(() => this.auth.role() === "SA");

  readonly activeContact = computed<ChatContact | null>(() => {
    const id = this.activeContactId();
    if (!id) return null;
    return this.contacts().find((c) => c._id === id) ?? null;
  });

  constructor() {
    this.chat.loadContacts().pipe(takeUntilDestroyed()).subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.toast.error("Could not load conversations", "Please try again.");
        this.loading.set(false);
      },
    });

    // Auto-scroll to the newest message whenever the open thread changes —
    // covers both loading a thread and a new message (own or incoming)
    // landing in it live.
    effect(() => {
      this.thread();
      queueMicrotask(() => {
        this.scrollAnchor()?.nativeElement.scrollIntoView({ block: "end" });
      });
    });
  }

  openThread(contact: ChatContact): void {
    if (this.activeContactId() === contact._id) return;
    this.threadLoading.set(true);
    this.chat.openThread(contact._id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.threadLoading.set(false),
      error: () => {
        this.toast.error("Could not load messages", "Please try again.");
        this.threadLoading.set(false);
      },
    });
  }

  backToList(): void {
    this.chat.closeThread();
  }

  send(): void {
    const text = this.draft().trim();
    const contactId = this.activeContactId();
    if (!text || !contactId || this.sending()) return;

    this.sending.set(true);
    this.chat.send(contactId, text).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.draft.set("");
        this.sending.set(false);
      },
      error: () => {
        this.toast.error("Could not send message", "Please try again.");
        this.sending.set(false);
      },
    });
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  relativeTime(iso: string | null): string {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString();
  }

  messageTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

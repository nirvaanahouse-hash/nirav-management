import { Injectable, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";

interface PublicKeyResponse {
  success: boolean;
  data: { publicKey: string; enabled: boolean };
}

/** VAPID keys arrive base64url-encoded; PushManager.subscribe wants a raw
 *  Uint8Array. Standard conversion — see the Web Push spec / MDN. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

/**
 * Browser push notifications (Web Push) — separate from the in-app
 * notification bell (Socket.IO): this reaches the user even when the tab is
 * backgrounded or the browser itself is closed, via the OS notification
 * centre. Requires the user's explicit permission grant; never prompts on
 * its own — `init()` only silently re-syncs an already-granted subscription.
 */
@Injectable({ providedIn: "root" })
export class PushNotificationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}api/push`;
  private registration: ServiceWorkerRegistration | null = null;

  readonly supported =
    typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof PushManager !== "undefined";

  readonly permission = signal<NotificationPermission>(
    this.supported ? Notification.permission : "denied",
  );
  readonly subscribed = signal(false);
  readonly busy = signal(false);

  /** Call once at app start. Registers the service worker and reflects
   *  whatever subscription this browser already holds — no permission
   *  prompt, so it is safe to call unconditionally on every load. */
  async init(): Promise<void> {
    if (!this.supported) return;
    try {
      this.registration = await navigator.serviceWorker.register("/sw-push.js");
      const existing = await this.registration.pushManager.getSubscription();
      this.subscribed.set(!!existing);
    } catch {
      // Registration can fail (offline, restrictive embed) — the Enable
      // toggle just retries on click, so there is nothing else to do here.
    }
  }

  async enable(): Promise<boolean> {
    if (!this.supported || this.busy()) return false;
    this.busy.set(true);
    try {
      const permission = await Notification.requestPermission();
      this.permission.set(permission);
      if (permission !== "granted") return false;

      const reg = this.registration ?? (this.registration = await navigator.serviceWorker.register("/sw-push.js"));

      const keyRes = await firstValueFrom(this.http.get<PublicKeyResponse>(`${this.base}/public-key`));
      if (!keyRes.data.enabled || !keyRes.data.publicKey) return false;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyRes.data.publicKey) as BufferSource,
        });
      }

      const json = sub.toJSON();
      await firstValueFrom(
        this.http.post(`${this.base}/subscribe`, { endpoint: json.endpoint, keys: json.keys }),
      );
      this.subscribed.set(true);
      return true;
    } catch {
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    if (!this.registration) return;
    this.busy.set(true);
    try {
      const sub = await this.registration.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await firstValueFrom(this.http.delete(`${this.base}/subscribe`, { body: { endpoint } }));
      }
      this.subscribed.set(false);
    } finally {
      this.busy.set(false);
    }
  }
}

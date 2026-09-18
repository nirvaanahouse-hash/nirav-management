import { Directive, ElementRef, OnDestroy, effect, inject, input } from "@angular/core";
import { HttpClient } from "@angular/common/http";

/**
 * A plain <img src="..."> is a browser-initiated request that can't carry
 * custom headers, so it never gets the "ngrok-skip-browser-warning" header
 * auth.interceptor.ts adds to HttpClient calls — behind the ngrok free tier
 * that means it hits the HTML interstitial instead of the image bytes and
 * silently fails to render. Fetching through HttpClient and swapping in a
 * blob URL sidesteps that.
 */
@Directive({
  selector: "img[appRemoteSrc]",
  standalone: true,
})
export class RemoteImageDirective implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly el = inject(ElementRef<HTMLImageElement>);
  private objectUrl: string | null = null;

  readonly appRemoteSrc = input<string | null | undefined>();

  constructor() {
    effect(() => {
      const url = (this.appRemoteSrc() || "").trim();
      this.revoke();

      if (!url) {
        this.el.nativeElement.removeAttribute("src");
        return;
      }

      this.http.get(url, { responseType: "blob" }).subscribe({
        next: (blob) => {
          this.objectUrl = URL.createObjectURL(blob);
          this.el.nativeElement.src = this.objectUrl;
        },
        // Preserve native <img> error behavior (e.g. avatar's initials fallback).
        error: () => this.el.nativeElement.dispatchEvent(new Event("error")),
      });
    });
  }

  ngOnDestroy(): void {
    this.revoke();
  }

  private revoke(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

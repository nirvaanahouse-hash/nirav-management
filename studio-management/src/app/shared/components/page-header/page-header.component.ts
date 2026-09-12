import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** Curated palette so each page reads as visually distinct rather than
 *  every header looking like the same grey/teal text block. Values are
 *  fixed (not theme tokens) — a soft tinted badge like this needs to stay
 *  readable in both Light and Dark without a per-theme override table. */
export type PageHeaderAccent =
  | "teal"
  | "blue"
  | "purple"
  | "amber"
  | "rose"
  | "indigo"
  | "cyan"
  | "emerald";

const ACCENT_COLORS: Record<PageHeaderAccent, { fg: string; bg: string }> = {
  teal: { fg: "#0F766E", bg: "rgba(15, 118, 110, 0.14)" },
  blue: { fg: "#2563A8", bg: "rgba(37, 99, 168, 0.14)" },
  purple: { fg: "#7C3AED", bg: "rgba(124, 58, 237, 0.14)" },
  amber: { fg: "#B8790C", bg: "rgba(184, 121, 12, 0.14)" },
  rose: { fg: "#C4344A", bg: "rgba(196, 52, 74, 0.14)" },
  indigo: { fg: "#4338CA", bg: "rgba(67, 56, 202, 0.14)" },
  cyan: { fg: "#0E7490", bg: "rgba(14, 116, 144, 0.14)" },
  emerald: { fg: "#1D8A5E", bg: "rgba(29, 138, 94, 0.14)" },
};

/**
 * Consistent page heading: an accent-colored icon badge + title + optional
 * subtitle on the left, an optional actions slot on the right. Project the
 * icon with `<svg icon>…</svg>` and actions with `<span actions>…</span>`
 * (usually an `app-button`). Every page should pass its own `icon`/`accent`
 * so the header reads as "this page", not an interchangeable label.
 */
@Component({
  selector: "app-page-header",
  standalone: true,
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <div class="page-header__title-row">
          <span
            class="page-header__icon"
            [style.color]="colors().fg"
            [style.background]="colors().bg"
          >
            <ng-content select="[icon]" />
          </span>
          <h2 class="page-header__title">{{ title() }}</h2>
        </div>
        @if (subtitle()) {
          <p class="page-header__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
  styleUrl: "./page-header.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  title = input.required<string>();
  subtitle = input<string>("");
  accent = input<PageHeaderAccent>("teal");

  protected colors() {
    return ACCENT_COLORS[this.accent()];
  }
}

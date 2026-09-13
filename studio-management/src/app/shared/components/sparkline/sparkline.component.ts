import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

const W = 120;
const H = 36;

/** Minimal trend sparkline — no axes, no labels. Colour follows the trend. */
@Component({
  selector: "app-sparkline",
  standalone: true,
  template: `
    <svg
      class="spark"
      [attr.viewBox]="vb"
      preserveAspectRatio="none"
      [class.spark--up]="trend() === 'up'"
      [class.spark--down]="trend() === 'down'"
    >
      <defs>
        <linearGradient [attr.id]="gradId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.24" />
          <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
        </linearGradient>
      </defs>
      @if (area()) {
        <path class="spark__area" [attr.d]="area()" [attr.fill]="'url(#' + gradId + ')'" />
      }
      @if (line()) {
        <path class="spark__line" [attr.d]="line()" vector-effect="non-scaling-stroke" />
      }
    </svg>
  `,
  styles: [
    `
      :host { display: block; width: 100%; color: var(--text-muted); }
      :host .spark--up { color: var(--success); }
      :host .spark--down { color: var(--danger); }
      .spark { width: 100%; height: 36px; display: block; overflow: visible; }
      .spark__line { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      .spark__area { stroke: none; }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SparklineComponent {
  values = input<number[]>([]);
  trend = input<"up" | "down" | "flat">("flat");

  readonly vb = `0 0 ${W} ${H}`;
  readonly gradId = `spark-${Math.random().toString(36).slice(2, 8)}`;

  private readonly pts = computed(() => {
    const v = this.values();
    const n = v.length;
    if (n < 2) return [];
    const min = Math.min(...v);
    const max = Math.max(...v);
    const span = max - min || 1;
    return v.map((val, i) => ({
      x: (i / (n - 1)) * W,
      y: H - 2 - ((val - min) / span) * (H - 4),
    }));
  });

  readonly line = computed(() => {
    const p = this.pts();
    if (!p.length) return "";
    return p.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  });

  readonly area = computed(() => {
    const p = this.pts();
    if (!p.length) return "";
    return (
      `M${p[0].x.toFixed(1)},${H} ` +
      p.map((q) => `L${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ") +
      ` L${p[p.length - 1].x.toFixed(1)},${H} Z`
    );
  });
}

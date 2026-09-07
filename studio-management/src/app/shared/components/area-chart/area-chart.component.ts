import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  signal,
  viewChild,
} from "@angular/core";

export interface ChartPoint {
  label: string;
  value: number;
}

const W = 760;
const H = 280;
const PAD = { l: 52, r: 18, t: 18, b: 30 };

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  // round up to a "nice" step (half-magnitude granularity) so the plot fills the height
  const step = mag <= 1 ? 1 : mag / 2;
  return Math.ceil(v / step) * step;
}

/**
 * Single-series area + line chart. Pure SVG, themed with CSS tokens so it
 * adapts to light/dark automatically. Crosshair + tooltip on hover.
 */
@Component({
  selector: "app-area-chart",
  standalone: true,
  templateUrl: "./area-chart.component.html",
  styleUrl: "./area-chart.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AreaChartComponent {
  points = input<ChartPoint[]>([]);
  /** How to format a value for the axis and tooltip. */
  kind = input<"count" | "currency">("count");
  /** 'area' = gradient area + line; 'bars' = rounded bars on a faint track. */
  mode = input<"area" | "bars">("area");
  /** 'hero' = smooth spline, no gridlines/axis text, deeper fill. */
  variant = input<"full" | "hero">("full");

  readonly svgRef = viewChild<ElementRef<SVGSVGElement>>("svg");
  readonly hoverIndex = signal<number | null>(null);

  readonly vb = `0 0 ${W} ${H}`;

  get plot() {
    const left = this.variant() === "hero" ? 10 : PAD.l;
    return { x0: left, x1: W - PAD.r, y0: PAD.t, y1: H - PAD.b };
  }

  private smooth(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) {
      return pts.length ? `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}` : "";
    }
    const t = 0.18;
    const out = [`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) * t;
      const c1y = p1.y + (p2.y - p0.y) * t;
      const c2x = p2.x - (p3.x - p1.x) * t;
      const c2y = p2.y - (p3.y - p1.y) * t;
      out.push(
        `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
      );
    }
    return out.join(" ");
  }

  private readonly max = computed(() =>
    niceCeil(Math.max(1, ...this.points().map((p) => p.value))),
  );

  readonly coords = computed(() => {
    const pts = this.points();
    const n = pts.length;
    const { x0, x1, y0, y1 } = this.plot;
    const max = this.max();
    return pts.map((p, i) => ({
      ...p,
      x: n <= 1 ? (x0 + x1) / 2 : x0 + (i / (n - 1)) * (x1 - x0),
      y: y1 - (p.value / max) * (y1 - y0),
    }));
  });

  readonly linePath = computed(() => {
    const c = this.coords();
    if (!c.length) return "";
    if (this.variant() === "hero") return this.smooth(c);
    return c.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  });

  readonly areaPath = computed(() => {
    const c = this.coords();
    if (!c.length) return "";
    const base = this.plot.y1;
    if (this.variant() === "hero") {
      const top = this.smooth(c).slice(1); // drop leading "M"
      return `M${c[0].x.toFixed(1)},${base} L${top} L${c[c.length - 1].x.toFixed(1)},${base} Z`;
    }
    return (
      `M${c[0].x.toFixed(1)},${base} ` +
      c.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
      ` L${c[c.length - 1].x.toFixed(1)},${base} Z`
    );
  });

  /** Rounded bars sitting on a faint full-height track. */
  readonly bars = computed(() => {
    const c = this.coords();
    const n = c.length;
    if (!n) return [];
    const { x0, x1, y0, y1 } = this.plot;
    const slot = (x1 - x0) / n;
    const w = Math.max(4, Math.min(30, slot * 0.6));
    const peakVal = Math.max(...c.map((p) => p.value));
    return c.map((p, i) => {
      const cx = n === 1 ? (x0 + x1) / 2 : x0 + (i + 0.5) * slot;
      return {
        i,
        label: p.label,
        value: p.value,
        x: cx - w / 2,
        w,
        y: p.y,
        h: Math.max(0, y1 - p.y),
        trackY: y0,
        trackH: y1 - y0,
        peak: p.value === peakVal && peakVal > 0,
      };
    });
  });

  /** 4 gridlines / y-axis ticks. */
  readonly yTicks = computed(() => {
    const max = this.max();
    const { y0, y1 } = this.plot;
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      v: max * f,
      y: y1 - f * (y1 - y0),
    }));
  });

  /** X labels, thinned so they never collide. */
  readonly xLabels = computed(() => {
    const c = this.coords();
    const n = c.length;
    if (!n) return [];
    const stride = Math.max(1, Math.ceil(n / 8));
    return c
      .map((p, i) => ({ ...p, show: i === 0 || i === n - 1 || i % stride === 0 }))
      .filter((p) => p.show);
  });

  readonly hovered = computed(() => {
    const i = this.hoverIndex();
    return i == null ? null : this.coords()[i] ?? null;
  });

  readonly hoveredBar = computed(() => {
    const i = this.hoverIndex();
    return i == null ? null : this.bars()[i] ?? null;
  });

  format(v: number): string {
    if (this.kind() === "currency") {
      const abs = Math.abs(v);
      if (abs >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
      if (abs >= 1_000) return `₹${(v / 1_000).toFixed(1)}k`;
      return `₹${Math.round(v)}`;
    }
    return `${Math.round(v)}`;
  }

  onMove(evt: MouseEvent): void {
    const svg = this.svgRef()?.nativeElement;
    const n = this.points().length;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * W;
    const { x0, x1 } = this.plot;
    const ratio = Math.min(1, Math.max(0, (px - x0) / (x1 - x0)));
    const idx =
      this.mode() === "bars"
        ? Math.min(n - 1, Math.max(0, Math.floor(ratio * n)))
        : Math.round(ratio * (n - 1));
    this.hoverIndex.set(idx);
  }

  clearHover(): void {
    this.hoverIndex.set(null);
  }

  /** Tooltip left offset as a % of chart width. */
  tooltipLeft(x: number): string {
    return `${((x / W) * 100).toFixed(2)}%`;
  }
}

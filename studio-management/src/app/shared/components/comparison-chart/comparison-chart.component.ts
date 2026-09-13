import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ChartPoint } from '../area-chart/area-chart.component';

export interface CompareSeries {
  label: string;
  kind: 'count' | 'currency';
  points: ChartPoint[];
}

const W = 760;
const H = 300;
const PAD = { l: 16, r: 16, t: 24, b: 24 };
const MIDY = H / 2;

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const step = mag <= 1 ? 1 : mag / 2;
  return Math.ceil(v / step) * step;
}

/**
 * Mirrored diverging-area comparison of two metrics over the same time
 * buckets. Series A rises as a filled area above a centre axis, series B
 * as a filled area below it — each scaled to its own peak so the shapes
 * stay comparable. Pure SVG, theme-token colours.
 */
@Component({
  selector: 'app-comparison-chart',
  standalone: true,
  templateUrl: './comparison-chart.component.html',
  styleUrl: './comparison-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparisonChartComponent {
  seriesA = input.required<CompareSeries>();
  seriesB = input.required<CompareSeries>();

  readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svg');
  readonly hoverIndex = signal<number | null>(null);
  readonly entered = signal(false);

  readonly vb = `0 0 ${W} ${H}`;
  readonly midY = MIDY;
  readonly plot = { x0: PAD.l, x1: W - PAD.r, yTop: PAD.t, yBot: H - PAD.b };

  constructor() {
    afterNextRender(() => setTimeout(() => this.entered.set(true), 30));
  }

  private readonly maxA = computed(() =>
    niceCeil(Math.max(1, ...this.seriesA().points.map((p) => Math.abs(p.value)))),
  );
  private readonly maxB = computed(() =>
    niceCeil(Math.max(1, ...this.seriesB().points.map((p) => Math.abs(p.value)))),
  );

  /** One point per bucket: shared x position, and a y for each series's
   *  mirrored area (A above the axis, B below it). */
  readonly coords = computed(() => {
    const a = this.seriesA().points;
    const b = this.seriesB().points;
    const n = Math.max(a.length, b.length);
    if (!n) return [];
    const { x0, x1, yTop, yBot } = this.plot;
    const topH = MIDY - yTop;
    const botH = yBot - MIDY;
    const maxA = this.maxA();
    const maxB = this.maxB();

    return Array.from({ length: n }, (_, i) => {
      const va = a[i]?.value ?? 0;
      const vb = b[i]?.value ?? 0;
      const x = n <= 1 ? (x0 + x1) / 2 : x0 + (i / (n - 1)) * (x1 - x0);
      return {
        i,
        label: a[i]?.label ?? b[i]?.label ?? '',
        va,
        vb,
        x,
        ay: MIDY - (Math.abs(va) / maxA) * topH,
        by: MIDY + (Math.abs(vb) / maxB) * botH,
      };
    });
  });

  private smooth(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) {
      return pts.length ? `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}` : '';
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
    return out.join(' ');
  }

  readonly lineA = computed(() => this.smooth(this.coords().map((c) => ({ x: c.x, y: c.ay }))));
  readonly lineB = computed(() => this.smooth(this.coords().map((c) => ({ x: c.x, y: c.by }))));

  readonly areaA = computed(() => {
    const c = this.coords();
    if (!c.length) return '';
    const top = this.smooth(c.map((p) => ({ x: p.x, y: p.ay }))).slice(1);
    return `M${c[0].x.toFixed(1)},${MIDY} L${top} L${c[c.length - 1].x.toFixed(1)},${MIDY} Z`;
  });

  readonly areaB = computed(() => {
    const c = this.coords();
    if (!c.length) return '';
    const bottom = this.smooth(c.map((p) => ({ x: p.x, y: p.by }))).slice(1);
    return `M${c[0].x.toFixed(1)},${MIDY} L${bottom} L${c[c.length - 1].x.toFixed(1)},${MIDY} Z`;
  });

  readonly xLabels = computed(() => {
    const c = this.coords();
    const n = c.length;
    const stride = Math.max(1, Math.ceil(n / 8));
    return c.filter((_, i) => i === 0 || i === n - 1 || i % stride === 0);
  });

  readonly totalA = computed(() =>
    this.seriesA().points.reduce((s, p) => s + p.value, 0),
  );
  readonly totalB = computed(() =>
    this.seriesB().points.reduce((s, p) => s + p.value, 0),
  );

  readonly hovered = computed(() => {
    const i = this.hoverIndex();
    return i == null ? null : this.coords()[i] ?? null;
  });

  fmt(v: number, kind: 'count' | 'currency'): string {
    if (kind === 'currency') {
      const abs = Math.abs(v);
      if (abs >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
      if (abs >= 1_000) return `₹${(v / 1_000).toFixed(1)}k`;
      return `₹${Math.round(v)}`;
    }
    return `${Math.round(v)}`;
  }

  deltaLabel(): string {
    const h = this.hovered();
    if (!h) return '';
    const a = h.va;
    const b = h.vb;
    if (a === 0 && b === 0) return '0%';
    const base = Math.max(Math.abs(a), Math.abs(b)) || 1;
    const pct = Math.round(((a - b) / base) * 100);
    return `${pct > 0 ? '+' : ''}${pct}%`;
  }

  onMove(evt: MouseEvent): void {
    const svg = this.svgRef()?.nativeElement;
    const n = this.coords().length;
    if (!svg || !n) return;
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * W;
    const { x0, x1 } = this.plot;
    const ratio = Math.min(1, Math.max(0, (px - x0) / (x1 - x0)));
    this.hoverIndex.set(Math.round(ratio * (n - 1)));
  }

  clearHover(): void {
    this.hoverIndex.set(null);
  }

  tooltipLeft(x: number): string {
    return `${((x / W) * 100).toFixed(2)}%`;
  }
}

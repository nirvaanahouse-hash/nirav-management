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
 * Mirrored diverging-bar comparison of two metrics over the same time buckets.
 * Series A grows up from a centre axis, series B grows down — each scaled to its
 * own peak so the shapes stay comparable. Pure SVG, theme-token colours.
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

  readonly bars = computed(() => {
    const a = this.seriesA().points;
    const b = this.seriesB().points;
    const n = Math.max(a.length, b.length);
    if (!n) return [];
    const { x0, x1, yTop, yBot } = this.plot;
    const slot = (x1 - x0) / n;
    const w = Math.max(4, Math.min(30, slot * 0.55));
    const topH = MIDY - yTop;
    const botH = yBot - MIDY;
    const maxA = this.maxA();
    const maxB = this.maxB();

    return Array.from({ length: n }, (_, i) => {
      const va = a[i]?.value ?? 0;
      const vb = b[i]?.value ?? 0;
      const cx = x0 + (i + 0.5) * slot;
      const ha = (Math.abs(va) / maxA) * topH;
      const hb = (Math.abs(vb) / maxB) * botH;
      return {
        i,
        label: a[i]?.label ?? b[i]?.label ?? '',
        va,
        vb,
        x: cx - w / 2,
        w,
        aY: MIDY - ha,
        aH: ha,
        bY: MIDY,
        bH: hb,
        cx,
      };
    });
  });

  readonly xLabels = computed(() => {
    const bars = this.bars();
    const n = bars.length;
    const stride = Math.max(1, Math.ceil(n / 8));
    return bars.filter((_, i) => i === 0 || i === n - 1 || i % stride === 0);
  });

  readonly totalA = computed(() =>
    this.seriesA().points.reduce((s, p) => s + p.value, 0),
  );
  readonly totalB = computed(() =>
    this.seriesB().points.reduce((s, p) => s + p.value, 0),
  );

  readonly hovered = computed(() => {
    const i = this.hoverIndex();
    return i == null ? null : this.bars()[i] ?? null;
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
    const n = this.bars().length;
    if (!svg || !n) return;
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * W;
    const { x0, x1 } = this.plot;
    const ratio = Math.min(1, Math.max(0, (px - x0) / (x1 - x0)));
    this.hoverIndex.set(Math.min(n - 1, Math.max(0, Math.floor(ratio * n))));
  }

  clearHover(): void {
    this.hoverIndex.set(null);
  }

  tooltipLeft(x: number): string {
    return `${((x / W) * 100).toFixed(2)}%`;
  }
}

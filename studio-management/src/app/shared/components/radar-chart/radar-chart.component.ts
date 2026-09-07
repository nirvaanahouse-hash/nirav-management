import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface RadarAxis {
  label: string;
}

export interface RadarSeries {
  label: string;
  /** One value per axis, already normalised to 0..1 by the caller. */
  values: number[];
  /** CSS colour (defaults cycle accent / info / warning). */
  color?: string;
}

const SIZE = 300;
const C = SIZE / 2;
const R = 110;
const RINGS = [0.25, 0.5, 0.75, 1];
const DEFAULT_COLORS = ['var(--accent)', 'var(--info)', 'var(--warning)'];

/**
 * Pure-SVG polygon radar chart. Compares up to 3 series across shared axes.
 * Theme-token colours so it adapts to light / dark automatically.
 */
@Component({
  selector: 'app-radar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }
      .radar { width: 100%; height: auto; overflow: visible; }
      .radar__ring { fill: none; stroke: var(--border-subtle); }
      .radar__spoke { stroke: var(--border-subtle); }
      .radar__axis-label {
        fill: var(--text-muted);
        font-size: 11px;
        font-weight: 600;
      }
      .radar__poly { fill-opacity: 0.16; stroke-width: 2; stroke-linejoin: round; }
      .radar__dot { r: 3; }
      .radar__legend {
        display: flex;
        gap: var(--sp-4, 16px);
        flex-wrap: wrap;
        justify-content: center;
        margin-top: var(--sp-2, 8px);
        font-size: var(--fs-sm, 0.875rem);
      }
      .radar__legend span { display: inline-flex; align-items: center; gap: 6px; }
      .radar__swatch { width: 12px; height: 12px; border-radius: 3px; }
    `,
  ],
  template: `
    <svg class="radar" [attr.viewBox]="viewBox" xmlns="http://www.w3.org/2000/svg" role="img">
      @for (ring of ringPolys(); track $index) {
        <polygon class="radar__ring" [attr.points]="ring" />
      }
      @for (sp of spokes(); track $index) {
        <line class="radar__spoke" [attr.x1]="cx" [attr.y1]="cy" [attr.x2]="sp.x" [attr.y2]="sp.y" />
      }
      @for (lbl of axisLabels(); track $index) {
        <text
          class="radar__axis-label"
          [attr.x]="lbl.x"
          [attr.y]="lbl.y"
          [attr.text-anchor]="lbl.anchor"
        >{{ lbl.label }}</text>
      }
      @for (poly of seriesPolys(); track poly.label) {
        <polygon
          class="radar__poly"
          [attr.points]="poly.points"
          [style.fill]="poly.color"
          [style.stroke]="poly.color"
        />
        @for (d of poly.dots; track $index) {
          <circle class="radar__dot" [attr.cx]="d.x" [attr.cy]="d.y" [style.fill]="poly.color" />
        }
      }
    </svg>
    <div class="radar__legend">
      @for (poly of seriesPolys(); track poly.label) {
        <span><i class="radar__swatch" [style.background]="poly.color"></i>{{ poly.label }}</span>
      }
    </div>
  `,
})
export class RadarChartComponent {
  axes = input<RadarAxis[]>([]);
  series = input<RadarSeries[]>([]);

  readonly viewBox = `-30 -20 ${SIZE + 60} ${SIZE + 40}`;
  readonly cx = C;
  readonly cy = C;

  private readonly n = computed(() => Math.max(3, this.axes().length));

  private angle(i: number): number {
    return -Math.PI / 2 + (i * 2 * Math.PI) / this.n();
  }
  private point(i: number, radius: number): { x: number; y: number } {
    const a = this.angle(i);
    return { x: C + radius * Math.cos(a), y: C + radius * Math.sin(a) };
  }

  readonly ringPolys = computed(() =>
    RINGS.map((f) =>
      Array.from({ length: this.n() }, (_, i) => {
        const p = this.point(i, R * f);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).join(' '),
    ),
  );

  readonly spokes = computed(() =>
    Array.from({ length: this.n() }, (_, i) => this.point(i, R)),
  );

  readonly axisLabels = computed(() =>
    this.axes().map((ax, i) => {
      const p = this.point(i, R + 18);
      const anchor = p.x < C - 4 ? 'end' : p.x > C + 4 ? 'start' : 'middle';
      return { label: ax.label, x: p.x, y: p.y + 3, anchor };
    }),
  );

  readonly seriesPolys = computed(() =>
    this.series().slice(0, 3).map((s, si) => {
      const color = s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length];
      const dots = this.axes().map((_, i) => {
        const v = Math.max(0, Math.min(1, s.values[i] ?? 0));
        return this.point(i, R * v);
      });
      return {
        label: s.label,
        color,
        dots,
        points: dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' '),
      };
    }),
  );
}

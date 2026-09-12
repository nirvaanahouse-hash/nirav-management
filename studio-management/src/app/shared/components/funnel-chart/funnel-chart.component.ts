import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface FunnelStage {
  label: string;
  value: number;
  /** 'a' | 'b' | 'c' | 'd' → the gradient ramp used for the segment. */
  variant?: string;
}

const SHAPE_H = 24;

/**
 * Horizontal conversion funnel. Each stage is a tapered trapezoid segment —
 * its top width matches this stage's share of the largest stage, its bottom
 * width tapers to the next stage's share, so the shape itself shows the
 * drop-off (not a proportional-width bar). Pure DOM, theme-token colours.
 */
@Component({
  selector: 'app-funnel-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './funnel-chart.component.html',
  styleUrl: './funnel-chart.component.scss',
})
export class FunnelChartComponent {
  stages = input<FunnelStage[]>([]);
  /** Denominator for the % column — defaults to the first stage's value. */
  baseValue = input<number | null>(null);

  private readonly variants = ['a', 'b', 'c', 'd', 'e'];

  readonly rows = computed(() => {
    const s = this.stages();
    const max = Math.max(1, ...s.map((x) => x.value));
    const base = this.baseValue() ?? s[0]?.value ?? 0;
    const widths = s.map((x) => Math.max(8, (x.value / max) * 100));

    return s.map((stage, i) => {
      const topPct = widths[i];
      const botPct = widths[i + 1] ?? widths[i];
      const topX0 = (50 - topPct / 2).toFixed(1);
      const topX1 = (50 + topPct / 2).toFixed(1);
      const botX0 = (50 - botPct / 2).toFixed(1);
      const botX1 = (50 + botPct / 2).toFixed(1);
      return {
        label: stage.label,
        value: stage.value,
        variant: stage.variant ?? this.variants[i % this.variants.length],
        points: `${topX0},0 ${topX1},0 ${botX1},${SHAPE_H} ${botX0},${SHAPE_H}`,
        pct: base > 0 ? Math.round((stage.value / base) * 100) : 0,
      };
    });
  });

  readonly viewBox = `0 0 100 ${SHAPE_H}`;
}

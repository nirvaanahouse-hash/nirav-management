import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface FunnelStage {
  label: string;
  value: number;
  /** 'a' | 'b' | 'c' | 'd' → the gradient ramp used for the bar. */
  variant?: string;
}

/**
 * Horizontal conversion funnel. Each stage is a gradient-filled track whose
 * width is relative to the largest stage; the % is relative to the first stage.
 * Pure DOM, theme-token colours, dark-scope friendly.
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
    return s.map((stage, i) => ({
      label: stage.label,
      value: stage.value,
      variant: stage.variant ?? this.variants[i % this.variants.length],
      width: Math.max(2, (stage.value / max) * 100),
      pct: base > 0 ? Math.round((stage.value / base) * 100) : 0,
    }));
  });
}

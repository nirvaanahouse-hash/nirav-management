import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

export interface DonutSegment {
  label: string;
  value: number;
  variant: string;
}

const R = 52;
const C = 2 * Math.PI * R;
const GAP = 3;

@Component({
  selector: "app-donut",
  standalone: true,
  templateUrl: "./donut.component.html",
  styleUrl: "./donut.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonutComponent {
  segments = input<DonutSegment[]>([]);
  centerLabel = input<string>("");
  centerValue = input<string>("");

  readonly r = R;
  readonly circ = C;

  readonly arcs = computed(() => {
    const segs = this.segments().filter((s) => s.value > 0);
    const total = segs.reduce((s, x) => s + x.value, 0) || 1;
    let offset = 0;
    return segs.map((s) => {
      const frac = s.value / total;
      const len = Math.max(0, frac * C - GAP);
      const arc = {
        ...s,
        pct: Math.round(frac * 100),
        dashArray: `${len} ${C - len}`,
        dashOffset: -offset,
      };
      offset += frac * C;
      return arc;
    });
  });
}

import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

const SIZE = 120;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// A 270° arc (like a speedometer) reads clearer at a glance than a full
// circle — the gap at the bottom is where the dial "starts" and "ends".
const ARC_FRACTION = 0.75;

/**
 * A circular score gauge — "94 of 100" style. Pure SVG, themed with CSS
 * tokens. Used for a single headline health/quality score card.
 */
@Component({
  selector: "app-gauge",
  standalone: true,
  template: `
    <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" [attr.width]="size" [attr.height]="size">
      <circle
        [attr.cx]="size / 2"
        [attr.cy]="size / 2"
        [attr.r]="radius"
        fill="none"
        [attr.stroke-width]="stroke"
        class="gauge__track"
        [attr.stroke-dasharray]="trackDash()"
        [attr.transform]="rotation()"
      />
      <circle
        [attr.cx]="size / 2"
        [attr.cy]="size / 2"
        [attr.r]="radius"
        fill="none"
        [attr.stroke-width]="stroke"
        stroke-linecap="round"
        class="gauge__value"
        [class]="'gauge__value gauge__value--' + tone()"
        [attr.stroke-dasharray]="valueDash()"
        [attr.transform]="rotation()"
      />
    </svg>
  `,
  styleUrl: "./gauge.component.scss",
  host: { class: "gauge" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaugeComponent {
  /** 0-100. */
  value = input.required<number>();
  tone = input<"accent" | "success" | "warning" | "danger">("accent");

  readonly size = SIZE;
  readonly radius = RADIUS;
  readonly stroke = STROKE;

  private readonly arcLength = computed(() => CIRCUMFERENCE * ARC_FRACTION);

  readonly trackDash = computed(() => `${this.arcLength()} ${CIRCUMFERENCE}`);

  readonly valueDash = computed(() => {
    const pct = Math.max(0, Math.min(100, this.value())) / 100;
    return `${this.arcLength() * pct} ${CIRCUMFERENCE}`;
  });

  /** Rotate so the arc's gap sits at the bottom, opening downward. */
  readonly rotation = computed(() => {
    const startDeg = 90 + ((1 - ARC_FRACTION) * 360) / 2;
    return `rotate(${startDeg} ${this.size / 2} ${this.size / 2})`;
  });
}

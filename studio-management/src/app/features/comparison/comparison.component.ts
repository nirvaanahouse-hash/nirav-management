import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ComparisonService } from '../../core/services/comparison.service';
import { EmployeeComparisonRow } from '../../core/models/comparison.model';
import { ToastService } from '../../features/toast/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { RadarChartComponent, RadarSeries } from '../../shared/components/radar-chart/radar-chart.component';

type RangeKey = 'thisMonth' | 'lastMonth' | 'last12' | 'custom';
type NumKey =
  | 'ticketsAssigned'
  | 'ticketsCompleted'
  | 'ticketsFinalized'
  | 'workValue'
  | 'earnings'
  | 'paid'
  | 'balanceDue'
  | 'percentage';

const iso = (d: Date) => d.toISOString().slice(0, 10);

@Component({
  selector: 'app-comparison',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, RadarChartComponent],
  templateUrl: './comparison.component.html',
  styleUrls: ['./comparison.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparisonComponent {
  private readonly service = inject(ComparisonService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly rows = signal<EmployeeComparisonRow[]>([]);

  readonly range = signal<RangeKey>('thisMonth');
  readonly customFrom = signal('');
  readonly customTo = signal('');
  readonly today = iso(new Date());

  readonly rangeOptions: { value: RangeKey; label: string }[] = [
    { value: 'thisMonth', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: 'last12', label: 'Last 12 months' },
    { value: 'custom', label: 'Custom' },
  ];

  // ---- leaderboard ----
  readonly sortKey = signal<NumKey>('earnings');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  readonly columns: { key: NumKey; label: string; money?: boolean }[] = [
    { key: 'ticketsAssigned', label: 'Tickets' },
    { key: 'ticketsCompleted', label: 'Completed' },
    { key: 'ticketsFinalized', label: 'Finalised' },
    { key: 'workValue', label: 'Work value', money: true },
    { key: 'earnings', label: 'Earnings', money: true },
    { key: 'paid', label: 'Paid', money: true },
    { key: 'balanceDue', label: 'Balance', money: true },
    { key: 'percentage', label: 'Share %' },
  ];

  readonly sortedRows = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...this.rows()].sort((a, b) => (Number(a[key]) - Number(b[key])) * dir);
  });

  // ---- "who does more" bar chart ----
  readonly barMetric = signal<NumKey>('earnings');
  readonly barMetricOptions: { value: NumKey; label: string }[] = [
    { value: 'workValue', label: 'Work value' },
    { value: 'earnings', label: 'Earnings' },
    { value: 'ticketsAssigned', label: 'Tickets' },
    { value: 'ticketsCompleted', label: 'Completed' },
  ];

  readonly barRows = computed(() => {
    const key = this.barMetric();
    const list = [...this.rows()].sort((a, b) => Number(b[key]) - Number(a[key]));
    const max = Math.max(1, ...list.map((r) => Number(r[key])));
    return list.map((r) => ({
      _id: r._id,
      name: r.name,
      value: Number(r[key]),
      pct: Math.round((Number(r[key]) / max) * 100),
    }));
  });

  isMoneyMetric(k: NumKey): boolean {
    return k === 'workValue' || k === 'earnings' || k === 'paid' || k === 'balanceDue';
  }

  // ---- head-to-head ----
  readonly pickA = signal<string>('');
  readonly pickB = signal<string>('');

  readonly rowA = computed(() => this.rows().find((r) => r._id === this.pickA()) ?? null);
  readonly rowB = computed(() => this.rows().find((r) => r._id === this.pickB()) ?? null);

  readonly radarAxes = [
    { label: 'Tickets' },
    { label: 'Completed' },
    { label: 'Work' },
    { label: 'Earnings' },
    { label: 'Paid' },
  ];
  private readonly radarKeys: NumKey[] = [
    'ticketsAssigned',
    'ticketsCompleted',
    'workValue',
    'earnings',
    'paid',
  ];

  readonly radarSeries = computed<RadarSeries[]>(() => {
    const a = this.rowA();
    const b = this.rowB();
    if (!a || !b) return [];
    const norm = (row: EmployeeComparisonRow) =>
      this.radarKeys.map((k) => {
        const max = Math.max(1, Math.abs(Number(a[k])), Math.abs(Number(b[k])));
        return Math.max(0, Number(row[k])) / max;
      });
    return [
      { label: a.name, values: norm(a), color: 'var(--accent)' },
      { label: b.name, values: norm(b), color: 'var(--warning)' },
    ];
  });

  readonly h2hStats = computed(() => {
    const a = this.rowA();
    const b = this.rowB();
    if (!a || !b) return [];
    return this.columns.map((c) => ({
      label: c.label,
      money: !!c.money,
      a: Number(a[c.key]),
      b: Number(b[c.key]),
      winner:
        Number(a[c.key]) === Number(b[c.key])
          ? 'tie'
          : Number(a[c.key]) > Number(b[c.key])
            ? 'a'
            : 'b',
    }));
  });

  constructor() {
    this.load();
  }

  private fromTo(): { from?: string; to?: string } {
    const d = new Date();
    switch (this.range()) {
      case 'lastMonth':
        return {
          from: iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
          to: iso(new Date(d.getFullYear(), d.getMonth(), 0)),
        };
      case 'last12':
        return { from: iso(new Date(d.getFullYear(), d.getMonth() - 11, 1)), to: this.today };
      case 'custom':
        return { from: this.customFrom() || undefined, to: this.customTo() || undefined };
      default:
        return { from: iso(new Date(d.getFullYear(), d.getMonth(), 1)), to: this.today };
    }
  }

  load(): void {
    this.loading.set(true);
    const { from, to } = this.fromTo();
    this.service.getEmployees(from, to).subscribe({
      next: (res) => {
        const data = res.data || [];
        this.rows.set(data);
        if (!this.pickA() || !data.some((r) => r._id === this.pickA())) {
          this.pickA.set(data[0]?._id ?? '');
        }
        if (!this.pickB() || !data.some((r) => r._id === this.pickB())) {
          this.pickB.set(data[1]?._id ?? data[0]?._id ?? '');
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load comparison data');
      },
    });
  }

  setRange(value: RangeKey): void {
    if (value === 'custom' && !this.customFrom()) {
      const d = new Date();
      this.customFrom.set(iso(new Date(d.getFullYear(), d.getMonth(), 1)));
    }
    this.range.set(value);
    if (value !== 'custom') this.load();
  }

  setCustomFrom(v: string): void {
    this.customFrom.set(v);
    this.range.set('custom');
    if (v && this.customTo()) this.load();
  }

  setCustomTo(v: string): void {
    this.customTo.set(v);
    this.range.set('custom');
    if (this.customFrom() && v) this.load();
  }

  setSort(key: NumKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set('desc');
    }
  }

  medal(index: number): string {
    return ['🥇', '🥈', '🥉'][index] ?? '';
  }

  money(v: number): string {
    return `₹${Math.round(Number(v || 0)).toLocaleString()}`;
  }

  trackRow = (_i: number, r: EmployeeComparisonRow) => r._id;
}

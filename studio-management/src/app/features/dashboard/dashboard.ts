import { Component, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { TaskService } from "../../core/services/task.service";
import { TaskCalculationService } from "../../core/services/task-calculation.service";
import { AmountService } from "../../core/services/amount.service";
import { TicketRecord } from "../../core/models/task.model";
import { AmountEntry } from "../../core/models/amountEntry.model";
import { AuthService } from "../../core/services/auth.service";
import { TicketMetaService } from "../../core/services/ticket-meta.service";
import { SelectComponent } from "../../shared/components/select/select.component";
import { DatepickerComponent } from "../../shared/components/datepicker/datepicker.component";
import { SelectItem } from "../../shared/components/select/select.model";
import {
  PRIORITY_VARIANT,
  TICKET_STATUS_VARIANT,
  TICKET_STATUS_LABELS,
  TicketStatus,
} from "../../core/constants/app.constants";
import { IconButtonComponent } from "../../shared/components/icon-button/icon-button.component";
import { AreaChartComponent, ChartPoint } from "../../shared/components/area-chart/area-chart.component";
import { ComparisonChartComponent } from "../../shared/components/comparison-chart/comparison-chart.component";
import { FunnelChartComponent } from "../../shared/components/funnel-chart/funnel-chart.component";
import { SparklineComponent } from "../../shared/components/sparkline/sparkline.component";
import { DonutComponent } from "../../shared/components/donut/donut.component";

type RangeKey = "thisMonth" | "lastMonth" | "last12" | "custom";

interface MetricDef {
  key: string;
  label: string;
  kind: "count" | "currency";
  icon: string;
  reduce: (tickets: TicketRecord[], entries: AmountEntry[]) => number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [
    SelectComponent,
    DatepickerComponent,
    CommonModule,
    FormsModule,
    RouterLink,
    IconButtonComponent,
    AreaChartComponent,
    ComparisonChartComponent,
    FunnelChartComponent,
    SparklineComponent,
    DonutComponent,
  ],
  templateUrl: "./dashboard.html",
  styleUrl: "./dashboard.scss",
})
export class DashboardComponent {
  private taskService = inject(TaskService);
  private calculationService = inject(TaskCalculationService);
  private amountService = inject(AmountService);
  private authService = inject(AuthService);
  private ticketMeta = inject(TicketMetaService);
  private router = inject(Router);

  loading = signal(true);
  tickets = signal<TicketRecord[]>([]);
  entries = signal<AmountEntry[]>([]);

  // ---- Filter-wise trend chart -------------------------------------------
  private calc = (t: TicketRecord) => this.calculationService.calculate(t);
  private sum = <T>(list: T[], pick: (x: T) => number) =>
    list.reduce((s, x) => s + (Number(pick(x)) || 0), 0);

  private readonly mainAmt = (t: TicketRecord) => Number(t.calculatedMainAmount ?? t.mainAmount ?? 0);
  private readonly userAmt = (t: TicketRecord) => Number(t.calculatedAmount ?? t.amount ?? 0);

  private readonly saMetrics: MetricDef[] = [
    { key: "tickets", label: "Total Tickets", kind: "count", icon: "ticket", reduce: (t) => t.length },
    { key: "mainAmount", label: "Main Revenue", kind: "currency", icon: "rupee", reduce: (t) => this.sum(t, (x) => this.mainAmt(x)) },
    { key: "profit", label: "Company Profit", kind: "currency", icon: "trend", reduce: (t) => this.sum(t, (x) => this.calc(x).companyProfit) },
    { key: "recvFromClients", label: "Received from Clients", kind: "currency", icon: "wallet", reduce: (_t, e) => this.sum(e.filter((x) => x.recipientType === "client" && x.type === "received"), (x) => +x.amount || 0) },
    { key: "userAmount", label: "Employee Amount", kind: "currency", icon: "wallet", reduce: (t) => this.sum(t, (x) => this.userAmt(x)) },
    { key: "empEarnings", label: "Employee Earnings", kind: "currency", icon: "wallet", reduce: (t) => this.sum(t, (x) => this.calc(x).employeeEarnings) },
    { key: "sentToEmp", label: "Sent to Employees", kind: "currency", icon: "send", reduce: (_t, e) => this.sum(e.filter((x) => x.recipientType === "employee" && x.type === "sent"), (x) => +x.amount || 0) },
  ];

  private readonly empMetrics: MetricDef[] = [
    { key: "tickets", label: "My Tickets", kind: "count", icon: "ticket", reduce: (t) => t.length },
    { key: "completed", label: "Completed", kind: "count", icon: "check", reduce: (t) => t.filter((x) => x.status === "completed").length },
    { key: "pending", label: "Pending", kind: "count", icon: "clock", reduce: (t) => t.filter((x) => x.status === "pending" || x.status === "inProgress").length },
    { key: "myEarnings", label: "My Earnings", kind: "currency", icon: "trend", reduce: (t) => this.sum(t, (x) => this.calc(x).employeeEarnings) },
    // Money the studio has actually paid this user = "sent" entries.
    { key: "recvFromSA", label: "Received from Company", kind: "currency", icon: "wallet", reduce: (_t, e) => this.sum(e.filter((x) => x.recipientType === "employee" && x.type === "sent"), (x) => +x.amount || 0) },
  ];

  readonly rangeOptions: { value: RangeKey; label: string }[] = [
    { value: "thisMonth", label: "This month" },
    { value: "lastMonth", label: "Last month" },
    { value: "last12", label: "Last 12 months" },
    { value: "custom", label: "Custom" },
  ];

  readonly metrics = computed(() => (this.isAdmin() ? this.saMetrics : this.empMetrics));
  readonly selectedMetricKey = signal("tickets");
  readonly range = signal<RangeKey>("thisMonth");
  /** "yyyy-mm-dd" — the from/to dates when range === 'custom'. */
  readonly customFrom = signal("");
  readonly customTo = signal("");
  readonly today = new Date().toISOString().slice(0, 10);

  readonly activeMetric = computed(
    () => this.metrics().find((m) => m.key === this.selectedMetricKey()) ?? this.metrics()[0],
  );
  readonly chartKind = computed(() => this.activeMetric().kind);

  /** Second KPI card chosen for the diverging comparison chart (null = single metric). */
  readonly compareKey = signal<string | null>(null);
  readonly compareMetric = computed(
    () => this.metrics().find((m) => m.key === this.compareKey()) ?? null,
  );
  readonly isComparing = computed(() => !!this.compareMetric());
  readonly compareLabel = computed(() => this.compareMetric()?.label ?? "");

  private readonly scopedTickets = computed(() =>
    this.isAdmin() ? this.tickets() : this.employeeTickets(),
  );
  private readonly scopedEntries = computed(() => {
    if (this.isAdmin()) return this.entries();
    const id = String(this.authService.currentUser()?._id ?? "");
    return this.entries().filter((e) => String(e.recipient) === id);
  });

  /** [start, end) timestamps for the active range — everything on the page respects this. */
  readonly rangeWindow = computed<{ start: number; end: number }>(() => {
    const d = new Date();
    const now = Date.now();
    switch (this.range()) {
      case "lastMonth":
        return {
          start: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(),
          end: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
        };
      case "last12":
        return { start: new Date(d.getFullYear(), d.getMonth() - 11, 1).getTime(), end: now };
      case "custom": {
        const f = this.customFrom();
        const t = this.customTo();
        const start = f ? new Date(`${f}T00:00:00`).getTime() : new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        // include the whole "to" day; default to now when no end is set
        const end = t ? new Date(`${t}T23:59:59.999`).getTime() : now;
        return { start, end: end > start ? end : now };
      }
      default: // thisMonth
        return { start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), end: now };
    }
  });

  private readonly windowTickets = computed(() => {
    const { start, end } = this.rangeWindow();
    return this.scopedTickets().filter((t) => this.tsIn(t.createdAt, start, end));
  });
  private readonly windowEntries = computed(() => {
    const { start, end } = this.rangeWindow();
    return this.scopedEntries().filter((e) => this.tsIn(e.entryDate || e.createdAt, start, end));
  });

  private readonly buckets = computed<{ label: string; start: number; end: number }[]>(() => {
    const { start: wStart, end: wEnd } = this.rangeWindow();
    const out: { label: string; start: number; end: number }[] = [];
    const spanDays = (wEnd - wStart) / 86_400_000;

    if (spanDays > 70) {
      // month buckets
      let d = new Date(new Date(wStart).getFullYear(), new Date(wStart).getMonth(), 1);
      while (d.getTime() < wEnd) {
        const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        out.push({ label: MONTHS[d.getMonth()], start: d.getTime(), end: next.getTime() });
        d = next;
      }
      return out;
    }

    // day buckets
    let d = new Date(wStart);
    d.setHours(0, 0, 0, 0);
    while (d.getTime() < wEnd) {
      const e = new Date(d);
      e.setDate(e.getDate() + 1);
      out.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, start: d.getTime(), end: e.getTime() });
      d = e;
    }
    return out;
  });

  private buildSeries(metric: MetricDef): ChartPoint[] {
    const buckets = this.buckets();
    const tks = this.windowTickets();
    const ens = this.windowEntries();
    return buckets.map((b) => ({
      label: b.label,
      value: metric.reduce(
        tks.filter((t) => this.tsIn(t.createdAt, b.start, b.end)),
        ens.filter((e) => this.tsIn(e.entryDate || e.createdAt, b.start, b.end)),
      ),
    }));
  }

  readonly chartData = computed<ChartPoint[]>(() => this.buildSeries(this.activeMetric()));

  /** { label, kind, points } for the primary card — series A of the comparison chart. */
  readonly seriesA = computed(() => {
    const m = this.activeMetric();
    return { label: m.label, kind: m.kind, points: this.buildSeries(m) };
  });

  /** Series B — only meaningful when compareMetric() is set. */
  readonly seriesB = computed(() => {
    const m = this.compareMetric() ?? this.activeMetric();
    return { label: m.label, kind: m.kind, points: this.buildSeries(m) };
  });

  readonly chartTotal = computed(() => this.chartData().reduce((s, p) => s + p.value, 0));

  chartTotalLabel = computed(() =>
    this.chartKind() === "currency"
      ? this.formatCurrency(this.chartTotal())
      : `${this.chartTotal()}`,
  );

  readonly rangeLabel = computed(() => {
    if (this.range() === "custom") {
      const f = this.customFrom();
      const t = this.customTo();
      if (f && t) return `${new Date(f).toLocaleDateString()} – ${new Date(t).toLocaleDateString()}`;
      if (f) return `Since ${new Date(f).toLocaleDateString()}`;
      return "Custom";
    }
    return this.rangeOptions.find((r) => r.value === this.range())?.label ?? "";
  });

  // ---- KPI cards (value + delta + sparkline) ----------------------------
  private tsIn(v: string | undefined, s: number, e: number): boolean {
    const t = v ? new Date(v).getTime() : NaN;
    return t >= s && t < e;
  }

  private windowTotal(reduce: MetricDef["reduce"], start: number, end: number): number {
    const tks = this.scopedTickets().filter((t) => this.tsIn(t.createdAt, start, end));
    const ens = this.scopedEntries().filter((x) => this.tsIn(x.entryDate || x.createdAt, start, end));
    return reduce(tks, ens);
  }

  readonly kpis = computed(() => {
    const tks = this.windowTickets();
    const ens = this.windowEntries();
    const bks = this.buckets();
    const { start, end } = this.rangeWindow();
    const len = Math.max(1, end - start);

    return this.metrics().map((m) => {
      const value = m.reduce(tks, ens);
      const series = bks.map((b) =>
        m.reduce(
          tks.filter((t) => this.tsIn(t.createdAt, b.start, b.end)),
          ens.filter((x) => this.tsIn(x.entryDate || x.createdAt, b.start, b.end)),
        ),
      );
      // vs the immediately preceding window of equal length
      const prev = this.windowTotal(m.reduce, start - len, start);
      const delta = prev === 0 ? (value > 0 ? 100 : 0) : ((value - prev) / Math.abs(prev)) * 100;

      return {
        key: m.key,
        label: m.label,
        iconKey: m.icon,
        valueLabel: m.kind === "currency" ? this.formatCurrency(value) : `${value}`,
        series,
        delta: Math.round(delta),
        trend: delta > 1 ? "up" : delta < -1 ? "down" : ("flat" as "up" | "down" | "flat"),
      };
    });
  });

  // ---- Breakdown widgets (respect the active range) ----------------------
  readonly statusBreakdown = computed(() => {
    const t = this.windowTickets();
    const order: TicketStatus[] = ["pending", "inProgress", "completed", "hold"];
    return order
      .map((s) => ({
        label: TICKET_STATUS_LABELS[s],
        value: t.filter((x) => x.status === s).length,
        variant: this.statusVariant(s),
      }))
      .filter((x) => x.value > 0);
  });

  readonly statusTotalLabel = computed(() => `${this.windowTickets().length}`);

  // ---- Hero panel ------------------------------------------------------
  /** The KPI row for whichever metric is charted in the hero. */
  readonly heroKpi = computed(
    () => this.kpis().find((k) => k.key === this.selectedMetricKey()) ?? this.kpis()[0],
  );

  // ---- Ticket funnel -------------------------------------------------
  readonly funnelStages = computed(() => {
    const t = this.windowTickets();
    const total = t.length;
    const started = t.filter((x) => x.status !== "pending").length;
    const completed = t.filter((x) => x.status === "completed").length;
    const finalised = t.filter((x) => x.status === "completed" && x.isFinalized).length;
    return [
      { label: "Tickets", value: total, variant: "a" },
      { label: "Started", value: started, variant: "b" },
      { label: "Completed", value: completed, variant: "c" },
      { label: "Finalised", value: finalised, variant: "d" },
    ];
  });

  readonly completionRate = computed(() => {
    const s = this.funnelStages();
    const total = s[0]?.value || 0;
    return total ? Math.round((s[3].value / total) * 100) : 0;
  });

  readonly completionDelta = computed(() => {
    const { start, end } = this.rangeWindow();
    const len = Math.max(1, end - start);
    const rate = (from: number, to: number) => {
      const list = this.scopedTickets().filter((t) => this.tsIn(t.createdAt, from, to));
      const fin = list.filter((t) => t.status === "completed" && t.isFinalized).length;
      return list.length ? (fin / list.length) * 100 : 0;
    };
    return Math.round(rate(start, end) - rate(start - len, start));
  });

  // ---- Money mini-cards (SA) ----------------------------------------
  readonly miniCards = computed(() => {
    const tks = this.windowTickets();
    const ens = this.windowEntries();
    const workValue = this.sum(tks, (t) => this.mainAmt(t));
    const received = this.sum(
      ens.filter((e) => e.recipientType === "client" && e.type === "received"),
      (e) => Number(e.amount || 0),
    );
    const pendingValue = this.sum(
      tks.filter((t) => t.status !== "completed"),
      (t) => this.mainAmt(t),
    );
    const payable = this.sum(
      tks.filter((t) => t.status === "completed" && t.isFinalized),
      (t) => this.calc(t).employeeEarnings,
    );
    return [
      { label: "Work value", valueLabel: `+${this.formatCurrency(Math.round(workValue))}`, tone: "accent" },
      { label: "Received", valueLabel: `+${this.formatCurrency(Math.round(received))}`, tone: "info" },
      { label: "Pending value", valueLabel: `−${this.formatCurrency(Math.round(pendingValue))}`, tone: "warning" },
      { label: "Payable", valueLabel: `−${this.formatCurrency(Math.round(payable))}`, tone: "danger" },
    ];
  });

  readonly typeBreakdown = computed(() => {
    const t = this.windowTickets();
    const counts = new Map<string, number>();
    t.forEach((x) => counts.set(x.ticketType, (counts.get(x.ticketType) || 0) + 1));
    const max = Math.max(1, ...counts.values());
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, value]) => ({
        label: this.ticketMeta.typeLabel(type),
        value,
        pct: Math.round((value / max) * 100),
        variant: this.ticketTypeVariant(type),
      }));
  });

  readonly greetingName = computed(() => this.authService.currentUser()?.firstName || "there");

  /** Recent tickets — respects the active time range (custom included). */
  readonly recentTickets = computed(() => {
    const { start, end } = this.rangeWindow();
    return this.scopedTickets()
      .filter((t) => this.tsIn(t.createdAt, start, end))
      .slice(0, 25);
  });

  // ---- Live outstanding balances (NOT affected by the time filter) ------
  /** SA: total the studio still owes all users (finalised earnings − net paid). */
  readonly payableToUsers = computed(() => {
    const earned = new Map<string, number>();
    for (const t of this.tickets()) {
      if (t.status !== "completed" || !t.isFinalized) continue;
      const emp = String(t.assignedEmployee || "");
      if (!emp) continue;
      earned.set(emp, (earned.get(emp) || 0) + this.calc(t).employeeEarnings);
    }
    const paid = new Map<string, number>();
    for (const e of this.entries()) {
      if (e.recipientType !== "employee" || e.isActive === false) continue;
      const d = e.type === "sent" ? Number(e.amount || 0) : -Number(e.amount || 0);
      paid.set(String(e.recipient), (paid.get(String(e.recipient)) || 0) + d);
    }
    let total = 0;
    for (const [emp, amt] of earned) total += Math.max(0, amt - (paid.get(emp) || 0));
    return Math.round(total);
  });

  /** SA: total all clients still owe the studio (work value − payments received). */
  readonly receivableFromClients = computed(() => {
    const work = new Map<string, number>();
    for (const t of this.tickets()) {
      const c = String(t.client || "");
      if (!c) continue;
      work.set(c, (work.get(c) || 0) + this.mainAmt(t));
    }
    const paid = new Map<string, number>();
    for (const e of this.entries()) {
      if (e.recipientType !== "client" || e.isActive === false) continue;
      paid.set(String(e.recipient), (paid.get(String(e.recipient)) || 0) + Number(e.amount || 0));
    }
    let total = 0;
    for (const [c, amt] of work) total += Math.max(0, amt - (paid.get(c) || 0));
    return Math.round(total);
  });

  /** Employee: what the studio still owes me (my finalised earnings − net paid). */
  readonly receivableFromCompany = computed(() => {
    let earned = 0;
    for (const t of this.employeeTickets()) {
      if (t.status !== "completed" || !t.isFinalized) continue;
      earned += this.calc(t).employeeEarnings;
    }
    let paid = 0;
    for (const e of this.entries()) {
      if (e.recipientType !== "employee" || e.isActive === false) continue;
      paid += e.type === "sent" ? Number(e.amount || 0) : -Number(e.amount || 0);
    }
    return Math.round(Math.max(0, earned - paid));
  });

  isAdmin = this.authService.isSuperAdmin;
  isEmployee = this.authService.isEmployee;

  /** Tickets belonging to the current employee (creator or assignee). */
  private readonly employeeTickets = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];
    return this.tickets().filter(
      (t) =>
        String(t.assignedEmployee) === String(user._id) ||
        String(t.userId) === String(user._id),
    );
  });

  priorityVariant(p: string): string {
    return PRIORITY_VARIANT[p as keyof typeof PRIORITY_VARIANT] ?? "neutral";
  }

  readonly metricOptions = computed<SelectItem[]>(() =>
    this.metrics().map((m) => ({ value: m.key, label: m.label })),
  );

  ticketTypeVariant(t: string): string {
    return this.ticketMeta.typeVariant(t);
  }

  statusVariant(s: TicketStatus): string {
    return TICKET_STATUS_VARIANT[s as keyof typeof TICKET_STATUS_VARIANT] ?? "neutral";
  }

  formatStatus(s: TicketStatus): string {
    return TICKET_STATUS_LABELS[s] || s;
  }

  typeLabel(t: string): string {
    return this.ticketMeta.typeLabel(t);
  }

  formatCurrency(value: number): string {
    return `₹${value.toLocaleString()}`;
  }

  onEditTicket(ticket: TicketRecord): void {
    const base = this.isAdmin() ? "/sa/tickets" : "/employee/tickets";
    this.router.navigate([base], { queryParams: { edit: ticket._id } });
  }

  constructor() {
    this.loadTickets();
    this.loadEntries();
    // Type names / badge colours come from the SA-managed ticket type registry.
    this.ticketMeta.ensureLoaded();
  }

  loadEntries(): void {
    this.amountService.list().subscribe({
      next: (res) => this.entries.set(res.success ? res.data || [] : []),
      error: () => this.entries.set([]),
    });
  }

  setMetric(key: string): void {
    // A metric can't be compared with itself — drop it from slot B if it lands in A.
    if (this.compareKey() === key) this.compareKey.set(null);
    this.selectedMetricKey.set(key);
  }

  /** Pick / clear the second card for the comparison chart (chip click on a KPI card). */
  setCompare(key: string, evt: Event): void {
    evt.stopPropagation();
    if (key === this.selectedMetricKey()) return;
    this.compareKey.set(this.compareKey() === key ? null : key);
  }

  clearCompare(): void {
    this.compareKey.set(null);
  }

  setRange(value: RangeKey): void {
    if (value === "custom" && !this.customFrom()) {
      const d = new Date();
      this.customFrom.set(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
    }
    this.range.set(value);
  }

  setCustomFrom(value: string): void {
    this.customFrom.set(value);
    this.range.set("custom");
  }

  setCustomTo(value: string): void {
    this.customTo.set(value);
    this.range.set("custom");
  }

  loadTickets(): void {
    this.loading.set(true);
    this.taskService.list().subscribe({
      next: (response) => {
        this.tickets.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.tickets.set([]);
        this.loading.set(false);
      },
    });
  }
}

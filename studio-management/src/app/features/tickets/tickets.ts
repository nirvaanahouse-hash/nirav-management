import { Component, DestroyRef, computed, effect, inject, input, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { TableComponent } from "../../shared/components/table/table";
import { ButtonComponent } from "../../shared/components/button/button";
import { ModalComponent } from "../../features/dialog/modal.component";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { IconButtonComponent } from "../../shared/components/icon-button/icon-button.component";
import { RowActionsComponent } from "../../shared/components/row-actions/row-actions.component";
import { TicketFormComponent } from "./ticket-form/ticket-form.component";
import { TaskService } from "../../core/services/task.service";
import { ToastService } from "../../features/toast/toast.service";
import { ConfirmDialogService } from "../../features/dialog/confirm-dialog/confirm-dialog.service";
import { TicketDraft, TicketRecord, TicketStatus } from "../../core/models/task.model";
import {
  PRIORITY_OPTIONS,
  PRIORITY_VARIANT,
  TICKET_STATUS_VARIANT,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_OPTIONS,
} from "../../core/constants/app.constants";
import { AuthService } from "../../core/services/auth.service";
import { PermissionService } from "../../core/services/permission.service";
import { TicketMetaService } from "../../core/services/ticket-meta.service";
import { ClientService } from "../../core/services/client.service";
import { TaskCalculationService } from "../../core/services/task-calculation.service";
import { TableColumn } from "../../shared/components/table/table.model";
import { SelectComponent } from "../../shared/components/select/select.component";
import { SelectItem } from "../../shared/components/select/select.model";
import { hoursToTimeString } from "../../core/utils/time-format";

@Component({
  selector: "app-tickets",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableComponent,
    ButtonComponent,
    ModalComponent,
    PageHeaderComponent,
    IconButtonComponent,
    RowActionsComponent,
    TicketFormComponent,
    SelectComponent,
  ],
  templateUrl: "./tickets.html",
  styleUrls: ["./tickets.scss"],
})
export class TicketsComponent {
  private taskService = inject(TaskService);
  private toast = inject(ToastService);
  private authService = inject(AuthService);
  private permissions = inject(PermissionService);
  private confirmDialog = inject(ConfirmDialogService);
  private ticketMeta = inject(TicketMetaService);
  private clientService = inject(ClientService);
  private taskCalculation = inject(TaskCalculationService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  searchTerm = signal("");
  statusFilter = signal("");
  typeFilter = signal("");
  priorityFilter = signal("");
  userFilter = signal("");
  loading = signal(true);
  saving = signal(false);
  dialogOpen = signal(false);
  editingTicket = signal<TicketRecord | null>(null);

  /** Live list straight from the service signal — create/update/delete reflect immediately. */
  tasks = this.taskService.tickets;

  isSA = this.authService.isSuperAdmin;
  isEmployee = this.authService.isEmployee;

  /** SA-managed ticket types, for the type filter. */
  readonly ticketTypeOptions = this.ticketMeta.ticketTypes;

  /** Filter lists carry their own "everything" row, which clears the filter. */
  readonly statusFilterOptions: SelectItem[] = [
    { value: "", label: "All statuses" },
    ...TICKET_STATUS_OPTIONS,
  ];
  readonly priorityFilterOptions: SelectItem[] = [
    { value: "", label: "All priorities" },
    ...PRIORITY_OPTIONS,
  ];
  readonly typeFilterOptions = computed<SelectItem[]>(() => [
    { value: "", label: "All types" },
    ...this.ticketTypeOptions().map((t) => ({ value: t.value, label: t.label })),
  ]);
  /** SA-only column — an employee only ever sees their own tickets anyway. */
  readonly userFilterOptions = computed<SelectItem[]>(() => [
    { value: "", label: "All employees" },
    ...this.ticketMeta.meta().employees.map((e) => ({ value: e.value, label: e.label })),
  ]);
  readonly priorityOptions = PRIORITY_OPTIONS;
  readonly statusOptions = TICKET_STATUS_OPTIONS;

  /** Selected ticket type's SA-configured "show a count" flag, if any. */
  readonly activeTypeShowsCount = computed(() => {
    const key = this.typeFilter();
    if (!key) return false;
    return !!this.ticketTypeOptions().find((t) => t.value === key)?.showCount;
  });

  filteredTasks = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const statusF = this.statusFilter();
    const typeF = this.typeFilter();
    const prioF = this.priorityFilter();
    const userF = this.userFilter();
    return this.tasks().filter((task) => {
      const matchesTerm =
        !term ||
        task.coupleName?.toLowerCase().includes(term) ||
        task.createdByName?.toLowerCase().includes(term) ||
        task.ticketType?.toLowerCase().includes(term);
      const matchesStatus = !statusF || task.status === statusF;
      const matchesType = !typeF || task.ticketType === typeF;
      const matchesPriority = !prioF || task.priorety === prioF;
      const matchesUser = !userF || task.assignedEmployee === userF;
      return matchesTerm && matchesStatus && matchesType && matchesPriority && matchesUser;
    });
  });

  filteredColumns = computed(() => {
    const isSA = this.isSA();
    const baseColumns: TableColumn<TicketRecord>[] = [
      { key: "createdByName", label: "Created By", sortable: true },
      {
        key: "clientName",
        label: "Client",
        sortable: true,
        avatar: (row) => this.clientService.imageUrl(row.clientPhoto),
      },
      { key: "coupleName", label: "Couple", sortable: true, primary: true },
      {
        key: "ticketType",
        label: "Type",
        sortable: true,
        badge: true,
        badgeVariant: (row) => row.ticketTypeVariant ?? this.ticketMeta.typeVariant(row.ticketType),
        format: (row) => row.ticketTypeLabel || this.formatTicketType(row.ticketType),
      },
      {
        key: "priorety",
        label: "Priority",
        sortable: true,
        badge: true,
        badgeVariant: (row) => PRIORITY_VARIANT[row.priorety] ?? "neutral",
        format: (row) => this.formatPriority(row.priorety),
      },
      // Work HR is visible to everyone. Non-job tickets have no hours → "-".
      {
        key: "HR",
        label: "Work HR",
        sortable: true,
        align: "right" as const,
        format: (row) => this.dashHours(row.HR),
      },
      // Employee Earning is visible to everyone too — it's the assigned
      // employee's own pay, not a studio-wide figure like Main Amount/Company
      // Profit below, which stay SA-only.
      {
        key: "amount",
        label: "Earning",
        sortable: true,
        align: "right" as const,
        format: (row) =>
          this.isEmpty(row.amount) && this.isEmpty(row.calculatedAmount)
            ? "-"
            : `₹${this.calculateEarnings(row).toLocaleString()}`,
      },
      {
        key: "_id",
        label: "Status",
        sortable: false,
        align: "center" as const,
        badge: true,
        badgeVariant: (row) => TICKET_STATUS_VARIANT[row.status] ?? "neutral",
        format: (row) => this.formatStatus(row.status),
      },
      {
        key: "createdAt",
        label: "Created Date",
        sortable: true,
        format: (row) => this.formatDateOnly(row.createdAt),
      },
    ];

    // Main HR, company profit, main amount and balance due are SA-only —
    // simply omitted for everyone else, so the columns either side of this
    // block flow together with no gap. Work HR and Earning (above) are not:
    // both are the assigned employee's own figures, not a studio-wide one.
    if (isSA) {
      baseColumns.push(
        {
          key: "mainHr",
          label: "Main HR",
          sortable: true,
          align: "right" as const,
          format: (row) => this.dashHours(row.mainHr),
        },
        {
          key: "companyProfit",
          label: "Company Profit",
          sortable: true,
          align: "right" as const,
          masked: true,
          format: (row) =>
            this.isEmpty(row.mainAmount) && row.companyProfit === undefined
              ? "-"
              : `₹${this.calculateProfit(row).toLocaleString()}`,
        },
        {
          key: "mainAmount",
          label: "Main Amount",
          sortable: true,
          align: "right" as const,
          masked: true,
          format: (row) => this.dashMoney(row.mainAmount),
        },
        {
          key: "balanceDue",
          label: "Balance Due",
          sortable: true,
          align: "right" as const,
          masked: true,
          format: (row) => this.formatBalanceDue(row),
        },
      );
    }

    baseColumns.push(
      {
        key: "deleveryDate",
        label: "Delivery",
        sortable: true,
      },
      {
        key: "updatedAt",
        label: "Last Updated",
        sortable: true,
        format: (row) => this.formatDateTime(row.updatedAt),
      },
    );

    return baseColumns;
  });

  formatTicketType(type: string): string {
    return this.ticketMeta.typeLabel(type);
  }

  formatPriority(p: string): string {
    const map: Record<string, string> = {
      high: "High",
      medium: "Medium",
      low: "Low",
    };
    return map[p] || p;
  }

  formatStatus(s: TicketStatus): string {
    return TICKET_STATUS_LABELS[s] || s;
  }

  private formatDateOnly(iso: string | undefined | null): string {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  private formatDateTime(iso: string | undefined | null): string {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${date}, ${time}`;
  }

  private isEmpty(v: unknown): boolean {
    return v === null || v === undefined || v === "" || v === "null";
  }

  /** Stored as decimal hours ("1.5") — displayed clock-style ("1:30"), with a "-" fallback for job-less tickets. */
  private dashHours(v: string | number | null | undefined): string {
    return this.isEmpty(v) ? "-" : hoursToTimeString(v);
  }

  private dashMoney(v: string | number | null | undefined): string {
    return this.isEmpty(v) ? "-" : `₹${Number(v).toLocaleString()}`;
  }

  /**
   * What the assigned employee earns on this ticket. Delegates to
   * TaskCalculationService, which prefers calculatedAmount (HR × hrPrice) over
   * the raw `amount` field — for a job ticket whose stored amount predates
   * its hour/price inputs (or an employee whose own view never got `amount`
   * set at all, since only SA can set it), the two can diverge.
   */
  calculateEarnings(ticket: TicketRecord): number {
    return Math.round(this.taskCalculation.calculate(ticket).employeeEarnings);
  }

  calculateProfit(ticket: TicketRecord): number {
    return Math.round(this.taskCalculation.calculate(ticket).companyProfit);
  }

  /** Outstanding amount owed to the assigned employee for this ticket. */
  formatBalanceDue(ticket: TicketRecord): string {
    if (!ticket.assignedEmployee || (this.isEmpty(ticket.amount) && this.isEmpty(ticket.calculatedAmount))) {
      return "-";
    }
    const due =
      ticket.balanceDue !== undefined
        ? ticket.balanceDue
        : this.calculateEarnings(ticket) - Number(ticket.employeePaid || 0);
    return `₹${Math.round(due).toLocaleString()}`;
  }

  /** SA can always edit; a user can't touch a finalized ticket. */
  canEdit(ticket: TicketRecord): boolean {
    return this.isSA() || !ticket.isFinalized;
  }

  canComplete(ticket: TicketRecord): boolean {
    const currentUserId = this.authService.currentUser()?._id;
    return (
      this.isEmployee() &&
      !ticket.isFinalized &&
      String(ticket.assignedEmployee) === String(currentUserId) &&
      ticket.status !== "completed"
    );
  }

  canFinalize(ticket: TicketRecord): boolean {
    return this.permissions.can("tickets.finalize") && !ticket.isFinalized;
  }

  canFinalizeConfirmation(ticket: TicketRecord): boolean {
    return (
      this.permissions.can("tickets.finalize") &&
      ticket.status === "completed" &&
      !ticket.isFinalized
    );
  }

  /** Once finalized, only the un-finalize action should offer a way back. */
  canUnfinalize(ticket: TicketRecord): boolean {
    return this.permissions.can("tickets.finalize") && ticket.isFinalized;
  }

  canDelete(): boolean {
    return this.permissions.can("tickets.delete");
  }

  /** `?edit=<id>` (e.g. from the dashboard) opens that ticket once the list is loaded. */
  editId = input("", { alias: "edit" });
  private autoOpenedId: string | null = null;

  constructor() {
    this.loadTasks();
    // Ticket types come from the SA registry — needed for the filter and badges.
    this.ticketMeta.ensureLoaded();

    // Open the requested ticket exactly once — never re-open it when the list
    // refreshes, otherwise closing the dialog looks like it "won't close".
    effect(() => {
      const id = this.editId();
      const list = this.tasks();
      if (!id || id === this.autoOpenedId || list.length === 0) return;
      const match = list.find((t) => t._id === id);
      if (match) {
        this.autoOpenedId = id;
        this.editingTicket.set(match);
        this.dialogOpen.set(true);
      }
    });
  }

  openDialog(): void {
    this.editingTicket.set(null);
    this.dialogOpen.set(true);
  }

  openEdit(task: TicketRecord): void {
    this.editingTicket.set(task);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.editingTicket.set(null);
    // Drop the `?edit=` param so a list refresh / reload can't re-trigger it.
    if (this.editId()) {
      this.autoOpenedId = this.editId();
      this.router.navigate([], { queryParams: { edit: null }, queryParamsHandling: "merge" });
    }
  }

  loadTasks(): void {
    this.loading.set(true);
    this.taskService.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  async onTaskSubmit(draft: TicketDraft): Promise<void> {
    const editing = this.editingTicket();

    if (editing) {
      const confirmed = await this.confirmDialog.ask({
        title: "Save changes?",
        message: `Save these changes to ${editing.coupleName || "this ticket"}?`,
        confirmLabel: "Save",
        cancelLabel: "Cancel",
      });
      if (!confirmed) return;
    }

    this.saving.set(true);

    if (editing) {
      // TaskService.update() already folds the response into the `tickets`
      // signal — no need to re-fetch the whole list after a save.
      this.taskService.update(editing._id, draft).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success("Ticket updated", "Changes saved.");
          this.closeDialog();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          if (err.status === 403 && err.error?.message) {
            this.toast.error("Can't update", err.error.message);
            this.closeDialog();
          }
        },
      });
    } else {
      this.taskService.create(draft).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success("Ticket created", "The new ticket has been added.");
          this.closeDialog();
        },
        error: () => {
          this.saving.set(false);
        },
      });
    }
  }

  async deleteTask(task: TicketRecord): Promise<void> {
    const confirmed = await this.confirmDialog.ask({
      title: "Delete Ticket",
      message: `Are you sure you want to delete this ticket? ${task.coupleName || ""} This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });

    if (!confirmed) return;

    this.taskService.delete(task._id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.success("Ticket deleted", task.coupleName || "");
      },
      error: () => {
        this.toast.error("Delete failed", "Please try again.");
      },
    });
  }

  completeTask(task: TicketRecord): void {
    this.taskService.complete(task._id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.success("Ticket completed", `${task.coupleName || ""} marked as complete.`);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.toast.error("Permission denied", "Only assigned employees can complete tickets.");
        } else if (err.status === 400 && err.error?.message) {
          this.toast.error("Can't complete yet", err.error.message);
        } else {
          this.toast.error("Complete failed", "Please try again.");
        }
      },
    });
  }

  toggleFinalize(task: TicketRecord): void {
    // Can only finalize a ticket that's already completed.
    if (!task.isFinalized && task.status !== "completed") {
      this.toast.error(
        "Complete the ticket first",
        "This ticket will be finalized once it is marked complete.",
      );
      return;
    }

    this.taskService.finalize(task._id, !task.isFinalized).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.success(
          task.isFinalized ? "Ticket unfinalized" : "Ticket finalized",
          `${task.coupleName || ""} has been ${task.isFinalized ? "unfinalized" : "finalized"}.`
        );
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.toast.error("Permission denied", "Only SA can finalize tickets.");
        } else if (err.status === 400 && err.error?.message) {
          this.toast.error("Can't finalize yet", err.error.message);
        } else {
          this.toast.error("Finalize failed", "Please try again.");
        }
      },
    });
  }
}

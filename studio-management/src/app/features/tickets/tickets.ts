import { Component, computed, effect, inject, input, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { TableComponent } from "../../shared/components/table/table";
import { ButtonComponent } from "../../shared/components/button/button";
import { ModalComponent } from "../../features/dialog/modal.component";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { IconButtonComponent } from "../../shared/components/icon-button/icon-button.component";
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
import { TableColumn } from "../../shared/components/table/table.model";

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
    TicketFormComponent,
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
  private router = inject(Router);

  searchTerm = signal("");
  statusFilter = signal("");
  typeFilter = signal("");
  priorityFilter = signal("");
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
  readonly priorityOptions = PRIORITY_OPTIONS;
  readonly statusOptions = TICKET_STATUS_OPTIONS;

  filteredTasks = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const statusF = this.statusFilter();
    const typeF = this.typeFilter();
    const prioF = this.priorityFilter();
    return this.tasks().filter((task) => {
      const matchesTerm =
        !term ||
        task.coupleName?.toLowerCase().includes(term) ||
        task.createdByName?.toLowerCase().includes(term) ||
        task.ticketType?.toLowerCase().includes(term);
      const matchesStatus = !statusF || task.status === statusF;
      const matchesType = !typeF || task.ticketType === typeF;
      const matchesPriority = !prioF || task.priorety === prioF;
      return matchesTerm && matchesStatus && matchesType && matchesPriority;
    });
  });

  filteredColumns = computed(() => {
    const isSA = this.isSA();
    const baseColumns: TableColumn<TicketRecord>[] = [
      {
        key: "ticketType",
        label: "Type",
        sortable: true,
        badge: true,
        badgeVariant: (row) => row.ticketTypeVariant ?? this.ticketMeta.typeVariant(row.ticketType),
        format: (row) => row.ticketTypeLabel || this.formatTicketType(row.ticketType),
      },
      { key: "coupleName", label: "Couple", sortable: true },
      { key: "createdByName", label: "Created By", sortable: true },
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
        format: (row) => this.dashNum(row.HR),
      },
    ];

    // Main HR, main amount, employee earnings and company profit are SA-only.
    if (isSA) {
      baseColumns.push(
        {
          key: "mainHr",
          label: "Main HR",
          sortable: true,
          align: "right" as const,
          format: (row) => this.dashNum(row.mainHr),
        },
        {
          key: "mainAmount",
          label: "Main Amount",
          sortable: true,
          align: "right" as const,
          format: (row) => this.dashMoney(row.mainAmount),
        },
        {
          key: "amount",
          label: "Employee Earning",
          sortable: true,
          align: "right" as const,
          format: (row) =>
            this.isEmpty(row.amount) ? "-" : `₹${this.calculateEarnings(row).toLocaleString()}`,
        },
        {
          key: "companyProfit",
          label: "Company Profit",
          sortable: true,
          align: "right" as const,
          format: (row) =>
            this.isEmpty(row.mainAmount) && row.companyProfit === undefined
              ? "-"
              : `₹${this.calculateProfit(row).toLocaleString()}`,
        },
        {
          key: "balanceDue",
          label: "Balance Due",
          sortable: true,
          align: "right" as const,
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
        key: "_id",
        label: "Status",
        sortable: false,
        align: "center" as const,
        badge: true,
        badgeVariant: (row) => TICKET_STATUS_VARIANT[row.status] ?? "neutral",
        format: (row) => this.formatStatus(row.status),
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

  private isEmpty(v: unknown): boolean {
    return v === null || v === undefined || v === "" || v === "null";
  }

  /** Number cell with a "-" fallback (job-less tickets store null hours). */
  private dashNum(v: string | number | null | undefined): string {
    return this.isEmpty(v) ? "-" : `${Number(v)}`;
  }

  private dashMoney(v: string | number | null | undefined): string {
    return this.isEmpty(v) ? "-" : `₹${Number(v).toLocaleString()}`;
  }

  /** What the assigned employee earns on this ticket. */
  calculateEarnings(ticket: TicketRecord): number {
    if (ticket.employeeEarnings !== undefined) {
      return Math.round(ticket.employeeEarnings);
    }
    const amount = Number(ticket.amount || 0);
    const userPercentage = Number(ticket.userPersentage || 0);
    return Math.round(amount * (userPercentage / 100));
  }

  calculateProfit(ticket: TicketRecord): number {
    if (ticket.companyProfit !== undefined) {
      return Math.round(ticket.companyProfit);
    }
    const mainAmount = Number(ticket.mainAmount || 0);
    return Math.round(mainAmount - this.calculateEarnings(ticket));
  }

  /** Outstanding amount owed to the assigned employee for this ticket. */
  formatBalanceDue(ticket: TicketRecord): string {
    if (!ticket.assignedEmployee) return "-";
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
    this.taskService.list().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  onTaskSubmit(draft: TicketDraft): void {
    const editing = this.editingTicket();
    this.saving.set(true);

    if (editing) {
      this.taskService.update(editing._id, draft).subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success("Ticket updated", "Changes saved.");
          this.closeDialog();
          this.loadTasks();
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
      this.taskService.create(draft).subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success("Ticket created", "The new ticket has been added.");
          this.closeDialog();
          this.loadTasks();
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

    this.taskService.delete(task._id).subscribe({
      next: () => {
        this.toast.success("Ticket deleted", task.coupleName || "");
        this.loadTasks();
      },
      error: () => {
        this.toast.error("Delete failed", "Please try again.");
      },
    });
  }

  completeTask(task: TicketRecord): void {
    this.taskService.complete(task._id).subscribe({
      next: () => {
        this.toast.success("Ticket completed", `${task.coupleName || ""} marked as complete.`);
        this.loadTasks();
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

    this.taskService.finalize(task._id, !task.isFinalized).subscribe({
      next: () => {
        this.toast.success(
          task.isFinalized ? "Ticket unfinalized" : "Ticket finalized",
          `${task.coupleName || ""} has been ${task.isFinalized ? "unfinalized" : "finalized"}.`
        );
        this.loadTasks();
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
